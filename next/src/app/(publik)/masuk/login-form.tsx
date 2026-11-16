"use client";

import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { masuk, type MasukState } from "./actions";

export function LoginForm({ callbackUrl, demo }: { callbackUrl?: string; demo: boolean }) {
  const [state, action, pending] = useActionState<MasukState, FormData>(masuk, {});
  const [lihat, setLihat] = useState(false);

  return (
    <form action={action} noValidate className="space-y-5">
      <input type="hidden" name="callbackUrl" value={callbackUrl ?? ""} />
      <div className="space-y-2">
        <Label htmlFor="nip">{demo ? "NIP atau nama pengguna" : "NIP"}</Label>
        <Input
          id="nip"
          name="nip"
          defaultValue={state.nip}
          autoComplete="username"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          required
          maxLength={32}
          placeholder={demo ? "Contoh: inspektur" : "Masukkan NIP Anda"}
          className="h-12"
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? "galat-masuk" : undefined}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Kata sandi</Label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={lihat ? "text" : "password"}
            autoComplete="current-password"
            required
            placeholder="Masukkan kata sandi"
            className="h-12 pr-12"
            aria-invalid={state.error ? true : undefined}
          />
          <button
            type="button"
            onClick={() => setLihat((v) => !v)}
            className="absolute inset-y-0 right-0 grid w-12 place-items-center text-muted-foreground hover:text-foreground"
            aria-label={lihat ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
            aria-pressed={lihat}
          >
            {lihat ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>
      {state.error && (
        <p id="galat-masuk" role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      <Button type="submit" variant="brand" size="lg" className="h-12 w-full justify-between px-5" disabled={pending}>
        {pending ? "Memeriksa…" : "Masuk"}
        <ArrowRight className="size-4" aria-hidden />
      </Button>
    </form>
  );
}
