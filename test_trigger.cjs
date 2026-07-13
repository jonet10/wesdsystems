const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function runTest() {
  try {
    // 1. Get first business
    const { data: businesses } = await supabase.from('businesses').select('id').limit(1);
    if (!businesses || businesses.length === 0) {
      console.log("No businesses found in DB!");
      return;
    }
    const businessId = businesses[0].id;
    console.log("Using businessId:", businessId);

    // 2. Create a test category if none
    const { data: categories } = await supabase.from('pharmacy_categories').select('id').limit(1);
    let categoryId = categories?.[0]?.id;
    if (!categoryId) {
      const { data: newCat } = await supabase.from('pharmacy_categories').insert([{ business_id: businessId, name: "Test Cat" }]).select().single();
      categoryId = newCat.id;
    }

    // 3. Create a test product
    const { data: product, error: pErr } = await supabase.from('pharmacy_products').insert([{
      business_id: businessId,
      category_id: categoryId,
      name: "Test Trigger Product",
      min_stock_alert: 5
    }]).select().single();

    if (pErr) {
      console.error("Error creating product:", pErr);
      return;
    }
    console.log("Created product:", product.id, "Initial stock:", product.total_stock_quantity);

    // 4. Create a batch for the product
    const expDate = new Date();
    expDate.setFullYear(expDate.getFullYear() + 1);

    const { data: batch, error: bErr } = await supabase.from('pharmacy_batches').insert([{
      business_id: businessId,
      product_id: product.id,
      batch_number: "TEST-LOT-123",
      expiration_date: expDate.toISOString().split("T")[0],
      initial_quantity: 10,
      current_quantity: 10
    }]).select().single();

    if (bErr) {
      console.error("Error creating batch:", bErr);
      return;
    }
    console.log("Created batch:", batch.id);

    // 5. Fetch product again to check total_stock_quantity
    const { data: updatedProduct } = await supabase.from('pharmacy_products').select('total_stock_quantity').eq('id', product.id).single();
    console.log("Updated product stock:", updatedProduct.total_stock_quantity);

    // Clean up
    await supabase.from('pharmacy_batches').delete().eq('id', batch.id);
    await supabase.from('pharmacy_products').delete().eq('id', product.id);
  } catch (err) {
    console.error("Exception:", err);
  }
}

runTest();
