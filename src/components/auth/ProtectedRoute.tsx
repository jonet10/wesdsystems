import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { normalizeEmployeeRole } from "@/lib/employee-role";
import { getSalonEmployeePermissions } from "@/config/permissions";
import { hasPermission, type Permission } from "@/config/permissions";

type AppRole = "super_admin" | "salon_admin" | "studio_admin" | "employee" | "partner" | "school_admin" | "school_accountant" | "school_cashier" | "school_teacher" | "school_parent";

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles: AppRole[];
  allowAuthenticatedWithoutRole?: boolean;
  requiredPermissions?: Permission | Permission[];
}

function moduleRoute(businessType?: string | null): string {
  const routes: Record<string, string> = {
    salon: "/salon",
    pharmacie: "/pharmacie",
    restaurant: "/bar",
    market: "/market",
    boutique: "/boutique",
    auto_parts: "/auto-parts",
    school_payments: "/school",
    school: "/school",
  };
  return (businessType && routes[businessType]) || "/salon";
}

const getDefaultRouteForRole = (role?: string | null, businessType?: string | null): string => {
  if (role === "super_admin") return "/admin";
  if (role === "partner") return "/partner";
  if (role === "employee") return "/employee";
  if (role === "school_parent") return "/school/parent/dashboard";
  return moduleRoute(businessType);
};

/**
 * Map each business_type to its expected URL prefix.
 * Used to prevent cross-module access (e.g. salon admin on /auto-parts).
 */
const MODULE_PREFIXES: Record<string, string> = {
  salon: "/salon",
  pharmacie: "/pharmacie",
  restaurant: "/bar",
  market: "/market",
  boutique: "/boutique",
  auto_parts: "/auto-parts",
  school_payments: "/school",
  school: "/school",
};

/**
 * Returns true if the current path belongs to a different module
 * than the user's business_type.
 */
function isWrongModule(pathname: string, businessType?: string | null): boolean {
  if (!businessType) return false;
  const userPrefix = MODULE_PREFIXES[businessType];
  if (!userPrefix) return false;
  // Check if the path belongs to any known module OTHER than the user's
  return Object.entries(MODULE_PREFIXES).some(
    ([biz, prefix]) => biz !== businessType && pathname.startsWith(prefix)
  );
}

/**
 * Normalize raw DB role → canonical AppRole.
 * studio_admin / salon_admin / owner → "studio_admin" (salon routes).
 */
const normalizeRole = (role?: string | null): AppRole | null => {
  if (!role) return null;
  if (role === "super_admin" || role === "employee" || role === "partner") return role;
  if (["owner", "salon_admin", "studio_admin"].includes(role)) return "studio_admin";
  if (["school_admin", "school_accountant", "school_cashier", "school_teacher", "school_parent"].includes(role)) return role as AppRole;
  return null;
};

export function ProtectedRoute({
  children,
  allowedRoles,
  allowAuthenticatedWithoutRole = false,
  requiredPermissions,
}: ProtectedRouteProps) {
  const { isLoading, isAuthenticated, profile, employeeSession, autoPartsStaffSession } = useAuth();
  const location = useLocation();
  const employeeRole = normalizeEmployeeRole(employeeSession?.role);
  const hasEmployeeSession = !!employeeSession && !profile && !isAuthenticated;

  // Session check not finished yet — show minimal loading screen
  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center font-sans font-medium text-gray-500">
        Vérification de votre session...
      </div>
    );
  }

  // Auto-parts staff session (no Supabase Auth) — check permissions
  if (!!autoPartsStaffSession && !profile && !isAuthenticated) {
    const path = location.pathname;
    if (!path.startsWith("/auto-parts")) {
      return <Navigate to="/auto-parts/pos" replace />;
    }
    const hasPerm = requiredPermissions ? hasPermission(autoPartsStaffSession.permissions, requiredPermissions) : true;
    if (requiredPermissions && !hasPerm) {
      return <Navigate to="/auto-parts/pos" replace />;
    }
    return <>{children}</>;
  }

  // Employee sessions are handled separately from Supabase auth.
  if (hasEmployeeSession) {
    const routePath = location.pathname;
    const isEmployeeRoute = routePath.startsWith("/employee");

    if (isEmployeeRoute) {
      return <>{children}</>;
    }

    if (requiredPermissions && employeeRole) {
      const empPerms = getSalonEmployeePermissions(employeeRole);
      const permsToCheck = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];
      const hasPerm = permsToCheck.some(p => empPerms.includes(p));
      
      if (hasPerm) {
        return <>{children}</>;
      }
    }
    
    // Default fallback if they don't have the permission
    return <Navigate to="/employee" replace />;
  }

  // Not logged in → back to login
  if (!isAuthenticated) {
    return <Navigate to="/auth/login" state={{ from: location.pathname }} replace />;
  }

  // Session exists but profile hasn't loaded from DB yet.
  // If the route allows authenticated-without-role, let them in immediately.
  // Otherwise wait briefly with a loading indicator rather than redirecting.
  if (!profile) {
    if (allowAuthenticatedWithoutRole) {
      return <>{children}</>;
    }
    // Profile is still loading in background — show brief spinner
    return (
      <div className="h-screen w-screen flex items-center justify-center font-sans font-medium text-gray-500">
        Chargement du profil...
      </div>
    );
  }

  const role = normalizeRole(profile.role_normalized ?? profile.role);
  const normalizedAllowedRoles = allowedRoles
    .map((r) => normalizeRole(r))
    .filter(Boolean) as AppRole[];

  if (!role) {
    if (allowAuthenticatedWithoutRole) {
      return <>{children}</>;
    }
    return <Navigate to="/salon" replace />;
  }

  if (!normalizedAllowedRoles.includes(role)) {
    return <Navigate to={getDefaultRouteForRole(role, profile.business_type)} replace />;
  }

  // Cross-module guard: prevent admins from accessing another business's module.
  // e.g. a salon admin cannot navigate to /auto-parts, and vice-versa.
  // super_admin is exempt from this restriction.
  if (role !== "super_admin" && isWrongModule(location.pathname, profile.business_type)) {
    return <Navigate to={getDefaultRouteForRole(role, profile.business_type)} replace />;
  }

  // School permissions check
  if (role.startsWith('school_') && role !== 'school_admin' && role !== 'school_parent') {
    if (requiredPermissions) {
      const userPerms = profile.permissions || [];
      const permsToCheck = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];
      
      const hasPerm = permsToCheck.some(p => userPerms.includes(p));
      if (!hasPerm) {
        return <Navigate to={getDefaultRouteForRole(role, profile.business_type)} replace />;
      }
    }
  }

  return <>{children}</>;
}
