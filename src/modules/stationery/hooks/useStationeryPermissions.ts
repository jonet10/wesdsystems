import { useAuth } from "@/hooks/useAuth";
import type { Permission } from "@/config/permissions";
import { STATIONERY_ROLE_PERMISSIONS, StationeryRole } from "@/config/permissions";

export function useStationeryPermissions() {
  const { profile, isAuthenticated } = useAuth();
  
  const hasStationeryPermission = (permission: Permission | Permission[]): boolean => {
    if (!profile || !isAuthenticated) return false;

    // Super admin has all access
    if (profile.role === 'super_admin') return true;

    // Salon admin has all access to their business
    if (profile.role === 'salon_admin' && profile.business_type === 'stationery') return true;

    // If there is a specific stationery staff session in the future, handle it here.
    // For now, we only use standard profile roles or we map from a custom profile property
    // if applicable. If we had a specific staff role for stationery, we would check it like:
    // const staffRole = stationeryStaffSession?.role as StationeryRole;
    // const permissions = STATIONERY_ROLE_PERMISSIONS[staffRole] || [];
    // ...

    return false; // Default
  };

  return { hasStationeryPermission };
}
