import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Simple function to parse .env.local
function loadEnv() {
  try {
    const envPath = path.resolve('.env.local');
    const envFile = fs.readFileSync(envPath, 'utf8');
    envFile.split('\n').forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        process.env[match[1]] = match[2];
      }
    });
  } catch (error) {
    console.log('Could not load .env.local, make sure it exists.');
  }
}

loadEnv();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://nurwzdbjzkhsrlxehobq.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_VsQJ0ha5iEh6ThhbDzVpHg_cEkDv-U0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function createSuperAdmin() {
  const email = 'admin@wesdsystems.store';
  const password = 'Wesdajf10@@##';

  console.log(`[1] Tentative d'inscription pour ${email}...`);
  
  // 1. Sign up the user
  let { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: 'Super Admin Wesd',
      }
    }
  });

  if (signUpError) {
    if (signUpError.message.includes('User already registered')) {
      console.log(`[!] L'utilisateur existe déjà. Connexion en cours...`);
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        console.error('Erreur de connexion:', signInError.message);
        return;
      }
      signUpData = signInData;
    } else {
      console.error('Erreur d\'inscription:', signUpError.message);
      return;
    }
  } else {
    console.log(`[+] Compte créé avec succès.`);
  }

  const user = signUpData.user;
  if (!user) {
    console.error('Aucun utilisateur retourné.');
    return;
  }

  console.log(`[2] Mise à jour du profil en tant que super_admin pour l'ID: ${user.id}...`);

  // 2. Update the profile role to super_admin
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ role: 'super_admin' })
    .eq('id', user.id);

  if (updateError) {
    console.error('Erreur lors de la mise à jour du rôle:', updateError.message);
    console.log('Assurez-vous que l\'utilisateur a été créé dans la base de données et que les politiques RLS permettent la mise à jour.');
  } else {
    console.log(`[+] Rôle super_admin assigné avec succès !`);
    console.log(`\n✅ Vous pouvez maintenant vous connecter sur l'application avec :`);
    console.log(`Email : ${email}`);
    console.log(`Mot de passe : ${password}`);
  }
}

createSuperAdmin();
