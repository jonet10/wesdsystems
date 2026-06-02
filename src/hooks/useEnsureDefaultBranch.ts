import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useBusinessBranches } from "@/hooks/useBusinessBranches";
import { useActiveBranchId } from "@/lib/branch";

const DEFAULT_BRANCH_NAME = "Branche principale";

export function useEnsureDefaultBranch() {
  const { profile, isAuthenticated } = useAuth();
  const businessId = profile?.business_id ?? null;
  const { data: branches = [], isFetched, isFetching } = useBusinessBranches();
  const { branchId, setActiveBranchId } = useActiveBranchId(businessId);
  const queryClient = useQueryClient();
  const bootstrappingRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || !businessId || !isFetched || isFetching) {
      return;
    }

    const hasValidBranch = branchId ? branches.some((branch) => branch.id === branchId) : false;

    if (branches.length > 0) {
      if (!hasValidBranch) {
        setActiveBranchId(branches[0].id);
      }
      return;
    }

    if (bootstrappingRef.current) {
      return;
    }

    bootstrappingRef.current = true;

    void (async () => {
      try {
        const { data, error } = await supabase
          .from("business_branches")
          .insert([
            {
              business_id: businessId,
              name: DEFAULT_BRANCH_NAME,
              active: true,
            },
          ])
          .select("id")
          .single();

        if (error) throw error;

        if (data?.id) {
          await supabase
            .from("businesses")
            .update({ active_branch_id: data.id })
            .eq("id", businessId);

          setActiveBranchId(data.id);
          await queryClient.invalidateQueries({ queryKey: ["business-branches", businessId] });
        }
      } catch (err: any) {
        console.warn("Impossible de créer la branche par défaut:", err?.message || err);
        toast.error("Impossible de créer la branche par défaut du salon.");
      } finally {
        bootstrappingRef.current = false;
      }
    })();
  }, [branchId, branches, businessId, isAuthenticated, isFetched, isFetching, queryClient, setActiveBranchId]);
}
