"use client";

import { startTransition, useActionState, type FormEvent } from "react";

/**
 * useActionState tanpa reset formulir otomatis React 19: masukan dipertahankan saat peladen
 * menolak isian (ACCEPTANCE G1/M3: "input dipertahankan").
 */
export function useFormAksi<R>(aksi: (prev: unknown, fd: FormData) => Promise<R>) {
  const [state, kirim, menunggu] = useActionState(aksi, null);
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => kirim(fd));
  };
  return { state, onSubmit, menunggu };
}
