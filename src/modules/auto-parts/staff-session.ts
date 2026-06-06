import type { Permission, AutoPartsRole } from "@/config/permissions";
import { getAutoPartsPermissions } from "@/config/permissions";

export interface AutoPartsStaffSession {
  id: string;
  name: string;
  role: AutoPartsRole;
  business_id: string;
  permissions: Permission[];
  session_token?: string;
  expires_at?: string;
}

export function computeStaffPermissions(role: AutoPartsRole): Permission[] {
  return getAutoPartsPermissions(role);
}

const STAFF_SESSION_KEY = "auto_parts_staff_session";

export function loadStaffSession(): AutoPartsStaffSession | null {
  try {
    const raw = localStorage.getItem(STAFF_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AutoPartsStaffSession;
  } catch { return null; }
}

export function saveStaffSession(session: AutoPartsStaffSession | null) {
  if (session) {
    localStorage.setItem(STAFF_SESSION_KEY, JSON.stringify(session));
  } else {
    localStorage.removeItem(STAFF_SESSION_KEY);
  }
}
