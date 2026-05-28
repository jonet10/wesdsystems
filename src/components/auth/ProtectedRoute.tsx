import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

type AppRole = "super_admin" | "salon_admin" | "studio_admin" | "employee";

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles: AppRole[];
  allowAuthenticatedWithoutRole?: boolean;
}

const getDefaultRouteForRole = (role?: string | null): string => {
  if (role === "super_admin") return "/admin";
  if (role === "employee") return "/employee";
  return "/salon";
};

const normalizeRole = (role?: string | null): AppRole | null => {
  if (!role) return null;
  if (role === "owner" || role === "salon_admin" || role === "studio_admin") return "studio_admin";
  if (role === "super_admin" || role === "employee") return role;
  return null;
};

export function ProtectedRoute({
  children,
  allowedRoles,
  allowAuthenticatedWithoutRole = false,
}: ProtectedRouteProps) {
  const { isLoading, isAuthenticated, profile } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center font-sans font-medium text-gray-500">
        Vérification de votre session...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" state={{ from: location.pathname }} replace />;
  }

  const role = normalizeRole(profile?.role_normalized ?? profile?.role ?? null);
  const normalizedAllowedRoles = allowedRoles.map((r) => normalizeRole(r)).filter(Boolean) as AppRole[];

  if (!role) {
    if (allowAuthenticatedWithoutRole) {
      return <>{children}</>;
    }
    return <Navigate to="/salon" replace />;
  }

  if (!normalizedAllowedRoles.includes(role as AppRole)) {
    return <Navigate to={getDefaultRouteForRole(role)} replace />;
  }

  return <>{children}</>;
}
