import { useAuth } from "@/hooks/useAuth";
import { glowupStore } from "@/lib/store";

export function usePharmacyBusinessId() {
  const { profile } = useAuth();
  return profile?.business_id ?? glowupStore.getSalons()[0]?.business_id ?? null;
}
