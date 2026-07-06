const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log('No credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: exams, error } = await supabase.from('school_exams').select('*');
  if (error) { console.error(error); return; }
  
  const STEPS_PERIODS = ['Etape 1', 'Etape 2', 'Etape 3', 'Etape 4'];
  const examsToCreate = [];
  
  // Group by business, class, subject, year
  const grouped = {};
  exams.forEach(ex => {
    if (!ex.period_name) return;
    const key = `${ex.business_id}_${ex.class_id}_${ex.subject_id}_${ex.academic_year_id}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(ex);
  });
  
  for (const key in grouped) {
    const periodExams = grouped[key];
    const existingPeriods = periodExams.map(e => e.period_name);
    
    const missing = STEPS_PERIODS.filter(p => !existingPeriods.includes(p));
    
    if (missing.length > 0 && missing.length < 4) { // Only if some exist but not all
      const template = periodExams.find(e => e.period_name === 'Etape 1') || periodExams[0];
      
      missing.forEach(p => {
        const baseName = template.name.includes(' – ') ? template.name.split(' – ')[1] : template.name;
        examsToCreate.push({
          business_id: template.business_id,
          class_id: template.class_id,
          subject_id: template.subject_id,
          academic_year_id: template.academic_year_id,
          max_points: template.max_points,
          coefficient: template.coefficient,
          exam_date: template.exam_date,
          name: `${p} – ${baseName}`,
          period_name: p
        });
      });
    }
  }
  
  if (examsToCreate.length > 0) {
    console.log(`Creating ${examsToCreate.length} missing exams...`);
    const { error: insertError } = await supabase.from('school_exams').insert(examsToCreate);
    if (insertError) console.error(insertError);
    else console.log('Successfully created missing exams!');
  } else {
    console.log('No missing exams to create.');
  }
}
run();
