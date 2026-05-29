import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

const AUTH_TIMEOUT = 8000; // 8s max avant de débloquer l'écran de chargement

interface UserProfile {
  id: string;
  full_name: string | null;
  role: string;
  role_normalized: string | null;
  business_id: string | null;
}

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

/**
 * Hook centralisé pour gérer l'authentification Supabase.
 * Récupère la session, l'utilisateur et son profil (rôle, business_id).
 * Compatible avec le système existant — ne casse rien.
 */
export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timeoutId = setTimeout(() => setIsLoading(false), AUTH_TIMEOUT);

    const getSession = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (currentSession?.user) {
          await fetchProfile(currentSession.user.id);
        }
      } catch (err) {
        console.error('useAuth: erreur session', err);
      } finally {
        clearTimeout(timeoutId);
        setIsLoading(false);
      }
    };

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          await fetchProfile(newSession.user.id);
        } else {
          setProfile(null);
        }

        clearTimeout(timeoutId);
        setIsLoading(false);
      }
    );

    return () => {
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role, role_normalized, business_id')
        .eq('id', userId)
        .single();

      if (!error && data) {
        setProfile(data as UserProfile);
        return;
      }

      // Profil inexistant → créer l'entreprise et le profil automatiquement
      const meta = user?.user_metadata ?? {};
      const bizName = (meta.business_name as string) || 'Mon Entreprise';
      const bizType = (meta.business_type as string) || 'salon';
      const plan = (meta.plan as string) || 'starter';
      const fullName = (meta.full_name as string) || 'Utilisateur';

      const { data: biz, error: bizErr } = await supabase
        .from('businesses')
        .insert({ name: bizName, type: bizType, plan, owner_id: userId })
        .select('id')
        .single();

      if (bizErr) {
        console.warn('useAuth: impossible de créer l\'entreprise', bizErr);
        return;
      }

      const { data: prof, error: profErr } = await supabase
        .from('profiles')
        .insert({ id: userId, full_name: fullName, role: 'studio_admin', business_id: biz.id })
        .select('id, full_name, role, role_normalized, business_id')
        .single();

      if (!profErr && prof) {
        setProfile(prof as UserProfile);
      }
    } catch (err) {
      console.warn('useAuth: profil non trouvé', err);
    }
  };

  return {
    user,
    session,
    profile,
    isLoading,
    isAuthenticated: !!session,
  };
}
