import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

function loadEnv() {
  try {
    const envPath = 'c:/Users/herod/OneDrive/Desktop/WesdSystems/.env.local';
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

async function testRpc() {
  try {
    const { data: authData } = await supabase.auth.signInWithPassword({
      email: 'admin@wesdsystems.store',
      password: 'Wesdajf10@@##'
    });

    const client = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${authData.session.access_token}` } }
    });

    const businessId = "519b32e7-4cc9-4bb8-9008-4f06447d29fb";

    // Call list products RPC
    const { data: list, error: rpcError } = await client.rpc("auto_parts_list_products", {
      p_business_id: businessId,
      p_branch_id: null
    });

    if (rpcError) {
      console.error("RPC Error:", rpcError);
    } else {
      console.log(`RPC returned ${list ? list.length : 0} products.`);
      if (list && list.length > 0) {
        console.log("Sample product from RPC:", list[0]);
        const configured = list.filter(r => r.unit_price !== null || r.cost_price !== null);
        console.log(`Configured products (with price): ${configured.length}`);
      }
    }

  } catch (err) {
    console.error(err);
  }
}
testRpc();
