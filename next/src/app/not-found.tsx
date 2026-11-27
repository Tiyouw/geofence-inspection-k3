import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-muted px-6 text-center">
      <div>
        <p className="text-sm font-semibold text-muted-foreground">404</p>
        <h1 className="mt-2 text-2xl font-semibold">Halaman tidak ditemukan</h1>
        <p className="mt-2 text-sm text-muted-foreground">Halaman ini belum ada atau sudah dipindahkan.</p>
        <Link href="/" className="mt-6 inline-block text-sm font-semibold underline underline-offset-4">
          Kembali ke beranda
        </Link>
      </div>
    </main>
  );
}
