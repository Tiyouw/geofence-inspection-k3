import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ db: {} }));

const { koordinatUntukPeran } = await import("./pengaturan");

describe("koordinatUntukPeran (ADR-15)", () => {
  it("hanya Admin K3 dengan pengaturan menyala", () => {
    expect(koordinatUntukPeran("admin", true)).toBe(true);
    expect(koordinatUntukPeran("admin", false)).toBe(false);
  });
  it("pemantau, inspektur, dan tanpa sesi tidak pernah", () => {
    for (const p of ["pemantau", "inspektur", null, undefined]) expect(koordinatUntukPeran(p, true)).toBe(false);
  });
});
