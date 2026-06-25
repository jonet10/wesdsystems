import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

function loadEnv() {
  try {
    const envPath = path.resolve('.env.local');
    const envFile = fs.readFileSync(envPath, 'utf8');
    envFile.split('\n').forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?(\s*)$/);
      if (match) process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, '');
    });
  } catch (e) { console.log('Env load error:', e.message); }
}
loadEnv();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const serviceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('URL:', supabaseUrl);
console.log('Service Key exists:', !!serviceKey);

// Use anon client first to sign in as the school user
const anonClient = createClient(supabaseUrl, supabaseAnonKey);

// Try to sign in with various possible school accounts
const SCHOOL_ACCOUNTS = [
  { email: 'jonetjeanfrancois@gmail.com', password: 'Wesdajf10@@##' },
  { email: 'wesdsystems@gmail.com', password: 'Wesdajf10@@##' },
];

async function checkAllProfiles() {
  // Sign in as admin to get service-level access
  const { data: adminAuth, error: adminErr } = await anonClient.auth.signInWithPassword({
    email: 'admin@wesdsystems.store',
    password: 'Wesdajf10@@##'
  });

  if (adminErr) {
    console.error('Admin login failed:', adminErr.message);
    return;
  }

  const adminToken = adminAuth.session?.access_token;
  const adminClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${adminToken}` } }
  });

  // Get ALL profiles (not filtered by RLS since admin is super_admin)
  console.log('\n=== ALL PROFILES ===');
  const { data: allProfiles, error: profErr } = await adminClient
    .from('profiles')
    .select('id, role, role_normalized, business_id, business_name');
  
  if (profErr) {
    console.error('Profile query error:', profErr);
  } else {
    console.log('Total profiles:', allProfiles.length);
    allProfiles.forEach(p => {
      console.log(`  UID: ${p.id} | Role: ${p.role} | BizID: ${p.business_id} | BizName: ${p.business_name}`);
    });
  }

  // Sign out admin
  await anonClient.auth.signOut();

  // Try signing in as school accounts
  console.log('\n=== TESTING SCHOOL ACCOUNTS ===');
  for (const acct of SCHOOL_ACCOUNTS) {
    console.log(`\nTrying: ${acct.email}`);
    const { data: loginData, error: loginErr } = await anonClient.auth.signInWithPassword(acct);
    if (loginErr) {
      console.log(`  Login FAILED: ${loginErr.message}`);
      continue;
    }
    
    const token = loginData.session?.access_token;
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    // Check what profile this user sees
    const { data: myProfile, error: myProfErr } = await userClient
      .from('profiles')
      .select('id, role, role_normalized, business_id, business_name')
      .eq('id', loginData.user.id)
      .single();
    
    if (myProfErr) {
      console.log(`  Profile fetch error: ${myProfErr.message}`);
    } else {
      console.log(`  Profile: Role=${myProfile?.role}, BizID=${myProfile?.business_id}`);
    }

    // Try to access school_products
    const { data: schoolProds, error: spErr } = await userClient
      .from('school_products')
      .select('id, name, business_id')
      .limit(5);
    
    if (spErr) {
      console.log(`  school_products access: BLOCKED (${spErr.message})`);
    } else {
      console.log(`  school_products access: OK (${schoolProds.length} rows)`);
    }

    await anonClient.auth.signOut();
  }
}

checkAllProfiles().catch(console.error);
