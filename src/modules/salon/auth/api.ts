import { supabase } from "@/lib/supabase";
import type { EmployeePosBundle, EmployeeSession } from "./types";

export async function loginEmployeeWithSession(username: string, password: string) {
  const { data, error } = await supabase.rpc("check_employee_login", {
    p_username: username,
    p_password: password,
  });

  if (error) throw error;

  const result = data as {
    success: boolean;
    error?: string;
    employee?: EmployeeSession;
  };

  return result;
}

export async function fetchEmployeePosBundle(
  sessionToken: string,
  branchId: string,
): Promise<EmployeePosBundle> {
  const { data, error } = await supabase.rpc("get_employee_pos_bundle", {
    p_session_token: sessionToken,
    p_branch_id: branchId,
  });

  if (error) throw error;
  return data as EmployeePosBundle;
}
