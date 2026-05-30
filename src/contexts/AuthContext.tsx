import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

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

const AuthContext = createContext<AuthState>({
  user: null,
  session: null,
  profile: null,
  isLoading: true,
  isAuthenticated: false,
});

const LOCAL_SUPER_ADMIN_EMAILS = new Set(['admin@wesdsystems.store']);

const profileFromUserMetadata = (user: User): UserProfile | null => {
  const metadata = user.user_metadata ?? {};
  const metadataRole = metadata.role_normalized ?? metadata.role;
  const role = LOCAL_SUPER_ADMIN_EMAILS.has(user.email ?? '')
    ? 'super_admin'
    : typeof metadataRole === 'string'
    ? metadataRole
    : null;

  if (!role) return null;

  return {
    id: user.id,
    full_name: typeof metadata.full_name === 'string' ? metadata.full_name : null,
    role,
    role_normalized: role,
    business_id: typeof metadata.business_id === 'string' ? metadata.business_id : null,
  };
};

// Fetch profile with a 5-second timeout so a slow DB never hangs the UI
const fetchProfileWithTimeout = async (
  user: User
): Promise<UserProfile | null> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, role, role_normalized, business_id')
      .eq('id', user.id)
      .abortSignal(controller.signal)
      .maybeSingle();

    if (!error && data) return data as UserProfile;
    return profileFromUserMetadata(user);
  } catch {
    return profileFromUserMetadata(user);
  } finally {
    clearTimeout(timer);
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // ── Step 1: Resolve session immediately (no profile needed) ──
    const initSession = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();

        if (!mounted) return;

        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        // Unblock routing as soon as we know auth status
        setIsLoading(false);

        // ── Step 2: Fetch profile in background (non-blocking) ──
        if (currentSession?.user) {
          const fallbackProfile = profileFromUserMetadata(currentSession.user);
          if (fallbackProfile) setProfile(fallbackProfile);

          fetchProfileWithTimeout(currentSession.user).then((prof) => {
            if (mounted) setProfile(prof);
          });
        }
      } catch (err) {
        console.error('AuthProvider: erreur session initiale', err);
        if (mounted) setIsLoading(false);
      }
    };

    initSession();

    // ── Step 3: Listen to auth state changes (login / logout) ──
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        if (!mounted) return;

        setSession(newSession);
        setUser(newSession?.user ?? null);
        // Always unblock routing immediately
        setIsLoading(false);

        if (newSession?.user) {
          const fallbackProfile = profileFromUserMetadata(newSession.user);
          setProfile(fallbackProfile);

          // Fetch profile in background — don't await here
          fetchProfileWithTimeout(newSession.user).then((prof) => {
            if (mounted) setProfile(prof ?? null);
          });
        } else {
          setProfile(null);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        isLoading,
        isAuthenticated: !!session,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext(): AuthState {
  return useContext(AuthContext);
}
