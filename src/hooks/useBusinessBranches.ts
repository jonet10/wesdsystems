import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import type { BusinessBranch } from "@/lib/saas";

type LegacyBranchRow = {
  id: string;
  business_id: string;
  name: string;
  created_at?: string | null;
};

export function useBusinessBranches() {
  const { profile, isAuthenticated } = useAuth();
  const businessId = profile?.business_id ?? null;

  return useQuery({
    queryKey: ["business-branches", businessId],
    enabled: Boolean(isAuthenticated && businessId),
    queryFn: async (): Promise<BusinessBranch[]> => {
      if (!businessId) return [];

      const [{ data: branchRows, error: branchError }, { data: legacyRows, error: legacyError }] = await Promise.all([
        supabase
          .from("business_branches")
          .select("id, business_id, name, phone, email, address, manager_id, active, branch_code, business_type, created_at, updated_at")
          .eq("business_id", businessId)
          .order("created_at", { ascending: true }),
        supabase
          .from("salon_branches")
          .select("id, business_id, name, created_at")
          .eq("business_id", businessId)
          .order("created_at", { ascending: true }),
      ]);

      if (branchError && !legacyError) {
        return (legacyRows || []) as BusinessBranch[];
      }

      if (branchRows && branchRows.length > 0) {
        return branchRows as BusinessBranch[];
      }

      return (legacyRows || []).map((branch: LegacyBranchRow) => ({
        id: branch.id,
        business_id: branch.business_id,
        name: branch.name,
        phone: null,
        email: null,
        address: null,
        manager_id: null,
        active: true,
        branch_code: null,
        created_at: branch.created_at,
        updated_at: branch.created_at,
      })) as BusinessBranch[];
    },
  });
}
