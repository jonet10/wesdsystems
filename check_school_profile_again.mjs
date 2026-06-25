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

    const targetUid = "3ff5e513-7c44-43fb-af06-ad7a3de716df";
    const { data: profile } = await client
      .from("profiles")
      .select("*")
      .eq("id", targetUid)
      .maybeSingle();

    console.log("Current Profile state for school user:", profile);

  } catch (err) {
    console.error(err);
  }
}

run();
