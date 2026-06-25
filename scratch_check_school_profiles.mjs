import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

function loadEnv() {
  try {
    const envPath = path.resolve('.env.local');
    const envFile = fs.readFileSync(envPath, 'utf8');
    envFile.split('\n').forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        process.env[match[1]] = match[2].trim();
      }
    });
  } catch (error) {
    console.log('Could not load env');
  }
}
loadEnv();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkSchoolProfiles() {
  try {
    console.log("Authenticating as super admin...");
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'admin@wesdsystems.store',
      password: 'Wesdajf10@@##'
    });

    if (authError) {
      console.error("Auth error:", authError);
      return;
    }

    const token = authData.session?.access_token;
    const client = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    // Let's query ALL profiles with school roles
    console.log(`\n--- Fetching profiles ---`);
    const { data: profiles, error: profErr } = await client
      .from("profiles")
      .select("id, role, role_normalized, business_id, business_name");
    
    if (profErr) {
      console.error("Error fetching profiles:", profErr);
    } else {
      console.log(`Total profiles found: ${profiles.length}`);
      profiles.forEach(p => {
        console.log(`- UID: ${p.id}, Role: ${p.role}, RoleNorm: ${p.role_normalized}, BizID: ${p.business_id}, BizName: ${p.business_name}`);
      });
    }

    // Let's count school products per business_id
    console.log(`\n--- Counting school products ---`);
    const { data: products, error: prodErr } = await client
      .from("school_products")
      .select("id, business_id, name");
    
    if (prodErr) {
      console.error("Error fetching school products:", prodErr.message);
    } else {
      console.log(`Total school products: ${products.length}`);
      const counts = {};
      products.forEach(p => {
        counts[p.business_id] = (counts[p.business_id] || 0) + 1;
      });
      console.log("Counts per business_id:", counts);
      
      for (const bid of Object.keys(counts)) {
        console.log(`Sample of products under business ${bid}:`);
        const sample = products.filter(p => p.business_id === bid).slice(0, 5);
        sample.forEach(p => console.log(`  - ${p.name} (ID: ${p.id})`));
      }
    }

    // Let's also verify business details
    console.log(`\n--- Querying businesses ---`);
    const { data: businesses, error: bizErr } = await client
      .from("businesses")
      .select("id, name, business_type");
    
    if (bizErr) console.error("Error businesses:", bizErr);
    else console.log("Businesses:", businesses);

  } catch (err) {
    console.error("Error during check:", err);
  }
}

checkSchoolProfiles();
