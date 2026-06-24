import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { hasPermission as checkPermission, type Permission, type AutoPartsRole } from '@/config/permissions';
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
  computeStaffPermissions,
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
  permissions?: string[];
}

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  employeeSession: EmployeeSession | null;
  autoPartsStaffSession: AutoPartsStaffSession | null;
  autoPartsPermissions: Permission[];
  hasAutoPartsPermission: (permission: Permission | Permission[]) => boolean;
  loginEmployee: (username: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  logoutEmployee: () => void;
  loginAutoPartsStaff: (username: string, pin: string) => Promise<{ success: boolean; error?: string }>;
  logoutAutoPartsStaff: () => void;
  loginStaff: (username: string, secret: string) => Promise<{ success: boolean; error?: string; staff_type?: string }>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  session: null,
  profile: null,
  isLoading: true,
  isAuthenticated: false,
  employeeSession: null,
  autoPartsStaffSession: null,
  autoPartsPermissions: [],
  hasAutoPartsPermission: () => false,
  loginEmployee: async () => ({ success: false, error: 'Not initialized' }),
  logoutEmployee: () => {},
  loginAutoPartsStaff: async () => ({ success: false, error: 'Not initialized' }),
  logoutAutoPartsStaff: () => {},
  loginStaff: async () => ({ success: false, error: 'Not initialized' }),
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
      .select('id, full_name, role, role_normalized, business_id, business_type, permissions')
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

  const initStaffSession = (): AutoPartsStaffSession | null => {
    const saved = loadStaffSession();
    if (!saved) return null;
    return {
      ...saved,
      role: saved.role as AutoPartsRole,
      permissions: computeStaffPermissions(saved.role as AutoPartsRole),
    };
  };

  const [autoPartsStaffSession, setAutoPartsStaffSession] = useState<AutoPartsStaffSession | null>(() => initStaffSession());
  const autoPartsPermissions = autoPartsStaffSession?.permissions ?? [];
  const isAuthenticated = !!session;
  const hasAutoPartsPermissionFn = useCallback(
    (permission: Permission | Permission[]): boolean => {
      // Admins with Supabase Auth have all permissions only if they are super_admin or auto_parts business admins
      if (!!profile && isAuthenticated) {
        if (profile.role === 'super_admin' || profile.business_type === 'auto_parts') {
          return true;
        }
      }
      return checkPermission(autoPartsPermissions, permission);
    },
    [autoPartsPermissions, profile, isAuthenticated]
  );

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

      const staffWithPermissions: AutoPartsStaffSession = {
        ...result.staff!,
        role: result.staff!.role as AutoPartsRole,
        permissions: computeStaffPermissions(result.staff!.role as AutoPartsRole),
      };
      setAutoPartsStaffSession(staffWithPermissions);
      saveStaffSession(staffWithPermissions);
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

  const loginStaff = async (username: string, secret: string) => {
    try {
      const { data, error } = await supabase.rpc('check_staff_login', {
        p_username: username,
        p_pin: secret,
      });
      if (error) throw error;

      const result = data as {
        success: boolean;
        error?: string;
        staff_type?: string;
        id?: string;
        name?: string;
        role?: string;
        business_id?: string;
        branch_id?: string;
        session_token?: string;
        session_expires_at?: string;
      };

      if (!result.success) {
        return { success: false, error: result.error || 'Identifiants incorrects' };
      }

      if (result.staff_type === 'salon') {
        const empSession: EmployeeSession = {
          id: result.id!,
          branch_id: result.branch_id!,
          name: result.name!,
          role: normalizeEmployeeRole(result.role) || result.role || 'cashier',
          session_token: result.session_token,
        };
        setEmployeeSession(empSession);
        saveEmployeeSession(empSession);
        return { success: true, staff_type: 'salon' };
      }

      if (result.staff_type === 'auto_parts') {
        const apSession: AutoPartsStaffSession = {
          id: result.id!,
          name: result.name!,
          role: result.role! as AutoPartsRole,
          business_id: result.business_id!,
          permissions: computeStaffPermissions(result.role as AutoPartsRole),
          session_token: result.session_token,
          expires_at: result.session_expires_at,
        };
        setAutoPartsStaffSession(apSession);
        saveStaffSession(apSession);
        return { success: true, staff_type: 'auto_parts' };
      }

      return { success: false, error: 'Type de personnel inconnu' };
    } catch (err: any) {
      const isMissing = err?.status === 404 || err?.code === 'PGRST202';
      return {
        success: false,
        error: isMissing
          ? 'Le service de connexion unifiée n\'est pas encore déployé. Applique la migration.'
          : err.message || 'Erreur lors de la connexion',
      };
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
        autoPartsPermissions,
        hasAutoPartsPermission: hasAutoPartsPermissionFn,
        loginEmployee,
        logoutEmployee,
        loginAutoPartsStaff,
        logoutAutoPartsStaff,
        loginStaff,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext(): AuthState {
  return useContext(AuthContext);
}
