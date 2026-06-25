import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadEnv() {
  try {
    const envPath = path.resolve('c:/Users/herod/OneDrive/Desktop/WesdSystems/.env.local');
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

async function test() {
  console.log('Testing username lookup for: louis.jean');
  const { data, error } = await supabase.rpc('get_email_by_username', {
    p_username: 'louis.jean'
  });
  console.log('RPC result:', { data, error });

  console.log('Checking all profiles directly...');
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

  const { data: profiles, error: pError } = await client
    .from('profiles')
    .select('id, username, email, full_name, role');
  if (pError) {
    console.error('Error fetching profiles:', pError);
  } else {
    console.log('Profiles found:', profiles?.filter(p => p.username === 'louis.jean'));
    console.log('All usernames:', profiles?.map(p => p.username).filter(Boolean));
  }
}

test().catch(console.error);
