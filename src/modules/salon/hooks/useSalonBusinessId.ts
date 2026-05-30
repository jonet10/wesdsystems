import { useAuth } from "@/hooks/useAuth";

export function useSalonBusinessId() {
  const { profile } = useAuth();
  return profile?.business_id ?? null;
}

