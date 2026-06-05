import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { normalizeEmployeeRole } from '@/lib/employee-role';
import {
  loadEmployeeSession,
  revokeEmployeeSession,
  saveEmployeeSession,
  type EmployeeSession,
} from '@/modules/salon/auth';
import {
  loadStaffSession,
  saveStaffSession,
  type AutoPartsStaffSession,
} from '@/modules/auto-parts/staff-session';
import type { User, Session } from '@supabase/supabase-js';

interface UserProfile {
  id: string;
  full_name: string | null;
  role: string;
  role_normalized: string | null;
  business_id: string | null;
  business_type: string | null;
}

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  employeeSession: EmployeeSession | null;
  autoPartsStaffSession: AutoPartsStaffSession | null;
  loginEmployee: (username: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  logoutEmployee: () => void;
  loginAutoPartsStaff: (username: string, pin: string) => Promise<{ success: boolean; error?: string }>;
  logoutAutoPartsStaff: () => void;
}

const AuthContext = createContext<AuthState>({
  user: null,
  session: null,
  profile: null,
  isLoading: true,
  isAuthenticated: false,
  employeeSession: null,
  autoPartsStaffSession: null,
  loginEmployee: async () => ({ success: false, error: 'Not initialized' }),
  logoutEmployee: () => {},
  loginAutoPartsStaff: async () => ({ success: false, error: 'Not initialized' }),
  logoutAutoPartsStaff: () => {},
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
    business_type: typeof metadata.business_type === 'string' ? metadata.business_type : null,
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
      .select('id, full_name, role, role_normalized, business_id, business_type')
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
  const [employeeSession, setEmployeeSession] = useState<EmployeeSession | null>(() => {
    const saved = loadEmployeeSession();
    if (!saved) return null;
    return {
      ...saved,
      role: normalizeEmployeeRole(saved.role) || saved.role,
    };
  });
  const [autoPartsStaffSession, setAutoPartsStaffSession] = useState<AutoPartsStaffSession | null>(() => loadStaffSession());

  const loginEmployee = async (username: string, pass: string) => {
    try {
      const { data, error } = await supabase.rpc('check_employee_login', {
        p_username: username,
        p_password: pass
      });
      if (error) throw error;

      const result = data as { success: boolean; error?: string; employee?: EmployeeSession };
      if (!result.success) {
        return { success: false, error: result.error || 'Erreur inconnue' };
      }

      const normalizedEmployee = {
        ...result.employee,
        role: normalizeEmployeeRole(result.employee?.role) || result.employee?.role || "cashier",
      } as EmployeeSession;
      setEmployeeSession(normalizedEmployee);
      saveEmployeeSession(normalizedEmployee);
      return { success: true };
    } catch (err: any) {
      const isMissingRpc =
        err?.status === 404 ||
        err?.code === "PGRST202" ||
        String(err?.message || "").includes("check_employee_login");

      if (isMissingRpc) {
        return {
          success: false,
          error:
            "Le service de connexion employé n'est pas encore déployé sur la base Supabase. Applique la migration 20260624_employee_session_secure_catalog.sql sur le projet distant.",
        };
      }

      return { success: false, error: err.message || 'Erreur lors de la connexion' };
    }
  };

  const logoutEmployee = () => {
    const sessionToken = employeeSession?.session_token || null;
    setEmployeeSession(null);
    saveEmployeeSession(null);
    void revokeEmployeeSession(sessionToken);
  };

  const loginAutoPartsStaff = async (username: string, pin: string) => {
    try {
      const { data, error } = await supabase.rpc('check_auto_parts_staff_login', {
        p_username: username,
        p_pin: pin,
      });
      if (error) throw error;

      const result = data as { success: boolean; error?: string; staff?: AutoPartsStaffSession };
      if (!result.success) {
        return { success: false, error: result.error || 'Erreur inconnue' };
      }

      setAutoPartsStaffSession(result.staff!);
      saveStaffSession(result.staff!);
      return { success: true };
    } catch (err: any) {
      const isMissingRpc =
        err?.status === 404 ||
        err?.code === 'PGRST202' ||
        String(err?.message || '').includes('check_auto_parts_staff_login');

      if (isMissingRpc) {
        return {
          success: false,
          error:
            'Le service de connexion employé auto-parts n\'est pas encore déployé. Applique la migration 20260706_fix_rls_and_compatibilities.sql.',
        };
      }

      return { success: false, error: err.message || 'Erreur lors de la connexion' };
    }
  };

  const logoutAutoPartsStaff = () => {
    const sessionToken = autoPartsStaffSession?.session_token || null;
    setAutoPartsStaffSession(null);
    saveStaffSession(null);
    if (sessionToken) {
      supabase.rpc('revoke_auto_parts_staff_session', { p_session_token: sessionToken }).catch(() => {});
    }
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
        autoPartsStaffSession,
        loginEmployee,
        logoutEmployee,
        loginAutoPartsStaff,
        logoutAutoPartsStaff,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext(): AuthState {
  return useContext(AuthContext);
}
