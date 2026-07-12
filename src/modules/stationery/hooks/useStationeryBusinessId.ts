import { useAuth } from "@/hooks/useAuth";

export function useStationeryBusinessId() {
  const { profile } = useAuth();
  // If there's a specific staff session for stationery later, it would be added here.
  return profile?.business_id ?? null;
}
