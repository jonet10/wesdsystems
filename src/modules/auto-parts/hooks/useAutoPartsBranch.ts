import { useBusinessBranches } from "@/hooks/useBusinessBranches";
import { useActiveBranchId } from "@/lib/branch";

export function useAutoPartsBranch(businessId: string | null | undefined) {
  const { data: branches = [], isLoading } = useBusinessBranches();
  const { branchId, setActiveBranchId } = useActiveBranchId(businessId);

  const activeBranch = branches.find((b) => b.id === branchId) || null;

  return {
    branchId,
    branches,
    activeBranch,
    setActiveBranchId,
    isLoading,
    hasMultipleBranches: branches.length > 1,
  };
}
