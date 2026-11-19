-- Jejak audit hanya bisa ditambah (audit 19 Nov 2026, S7). Mengubah baris selalu ditolak.
-- Menghapus hanya diizinkan untuk baris contoh bertanda data.demo = true, dan hanya bila sesi
-- menyalakan palk3.hapus_audit_demo = 'ya' (dipakai `pnpm db:demo:reset`, di dalam transaksinya).
CREATE OR REPLACE FUNCTION audit_logs_tambah_saja() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE'
     AND current_setting('palk3.hapus_audit_demo', true) = 'ya'
     AND OLD.data->>'demo' = 'true' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'audit_logs hanya bisa ditambah (%, id %)', TG_OP, OLD.id USING ERRCODE = 'insufficient_privilege';
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE TRIGGER audit_logs_tambah_saja
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION audit_logs_tambah_saja();
