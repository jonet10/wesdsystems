import { describe, it, expect } from "vitest";
import { supabase } from "@/lib/supabase";

describe("SaaS Multi-Tenant Security Hardenings (RPCs)", () => {
  it("should fail with error 42501 (Accès non autorisé) when querying another business's clients", async () => {
    // Mismatched random business UUID that does not belong to the active user session
    const competitorBusinessId = "00000000-0000-0000-0000-000000000000";

    const { data, error } = await supabase.rpc("auto_parts_list_clients", {
      p_business_id: competitorBusinessId,
    });

    // We expect the RPC to block the query and return a security exception
    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501");
    expect(error?.message).toMatch(/Accès non autorisé/i);
    expect(data).toBeNull();
  });

  it("should fail when querying another business's quotes", async () => {
    const competitorBusinessId = "00000000-0000-0000-0000-000000000000";

    const { data, error } = await supabase.rpc("list_auto_parts_quotes", {
      p_business_id: competitorBusinessId,
    });

    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501");
    expect(data).toBeNull();
  });

  it("should fail when listing another school's staff members", async () => {
    const competitorBusinessId = "00000000-0000-0000-0000-000000000000";

    const { data, error } = await supabase.rpc("school_list_staff", {
      p_business_id: competitorBusinessId,
    });

    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501");
    expect(data).toBeNull();
  });
});
