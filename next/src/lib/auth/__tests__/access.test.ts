import { describe, expect, it } from "vitest";
import { canAccessPath, homeFor, isPublicPath, safeRedirect } from "../access";

describe("canAccessPath", () => {
  it("membatasi /admin hanya untuk admin", () => {
    expect(canAccessPath("admin", "/admin/aset")).toBe(true);
    expect(canAccessPath("pemantau", "/admin")).toBe(false);
    expect(canAccessPath("inspektur", "/admin")).toBe(false);
  });

  it("membuka /pemantau untuk admin dan pemantau", () => {
    expect(canAccessPath("admin", "/pemantau/laporan")).toBe(true);
    expect(canAccessPath("pemantau", "/pemantau")).toBe(true);
    expect(canAccessPath("inspektur", "/pemantau")).toBe(false);
  });

  it("membatasi area lapangan dan pintasan QR untuk inspektur", () => {
    expect(canAccessPath("inspektur", "/petugas/riwayat")).toBe(true);
    expect(canAccessPath("inspektur", "/i/GIK3-abc")).toBe(true);
    expect(canAccessPath("admin", "/petugas")).toBe(false);
    expect(canAccessPath("admin", "/i/GIK3-abc")).toBe(false);
  });

  it("lembar stiker hanya admin; laporan admin dan pemantau", () => {
    expect(canAccessPath("admin", "/stiker")).toBe(true);
    expect(canAccessPath("pemantau", "/stiker")).toBe(false);
    expect(canAccessPath("pemantau", "/laporan/pms")).toBe(true);
    expect(canAccessPath("inspektur", "/laporan")).toBe(false);
  });

  it("cron Vercel lolos proxy (Route Handler memeriksa CRON_SECRET sendiri)", () => {
    expect(isPublicPath("/api/cron/jadwal")).toBe(true);
  });

  it("tidak tertipu awalan yang mirip", () => {
    expect(canAccessPath("inspektur", "/administrasi")).toBe(true);
    expect(canAccessPath("pemantau", "/admin-x")).toBe(true);
    expect(canAccessPath("pemantau", "/info")).toBe(true);
  });
});

describe("safeRedirect", () => {
  it("memakai callbackUrl yang boleh dibuka peran itu", () => {
    expect(safeRedirect("admin", "http://localhost:3000/admin/aset?x=1")).toBe("/admin/aset?x=1");
    expect(safeRedirect("pemantau", "/pemantau/laporan")).toBe("/pemantau/laporan");
  });

  it("kembali ke beranda peran untuk tujuan terlarang atau asing", () => {
    expect(safeRedirect("inspektur", "/admin")).toBe("/petugas");
    expect(safeRedirect("admin", "//evil.example/admin")).toBe("/admin");
    expect(safeRedirect("admin", "https://evil.example/masuk")).toBe("/admin");
    expect(safeRedirect("pemantau", undefined)).toBe("/pemantau");
  });

  it("beranda peran", () => {
    expect(homeFor("admin")).toBe("/admin");
    expect(homeFor(undefined)).toBe("/masuk");
    expect(isPublicPath("/masuk")).toBe(true);
    expect(isPublicPath("/admin")).toBe(false);
    expect(isPublicPath("/tanya/rahasia-apa-pun")).toBe(true);
    expect(isPublicPath("/tanya")).toBe(false);
    expect(canAccessPath(undefined, "/admin/tanya/ekspor")).toBe(false);
  });
});
