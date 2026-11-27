import { apiInspektur, galat, json } from "@/features/inspeksi/server/http";
import { idempoten } from "@/features/inspeksi/server/idempotency";
import { mulai, startSchema } from "@/features/inspeksi/server/inspeksi";

export function POST(req: Request) {
  return apiInspektur(async (user) => {
    const raw = new Uint8Array(await req.arrayBuffer());
    return idempoten(req, user.id, "start", raw, async () => {
      const parsed = startSchema.safeParse(JSON.parse(new TextDecoder().decode(raw) || "{}"));
      if (!parsed.success) return galat(422, "validasi", "Data pindai tidak sah.", parsed.error.issues);
      return json(await mulai(user, parsed.data, req.headers.get("user-agent")));
    });
  });
}
