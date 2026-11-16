"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ROLES, ROLE_LABEL, type Role } from "@/lib/domain/constants";
import type { HasilAksi } from "../server/aksi";
import { Bidang, Pilihan } from "./ui";
import { useFormAksi } from "./use-form-aksi";

type Nilai = {
    nip?: string;
    name?: string;
    email?: string | null;
    role?: Role;
    divisionId?: number | null;
    jabatan?: string | null;
    aktif?: boolean;
};

/** Formulir petugas (SPEC §4.5). Peran dan status aktif dikunci saat admin mengubah akunnya sendiri (B9). */
export function FormPengguna({
    aksi,
    nilai = {},
    divisi,
    baru,
    diriSendiri = false,
}: {
    aksi: (prev: unknown, fd: FormData) => Promise<HasilAksi<{ id: number } | undefined>>;
    nilai?: Nilai;
    divisi: { id: number; nama: string }[];
    baru: boolean;
    diriSendiri?: boolean;
}) {
    const router = useRouter();
    const { state, onSubmit, menunggu } = useFormAksi(aksi, {
        setelahBerhasil: (r) => {
            if (r.ok && r.data && "id" in r.data) router.push(`/admin/pengguna/${r.data.id}`);
        },
    });
    const g = (k: string) => (state && !state.ok ? state.galat?.[k] : undefined);

    return (
        <form
            onSubmit={onSubmit}
            className="grid max-w-3xl gap-4 rounded-xl border bg-card p-5 sm:grid-cols-2"
            noValidate
        >
            {state && !state.ok && (
                <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger sm:col-span-2">
                    {state.pesan}
                </p>
            )}
            <Bidang
                label="NIP atau username"
                htmlFor="nip"
                galat={g("nip")}
                bantuan="Dipakai untuk masuk. Huruf kecil, tanpa spasi."
            >
                <Input id="nip" name="nip" defaultValue={nilai.nip} required maxLength={32} autoComplete="off" />
            </Bidang>
            <Bidang label="Nama" htmlFor="name" galat={g("name")}>
                <Input id="name" name="name" defaultValue={nilai.name} required maxLength={120} />
            </Bidang>
            <Bidang label="Surel" htmlFor="email" galat={g("email")} bantuan="Disimpan, tidak dipakai untuk masuk.">
                <Input id="email" name="email" type="email" defaultValue={nilai.email ?? ""} maxLength={190} />
            </Bidang>
            <Bidang
                label="Peran"
                htmlFor="role"
                galat={g("role")}
                bantuan={diriSendiri ? "Anda tidak bisa mengubah peran akun sendiri." : undefined}
            >
                {diriSendiri && <input type="hidden" name="role" value={nilai.role} />}
                <Pilihan
                    id="role"
                    name={diriSendiri ? undefined : "role"}
                    defaultValue={nilai.role ?? "inspektur"}
                    disabled={diriSendiri}
                >
                    {ROLES.map((r) => (
                        <option key={r} value={r}>
                            {ROLE_LABEL[r]}
                        </option>
                    ))}
                </Pilihan>
            </Bidang>
            <Bidang label="Divisi" htmlFor="divisionId" galat={g("divisionId")}>
                <Pilihan id="divisionId" name="divisionId" defaultValue={nilai.divisionId ?? ""}>
                    <option value="">Tanpa divisi</option>
                    {divisi.map((d) => (
                        <option key={d.id} value={d.id}>
                            {d.nama}
                        </option>
                    ))}
                </Pilihan>
            </Bidang>
            <Bidang label="Jabatan" htmlFor="jabatan" galat={g("jabatan")}>
                <Input id="jabatan" name="jabatan" defaultValue={nilai.jabatan ?? ""} maxLength={120} />
            </Bidang>
            <Bidang
                label="Kata sandi"
                htmlFor="password"
                galat={g("password")}
                bantuan={baru ? "8–128 karakter." : "Kosongkan untuk mempertahankan sandi saat ini."}
            >
                <Input id="password" name="password" type="password" autoComplete="new-password" maxLength={128} />
            </Bidang>
            <div className="flex items-center gap-2 self-end pb-1.5">
                {diriSendiri && <input type="hidden" name="aktif" value="on" />}
                <Checkbox
                    id="aktif"
                    name={diriSendiri ? undefined : "aktif"}
                    defaultChecked={nilai.aktif ?? true}
                    disabled={diriSendiri}
                />
                <label htmlFor="aktif" className="text-sm">
                    Akun aktif
                </label>
            </div>
            <div className="flex justify-end gap-2 sm:col-span-2">
                <Button type="button" variant="outline" onClick={() => router.push("/admin/pengguna")}>
                    Batal
                </Button>
                <Button type="submit" variant="brand" disabled={menunggu}>
                    {menunggu ? "Menyimpan…" : baru ? "Simpan akun" : "Simpan perubahan"}
                </Button>
            </div>
        </form>
    );
}
