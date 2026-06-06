import { useAuth } from "@/hooks/useAuth";

export function useAutoPartsBusinessId() {
  const { profile, autoPartsStaffSession } = useAuth();
  return profile?.business_id ?? autoPartsStaffSession?.business_id ?? null;
}
