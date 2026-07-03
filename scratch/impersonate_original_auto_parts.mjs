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

async function impersonate() {
  try {
    const { data: authData } = await supabase.auth.signInWithPassword({
      email: 'admin@wesdsystems.store',
      password: 'Wesdajf10@@##'
    });

    const businessId = "519b32e7-4cc9-4bb8-9008-4f06447d29fb";

    console.log(`Configuration de l'impersonation pour admin@wesdsystems.store vers ${businessId}...`);

    // 1. Update public.profiles using the supabase client (which has session)
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        business_id: businessId,
        business_type: "auto_parts",
        role: "salon_admin",
        role_normalized: "salon_admin"
      })
      .eq("id", authData.user.id);

    if (profileError) {
      console.error("Erreur lors de la mise à jour du profil :", profileError);
      return;
    }

    // 2. Update auth.users raw_user_meta_data using the supabase client (which has session)
    const { error: authUpdateError } = await supabase.auth.updateUser({
      data: {
        business_id: businessId,
        business_type: "auto_parts",
        role: "salon_admin",
        role_normalized: "salon_admin"
      }
    });

    if (authUpdateError) {
      console.error("Erreur lors de la mise à jour des métadonnées auth :", authUpdateError);
    } else {
      console.log("Impersonation configurée avec succès !");
    }

  } catch (err) {
    console.error(err);
  }
}
impersonate();
