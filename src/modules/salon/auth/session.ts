import { supabase } from "@/lib/supabase";
import type { EmployeeSession } from "./types";

const EMPLOYEE_SESSION_STORAGE_KEY = "glowup_employee_session";

export function loadEmployeeSession(): EmployeeSession | null {
  try {
    const raw = localStorage.getItem(EMPLOYEE_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as EmployeeSession;
    if (!parsed?.id || !parsed?.branch_id) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveEmployeeSession(session: EmployeeSession | null) {
  try {
    if (session) {
      localStorage.setItem(EMPLOYEE_SESSION_STORAGE_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(EMPLOYEE_SESSION_STORAGE_KEY);
    }
  } catch {
    // Ignore storage failures; the in-memory session still works.
  }
}

export async function revokeEmployeeSession(sessionToken?: string | null) {
  if (!sessionToken) return;
  try {
    await supabase.rpc("revoke_employee_session", {
      p_session_token: sessionToken,
    });
  } catch {
    // Best-effort cleanup only.
  }
}
