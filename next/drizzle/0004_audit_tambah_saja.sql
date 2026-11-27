-- Jejak audit hanya bisa ditambah (audit 19 Nov 2026, S7). Mengubah baris ditolak, kecuali
-- user_id menjadi NULL tanpa mengubah kolom lain (FK ON DELETE SET NULL saat akun demo dihapus).
-- Menghapus hanya diizinkan untuk baris contoh bertanda data.demo = true, dan hanya bila sesi
-- menyalakan palk3.hapus_audit_demo = 'ya' (dipakai `pnpm db:demo:reset`, di dalam transaksinya).
CREATE OR REPLACE FUNCTION audit_logs_tambah_saja() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.user_id IS NULL AND OLD.user_id IS NOT NULL
     AND (NEW.id, NEW.aksi, NEW.entitas, NEW.entitas_id, NEW.data, NEW.ip, NEW.created_at)
         IS NOT DISTINCT FROM (OLD.id, OLD.aksi, OLD.entitas, OLD.entitas_id, OLD.data, OLD.ip, OLD.created_at) THEN
    RETURN NEW;
  END IF;
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
