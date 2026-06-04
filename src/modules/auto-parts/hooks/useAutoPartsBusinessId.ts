import { useAuth } from "@/hooks/useAuth";

export function useAutoPartsBusinessId() {
  const { profile } = useAuth();
  return profile?.business_id ?? null;
}
