import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAutoPartsBranch } from "../hooks/useAutoPartsBranch";
import { Building2 } from "lucide-react";

export default function BranchSelector({ businessId }: { businessId: string | null | undefined }) {
  const { branchId, branches, setActiveBranchId, hasMultipleBranches, isLoading } = useAutoPartsBranch(businessId);

  if (!hasMultipleBranches) return null;

  return (
    <div className="flex items-center gap-2">
      <Building2 className="h-4 w-4 text-muted-foreground" />
      <Select
        value={branchId || undefined}
        onValueChange={(v) => setActiveBranchId(v)}
        disabled={isLoading}
      >
        <SelectTrigger className="w-48 h-8 text-sm">
          <SelectValue placeholder="Succursale" />
        </SelectTrigger>
        <SelectContent>
          {branches.map((b) => (
            <SelectItem key={b.id} value={b.id}>
              {b.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
