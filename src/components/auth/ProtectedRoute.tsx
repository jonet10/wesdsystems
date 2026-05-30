import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

type AppRole = "super_admin" | "salon_admin" | "studio_admin" | "employee" | "partner";

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles: AppRole[];
  allowAuthenticatedWithoutRole?: boolean;
}

const getDefaultRouteForRole = (role?: string | null): string => {
  if (role === "super_admin") return "/admin";
  if (role === "partner") return "/partner";
  if (role === "employee") return "/employee";
  return "/salon";
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
}: ProtectedRouteProps) {
  const { isLoading, isAuthenticated, profile } = useAuth();
  const location = useLocation();

  // Session check not finished yet — show minimal loading screen
  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center font-sans font-medium text-gray-500">
        Vérification de votre session...
      </div>
    );
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
    return <Navigate to={getDefaultRouteForRole(role)} replace />;
  }

  return <>{children}</>;
}
