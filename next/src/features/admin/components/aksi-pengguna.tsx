"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { aturAktifPengguna, terbitkanSandi } from "../actions/pengguna";

/** Aktifkan/nonaktifkan dari daftar. Petugas tidak pernah dihapus (SPEC §1.1). */
export function TombolAktif({ id, aktif, nama }: { id: number; aktif: boolean; nama: string }) {
    const [menunggu, mulai] = useTransition();
    return (
        <Button
            type="button"
            size="xs"
            variant={aktif ? "ghost" : "outline"}
            disabled={menunggu}
            aria-label={`${aktif ? "Nonaktifkan" : "Aktifkan"} ${nama}`}
            onClick={() =>
                mulai(async () => {
                    const r = await aturAktifPengguna(id, !aktif);
                    if (r.ok) toast.success(r.pesan ?? "Tersimpan.");
                    else toast.error(r.pesan);
                })
            }
        >
            {aktif ? "Nonaktifkan" : "Aktifkan"}
        </Button>
    );
}

/** "Terbitkan sandi baru" (A11): sandi tampil SEKALI di dialog ini, lalu hilang. */
export function TerbitkanSandi({ id, nama }: { id: number; nama: string }) {
    const [menunggu, mulai] = useTransition();
    const [hasil, setHasil] = useState<{ sandi: string; nip: string } | null>(null);
    return (
        <>
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button type="button" variant="outline" disabled={menunggu}>
                        Terbitkan sandi baru
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Terbitkan sandi baru untuk {nama}?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Sandi lama langsung tidak berlaku. Sandi baru hanya ditampilkan sekali; sampaikan langsung
                            kepada pemilik akun.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() =>
                                mulai(async () => {
                                    const r = await terbitkanSandi(id);
                                    if (r.ok && r.data) setHasil(r.data);
                                    else if (!r.ok) toast.error(r.pesan);
                                })
                            }
                        >
                            Terbitkan
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <Dialog open={hasil !== null} onOpenChange={(o) => !o && setHasil(null)}>
                <DialogContent showCloseButton={false}>
                    <DialogHeader>
                        <DialogTitle>Sandi baru untuk {hasil?.nip}</DialogTitle>
                        <DialogDescription>Catat sekarang. Sandi ini tidak akan ditampilkan lagi.</DialogDescription>
                    </DialogHeader>
                    <output
                        aria-label="Sandi baru"
                        className="block rounded-lg bg-muted px-4 py-3 text-center font-mono text-xl tracking-wider select-all"
                    >
                        {hasil?.sandi}
                    </output>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() =>
                                hasil &&
                                navigator.clipboard.writeText(hasil.sandi).then(() => toast.success("Sandi disalin."))
                            }
                        >
                            Salin
                        </Button>
                        <Button type="button" onClick={() => setHasil(null)}>
                            Selesai
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
