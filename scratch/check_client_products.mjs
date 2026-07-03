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

async function check() {
  try {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'admin@wesdsystems.store',
      password: 'Wesdajf10@@##'
    });

    if (authError) {
      console.error("Erreur de connexion Super Admin:", authError);
      return;
    }

    const client = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${authData.session.access_token}` } }
    });

    const businessId = "519b32e7-4cc9-4bb8-9008-4f06447d29fb";

    console.log("=== COMPTE CAISSIERES ET PERMISSIONS ===");

    // 1. Lister les caissiers de l'entreprise
    const { data: staff, error: staffError } = await client
      .from("auto_parts_staff")
      .select("id, name, username, role, is_active")
      .eq("business_id", businessId);

    if (staffError) {
      console.error("Erreur lecture auto_parts_staff:", staffError);
    } else {
      console.log("Caissiers de l'entreprise :", staff);
    }

    // 2. Tester en SQL direct le retour de get_auto_parts_business_settings avec un token de session d'un caissier
    // Pour cela, on va générer une session temporaire pour le premier caissier trouvé
    if (staff && staff.length > 0) {
      const cashier = staff[0];
      console.log(`\nSimulation de connexion pour le caissier: ${cashier.username}`);
      
      // On va chercher dans la table des sessions si une session est active pour ce caissier
      const { data: sessions, error: sessError } = await client
        .from("auto_parts_staff_sessions")
        .select("session_token, expires_at")
        .eq("staff_id", cashier.id)
        .order("created_at", { ascending: false })
        .limit(1);

      if (sessError) {
        console.error("Erreur lecture sessions:", sessError);
      } else {
        console.log("Sessions trouvées pour ce caissier :", sessions);
        if (sessions && sessions.length > 0) {
          const token = sessions[0].session_token;
          
          // Tester get_auto_parts_business_settings avec ce token
          const { data: settings, error: setErr } = await client
            .rpc("get_auto_parts_business_settings", {
              p_business_id: businessId,
              p_session_token: token
            });

          if (setErr) {
            console.error("Erreur lors de l'appel RPC get_auto_parts_business_settings:", setErr);
          } else {
            console.log("Paramètres retournés par la RPC avec la session caissier :", settings);
          }
        } else {
          console.log("Aucune session active trouvée en base pour ce caissier. Impossible de tester avec un vrai token.");
        }
      }
    }

  } catch (err) {
    console.error("Exception:", err);
  }
}

check();
