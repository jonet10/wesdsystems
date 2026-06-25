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

const anonClient = createClient(supabaseUrl, supabaseAnonKey);

const SCHOOL_EMAIL = 'concrete.gerbil.jtzd@hidingmail.net';
const SCHOOL_PASSWORD = 'Wesdajf10';
const SCHOOL_BUSINESS_ID = 'd612bbf1-0246-4cb4-b111-cd40168fd1a3'; // EDSVP

async function run() {
  // Step 1: Login as school user
  console.log(`Signing in as ${SCHOOL_EMAIL}...`);
  const { data: schoolAuth, error: schoolErr } = await anonClient.auth.signInWithPassword({
    email: SCHOOL_EMAIL,
    password: SCHOOL_PASSWORD
  });

  if (schoolErr) {
    console.error('School login FAILED:', schoolErr.message);
    return;
  }

  const schoolUID = schoolAuth.user.id;
  console.log(`  ✓ Login OK! UID: ${schoolUID}`);
  console.log(`  User metadata:`, schoolAuth.user.user_metadata);

  // Step 2: Check if profile exists
  const schoolToken = schoolAuth.session?.access_token;
  const schoolClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${schoolToken}` } }
  });

  const { data: myProfile, error: myProfErr } = await schoolClient
    .from('profiles')
    .select('*')
    .eq('id', schoolUID)
    .single();

  console.log('\nCurrent profile:', myProfile);
  if (myProfErr) console.log('Profile error:', myProfErr.message);

  // Step 3: Try accessing school_products
  const { data: products, error: prodErr } = await schoolClient
    .from('school_products')
    .select('id, name, business_id')
    .limit(5);

  console.log('\nschool_products access:', prodErr ? `BLOCKED: ${prodErr.message}` : `OK (${products.length} rows)`);

  await anonClient.auth.signOut();

  // Step 4: Login as admin to fix profile
  console.log('\nSigning in as admin to fix profile...');
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

  // Upsert profile for school user
  console.log(`\nUpserting profile for ${SCHOOL_EMAIL}...`);
  const { data: upserted, error: upsertErr } = await adminClient
    .from('profiles')
    .upsert({
      id: schoolUID,
      role: 'school_admin',
      role_normalized: 'school_admin',
      business_id: SCHOOL_BUSINESS_ID,
      business_name: 'EDSVP'
    }, { onConflict: 'id' })
    .select()
    .single();

  if (upsertErr) {
    console.error('Profile upsert failed:', upsertErr.message, upsertErr);
  } else {
    console.log('✓ Profile upserted:', upserted);
  }

  // Step 5: Re-login as school user to verify
  await anonClient.auth.signOut();
  console.log('\nRe-testing as school user...');
  const { data: schoolAuth2 } = await anonClient.auth.signInWithPassword({
    email: SCHOOL_EMAIL,
    password: SCHOOL_PASSWORD
  });

  const schoolClient2 = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${schoolAuth2.session?.access_token}` } }
  });

  const { data: finalProfile } = await schoolClient2
    .from('profiles')
    .select('id, role, role_normalized, business_id, business_name')
    .eq('id', schoolUID)
    .single();

  console.log('Final profile:', finalProfile);

  const { data: finalProds, error: finalProdErr } = await schoolClient2
    .from('school_products')
    .select('id, name')
    .limit(5);

  console.log('school_products access:', finalProdErr ? `BLOCKED: ${finalProdErr.message}` : `OK (${finalProds.length} rows)`);

  await anonClient.auth.signOut();
}

run().catch(console.error);
