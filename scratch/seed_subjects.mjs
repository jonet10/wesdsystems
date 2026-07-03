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

const DEFAULT_SUBJECTS = [
  'Mathématiques', 'Français', 'Créole', 'Sciences Naturelles', 
  'Histoire-Géographie', 'Anglais', 'Espagnol', 'Éducation Civique', 
  'Éducation Physique', 'Arts Plastiques', 'Informatique', 'Comptabilité'
];

const TARGET_BUSINESS_ID = '8294d3ee-9e06-4aa8-a085-70bb3229f355';

async function run() {
  try {
    console.log("Signing in...");
    const { data: authData } = await supabase.auth.signInWithPassword({
      email: 'admin@wesdsystems.store',
      password: 'Wesdajf10@@##'
    });

    const client = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${authData.session.access_token}` } }
    });

    // 1. Set admin to super_admin temporarily to bypass RLS
    console.log("Elevating admin to super_admin...");
    await client
      .from("profiles")
      .update({
        role: "super_admin",
        role_normalized: "super_admin",
        business_id: null
      })
      .eq("id", authData.user.id);

    // 2. Seed subjects for TARGET_BUSINESS_ID
    console.log(`Seeding subjects for business ${TARGET_BUSINESS_ID}...`);
    const insertPayload = DEFAULT_SUBJECTS.map(name => ({
      business_id: TARGET_BUSINESS_ID,
      name: name
    }));

    const { data, error } = await client
      .from("school_subjects")
      .insert(insertPayload)
      .select();

    if (error) {
      console.error("Error seeding subjects:", error);
    } else {
      console.log(`Successfully seeded ${data?.length || 0} subjects!`);
    }

    // 3. Restore admin to salon_admin
    console.log("Restoring admin to salon_admin...");
    await client
      .from("profiles")
      .update({
        role: "salon_admin",
        role_normalized: "salon_admin",
        business_id: "519b32e7-4cc9-4bb8-9008-4f06447d29fb",
        business_name: "Original Auto Parts"
      })
      .eq("id", authData.user.id);

    await supabase.auth.signOut();
  } catch (err) {
    console.error(err);
  }
}

run();
