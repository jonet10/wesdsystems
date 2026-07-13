const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

const businessId = '519b32e7-d86b-4fa8-8f81-549b8214316d';

async function test() {
  console.log("Using dummy businessId:", businessId);

  console.log("\n6. Testing getRecentActivity with profiles!created_by(full_name)...");
  const q6 = await supabase
    .from("pharmacy_sales")
    .select("receipt_number, total, created_at, profiles!created_by(full_name)")
    .eq("business_id", businessId);
  console.log("Q6 Error:", q6.error);
  console.log("Q6 Data:", q6.data);
}

test();
