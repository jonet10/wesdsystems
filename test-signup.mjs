import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nurwzdbjzkhsrlxehobq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51cnd6ZGJqemtoc3JseGVob2JxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwNTMxMDMsImV4cCI6MjA5NDYyOTEwM30.kRwgj2fTRo6m5I0y6V3rd_qM3zkU7D2wrSU2SaWfgLc';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testSignup() {
  console.log("Testing check_email_exists...");
  const email = `test_${Date.now()}@example.com`;
  const { data: existing, error: checkError } = await supabase.rpc('check_email_exists', { p_email: email });
  console.log("check_email_exists:", { existing, checkError });

  console.log("Testing signUp...");
  const { data, error } = await supabase.auth.signUp({
    email,
    password: 'password123',
    options: {
      data: {
        full_name: 'Test User',
        business_name: 'Test Business',
        business_type: 'salon',
        plan: 'pro'
      }
    }
  });

  console.log("signUp result:", { data, error });
}

testSignup();
