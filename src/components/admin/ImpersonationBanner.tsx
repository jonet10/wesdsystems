import { useImpersonation } from "@/contexts/ImpersonationContext";
import { Eye, LogOut, Building2 } from "lucide-react";

export function ImpersonationBanner() {
  const { isImpersonating, target, stopImpersonation } = useImpersonation();
  if (!isImpersonating || !target) return null;
  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-between px-4 py-2 text-sm font-semibold shadow-lg"
      style={{ background: "linear-gradient(90deg, #7c3aed, #db2777)", color: "white" }}
    >
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 bg-white/20 rounded-full px-3 py-0.5 text-xs">
          <Eye className="h-3 w-3" />
          <span>Mode Impersonation</span>
        </div>
        <Building2 className="h-4 w-4 opacity-80" />
        <span>
          Vous visualisez le compte de <strong>{target.business_name}</strong>{" "}
          ({target.user_name} — {target.user_email})
        </span>
      </div>
      <button
        onClick={stopImpersonation}
        className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 transition-colors rounded-lg px-3 py-1 text-xs font-bold"
      >
        <LogOut className="h-3.5 w-3.5" />
        Retourner au panneau Admin
      </button>
    </div>
  );
}
