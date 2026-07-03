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

async function deleteDuplicate() {
  try {
    const { data: authData } = await supabase.auth.signInWithPassword({
      email: 'admin@wesdsystems.store',
      password: 'Wesdajf10@@##'
    });

    const client = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${authData.session.access_token}` } }
    });

    const emptyBranchId = "5251aafb-fac2-4e1c-8096-a6c1994bd5d9";
    const businessId = "519b32e7-4cc9-4bb8-9008-4f06447d29fb";

    console.log(`Tentative de suppression de la branche doublon vide (${emptyBranchId})...`);

    const { data, error } = await client
      .from("salon_branches")
      .delete()
      .eq("id", emptyBranchId)
      .eq("business_id", businessId)
      .select();

    if (error) {
      console.error("Erreur lors de la suppression :", error);
    } else {
      console.log("Suppression réussie ! Lignes supprimées :", data);
    }

  } catch (err) {
    console.error(err);
  }
}
deleteDuplicate();
