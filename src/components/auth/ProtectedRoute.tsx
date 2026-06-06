import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { canAccessEmployeePos, normalizeEmployeeRole } from "@/lib/employee-role";
import { hasPermission, type Permission } from "@/config/permissions";

type AppRole = "super_admin" | "salon_admin" | "studio_admin" | "employee" | "partner";

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
    school_payments: "/school-payments",
  };
  return (businessType && routes[businessType]) || "/salon";
}

const getDefaultRouteForRole = (role?: string | null, businessType?: string | null): string => {
  if (role === "super_admin") return "/admin";
  if (role === "partner") return "/partner";
  if (role === "employee") return "/employee";
  return moduleRoute(businessType);
};

/**
 * Normalize raw DB role → canonical AppRole.
 * studio_admin / salon_admin / owner → "studio_admin" (salon routes).
 */
const normalizeRole = (role?: string | null): AppRole | null => {
  if (!role) return null;
  if (role === "super_admin" || role === "employee" || role === "partner") return role;
  if (["owner", "salon_admin", "studio_admin"].includes(role)) return "studio_admin";
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

  // Auto-parts staff session — check permissions (takes precedence over Supabase auth)
  if (!!autoPartsStaffSession) {
    const path = location.pathname;
    if (!path.startsWith("/auto-parts")) {
      return <Navigate to="/auto-parts/pos" replace />;
    }
    if (requiredPermissions && !hasPermission(autoPartsStaffSession.permissions, requiredPermissions)) {
      return <Navigate to="/auto-parts/pos" replace />;
    }
    return <>{children}</>;
  }

  // Employee sessions are handled separately from Supabase auth.
  if (hasEmployeeSession) {
    const path = location.pathname;
    const isEmployeePosRoute = path === "/salon/pos" || path === "/employee/pos";
    const isEmployeeReportsRoute = path === "/salon/reports";
    const isEmployeeRoute = path.startsWith("/employee");

    if (isEmployeePosRoute && canAccessEmployeePos(employeeSession?.role)) {
      return <>{children}</>;
    }

    if (isEmployeeReportsRoute && (employeeRole === "cashier" || employeeRole === "manager")) {
      return <>{children}</>;
    }

    if (isEmployeeRoute) {
      return <>{children}</>;
    }

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

  return <>{children}</>;
}
