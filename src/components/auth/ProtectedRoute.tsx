import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

type AppRole = "super_admin" | "salon_admin" | "employee";

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

  const role = profile?.role ?? null;

  if (!role) {
    if (allowAuthenticatedWithoutRole) {
      return <>{children}</>;
    }
    return <Navigate to="/salon" replace />;
  }

  if (!allowedRoles.includes(role as AppRole)) {
    return <Navigate to={getDefaultRouteForRole(role)} replace />;
  }

  return <>{children}</>;
}
