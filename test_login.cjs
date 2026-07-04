const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  const { data, error } = await supabase.rpc('check_staff_login', {
    p_username: 'test',
    p_pin: '1234'
  });
  console.log("Error staff:", error);
  console.log("Data staff:", data);
  
  const { data: d2, error: e2 } = await supabase.rpc('check_employee_login', {
    p_username: 'test',
    p_password: 'pwd'
  });
  console.log("Error emp:", e2);
  console.log("Data emp:", d2);
}

test();
