import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

interface UserProfile {
  id: string;
  full_name: string | null;
  role: string;
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
    // 1. Récupérer la session active
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
        setIsLoading(false);
      }
    };

    getSession();

    // 2. Écouter les changements d'auth (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          await fetchProfile(newSession.user.id);
        } else {
          setProfile(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role, business_id')
        .eq('id', userId)
        .single();

      if (!error && data) {
        setProfile(data as UserProfile);
      }
    } catch (err) {
      // Fallback silencieux — le profil n'existe peut-être pas encore
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
