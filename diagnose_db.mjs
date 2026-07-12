import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nurwzdbjzkhsrlxehobq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51cnd6ZGJqemtoc3JseGVob2JxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwNTMxMDMsImV4cCI6MjA5NDYyOTEwM30.kRwgj2fTRo6m5I0y6V3rd_qM3zkU7D2wrSU2SaWfgLc';

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
  console.log('--- DIAGNOSTIC DES DONNEES ---');

  // Login as admin
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'admin@wesdsystems.store',
    password: 'Wesdajf10@@##'
  });

  if (authError) {
    console.error('Auth Error:', authError.message);
    return;
  }

  console.log('Logged in successfully as:', authData.user?.email);
  
  // 1. Fetch current profile
  const { data: profile, error: profError } = await supabase
    .from('profiles')
    .select('id, email, role, business_id')
    .eq('id', authData.user?.id)
    .single();
  if (profError) console.error('Profile read error:', profError.message);
  else console.log('Current Profile:', profile);

  const businessId = profile?.business_id;

  // 2. Fetch businesses
  const { data: businesses, error: bizError } = await supabase
    .from('businesses')
    .select('id, name');
  if (bizError) console.error('Businesses read error:', bizError.message);
  else console.log('Businesses:', businesses);

  // 3. Fetch auto_parts_products
  const { data: products, error: prodError } = await supabase
    .from('auto_parts_products')
    .select('id, name, sku, active')
    .limit(10);
  if (prodError) console.error('Products read error:', prodError.message);
  else console.log('Products sample (max 10):', products);

  // 4. Fetch auto_parts_product_inventory
  const { data: inventory, error: invError } = await supabase
    .from('auto_parts_product_inventory')
    .select('id, business_id, product_id, stock_quantity, active')
    .limit(10);
  if (invError) console.error('Inventory read error:', invError.message);
  else console.log('Inventory sample (max 10):', inventory);

  // 5. Check if any sales exist
  const { data: sales, error: salesError } = await supabase
    .from('auto_parts_sales')
    .select('id, invoice_number, total')
    .limit(5);
  if (salesError) console.error('Sales read error:', salesError.message);
  else console.log('Sales sample (max 5):', sales);

  // 6. Test RPC auto_parts_dashboard_counts
  if (businessId) {
    console.log('Testing RPC auto_parts_dashboard_counts with businessId:', businessId);
    const { data: rpcData, error: rpcError } = await supabase.rpc('auto_parts_dashboard_counts', {
      p_business_id: businessId,
      p_is_admin: true
    });
    if (rpcError) console.error('RPC Error:', rpcError);
    else console.log('RPC Result:', rpcData);
  }
}

diagnose();
