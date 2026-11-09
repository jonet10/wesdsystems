import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { glowupStore } from "@/lib/store";
import { setPharmacyBusinessId } from "../services/productService";

export const DEFAULT_PHARMACY_BUSINESS_ID = "51d05c41-50c6-4bea-b3e2-d9fa9d3fe733";

export function usePharmacyBusinessId(): string {
  const { profile } = useAuth();
  
  const resolvedId = 
    profile?.business_id ?? 
    (typeof window !== "undefined" ? localStorage.getItem("pharmacy_business_id") : null) ?? 
    (typeof window !== "undefined" ? localStorage.getItem("glowup_business_id") : null) ?? 
    glowupStore.getSalons()[0]?.business_id ?? 
    DEFAULT_PHARMACY_BUSINESS_ID;

  // Immediately ensure the singleton service and localStorage have the ID
  setPharmacyBusinessId(resolvedId);
  if (typeof window !== "undefined" && !localStorage.getItem("pharmacy_business_id")) {
    localStorage.setItem("pharmacy_business_id", resolvedId);
  }

  useEffect(() => {
    setPharmacyBusinessId(resolvedId);
  }, [resolvedId]);

  return resolvedId;
}

