/** SPEC §7.6/§7.11: jam peladen untuk koreksi jam perangkat. */
export function GET() {
  return Response.json({ now: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
}
