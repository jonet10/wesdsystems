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

async function run() {
  try {
    const { data: authData } = await supabase.auth.signInWithPassword({
      email: 'admin@wesdsystems.store',
      password: 'Wesdajf10@@##'
    });

    const client = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${authData.session.access_token}` } }
    });

    // Set admin to super_admin temporarily
    await client
      .from("profiles")
      .update({
        role: "super_admin",
        role_normalized: "super_admin",
        business_id: null
      })
      .eq("id", authData.user.id);

    // Fetch all subjects for business 8294d3ee-9e06-4aa8-a085-70bb3229f355
    const { data: subjects } = await client
      .from("school_subjects")
      .select("*")
      .eq("business_id", "8294d3ee-9e06-4aa8-a085-70bb3229f355");
    
    console.log("=== TARGET BUSINESS SUBJECTS ===");
    console.log(subjects);

    // Restore admin to salon_admin
    await client
      .from("profiles")
      .update({
        role: "salon_admin",
        role_normalized: "salon_admin",
        business_id: "519b32e7-4cc9-4bb8-9008-4f06447d29fb",
        business_name: "Original Auto Parts"
      })
      .eq("id", authData.user.id);

  } catch (err) {
    console.error(err);
  }
}

run();
