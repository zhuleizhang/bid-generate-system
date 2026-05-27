import { describe, it, expect, vi } from "vitest";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ auth: {}, storage: {}, from: vi.fn() })),
}));

describe("supabase client", () => {
  it("可以成功 import", async () => {
    const mod = await import("@/lib/supabase");
    expect(mod.supabase).toBeDefined();
  });
});
