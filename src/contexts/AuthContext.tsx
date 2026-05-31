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
  employeeSession: {
    id: string;
    full_name: string;
    role: string;
    branch_id: string;
  } | null;
  loginEmployee: (username: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  logoutEmployee: () => void;
}

const AuthContext = createContext<AuthState>({
  user: null,
  session: null,
  profile: null,
  isLoading: true,
  isAuthenticated: false,
  employeeSession: null,
  loginEmployee: async () => ({ success: false, error: 'Not initialized' }),
  logoutEmployee: () => {},
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
  const [employeeSession, setEmployeeSession] = useState<AuthState['employeeSession']>(() => {
    try {
      const saved = localStorage.getItem('glowup_employee_session');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const loginEmployee = async (username: string, pass: string) => {
    try {
      const { data, error } = await supabase.rpc('check_employee_login', {
        p_username: username,
        p_password: pass
      });
      if (error) throw error;
      
      const result = data as { success: boolean; error?: string; employee?: any };
      if (!result.success) {
        return { success: false, error: result.error || 'Erreur inconnue' };
      }
      
      setEmployeeSession(result.employee);
      localStorage.setItem('glowup_employee_session', JSON.stringify(result.employee));
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Erreur lors de la connexion' };
    }
  };

  const logoutEmployee = () => {
    setEmployeeSession(null);
    localStorage.removeItem('glowup_employee_session');
  };

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
        const message = String((err as { message?: string } | undefined)?.message || err || "").toLowerCase();
        if (message.includes("invalid refresh token") || message.includes("refresh token not found")) {
          try {
            await supabase.auth.signOut({ scope: "local" });
          } catch {
            // Ignore local cleanup failures; the session is already unusable.
          }
        }
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
          logoutEmployee(); // Clear employee session if admin logs out
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
        employeeSession,
        loginEmployee,
        logoutEmployee,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext(): AuthState {
  return useContext(AuthContext);
}
