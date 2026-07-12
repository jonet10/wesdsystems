import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nurwzdbjzkhsrlxehobq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51cnd6ZGJqemtoc3JseGVob2JxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwNTMxMDMsImV4cCI6MjA5NDYyOTEwM30.kRwgj2fTRo6m5I0y6V3rd_qM3zkU7D2wrSU2SaWfgLc';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data: businesses, error: bizError } = await supabase
    .from('businesses')
    .select('id, name')
    .limit(5);

  if (bizError) {
    console.error('Error fetching businesses:', bizError);
    return;
  }
  
  console.log('Available businesses:', businesses);

  if (businesses && businesses.length > 0) {
    const businessId = businesses[0].id;
    console.log('Testing with businessId:', businessId);

    const { data, error } = await supabase.rpc('auto_parts_dashboard_counts', {
      p_business_id: businessId,
      p_is_admin: true
    });

    if (error) {
      console.error('RPC Error:', error);
    } else {
      console.log('RPC Data:', data);
    }

    const { data: inv, error: invError } = await supabase
      .from('auto_parts_product_inventory')
      .select('count')
      .eq('business_id', businessId);
      
    if (invError) {
      console.error('Inventory Error:', invError);
    } else {
      console.log('Inventory Rows count for this business:', inv?.length);
    }

    const { count, error: countError } = await supabase
      .from('auto_parts_products')
      .select('*', { count: 'exact', head: true });
      
    if (countError) {
      console.error('Products Count Error:', countError);
    } else {
      console.log('Total Products in Database:', count);
    }
  }
}

test();
