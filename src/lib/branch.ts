import { useEffect, useMemo, useState } from "react";

export const ACTIVE_BRANCH_EVENT = "wesd-active-branch-change";

const getStorageKey = (businessId: string) => `wesd_active_branch_${businessId}`;

export function getStoredBranchId(businessId: string | null | undefined): string | null {
  if (!businessId) return null;
  try {
    return localStorage.getItem(getStorageKey(businessId)) || null;
  } catch {
    return null;
  }
}

export function setStoredBranchId(businessId: string | null | undefined, branchId: string | null) {
  if (!businessId) return;
  try {
    if (branchId) {
      localStorage.setItem(getStorageKey(businessId), branchId);
    } else {
      localStorage.removeItem(getStorageKey(businessId));
    }
  } catch {
    // Ignore storage failures and keep the UI usable.
  }
  window.dispatchEvent(new CustomEvent(ACTIVE_BRANCH_EVENT, { detail: { businessId, branchId } }));
}

export function resolveBranchScope(businessId: string | null | undefined, branchId?: string | null) {
  return branchId || (businessId ? getStoredBranchId(businessId) : null) || businessId || null;
}

export function useActiveBranchId(businessId: string | null | undefined) {
  const [branchId, setBranchId] = useState<string | null>(() => getStoredBranchId(businessId) || businessId || null);

  useEffect(() => {
    setBranchId(getStoredBranchId(businessId) || businessId || null);
  }, [businessId]);

  useEffect(() => {
    const sync = (event: Event) => {
      const customEvent = event as CustomEvent<{ businessId?: string; branchId?: string | null }>;
      if (customEvent.detail?.businessId && businessId && customEvent.detail.businessId !== businessId) return;
      setBranchId(getStoredBranchId(businessId) || businessId || null);
    };

    window.addEventListener(ACTIVE_BRANCH_EVENT, sync);
    window.addEventListener("storage", sync);

    return () => {
      window.removeEventListener(ACTIVE_BRANCH_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [businessId]);

  const setActiveBranchId = useMemo(() => {
    return (nextBranchId: string | null) => setStoredBranchId(businessId, nextBranchId);
  }, [businessId]);

  return { branchId, setActiveBranchId };
}

