import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nurwzdbjzkhsrlxehobq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51cnd6ZGJqemtoc3JseGVob2JxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwNTMxMDMsImV4cCI6MjA5NDYyOTEwM30.kRwgj2fTRo6m5I0y6V3rd_qM3zkU7D2wrSU2SaWfgLc';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testSignup() {
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
  const client = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  });

  console.log("Querying all school profiles with get_all_profiles_admin RPC...");
  const { data, error } = await client
    .rpc("get_all_profiles_admin");

  if (error) {
    console.error("Query error:", error);
  } else {
    const profiles = typeof data === "string" ? JSON.parse(data) : data;
    console.log("All profiles in DB:", profiles.filter(p => p.role && p.role.includes("school")));
  }
}

testSignup();
