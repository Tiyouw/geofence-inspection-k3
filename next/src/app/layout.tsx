import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { ServiceWorkerRegister } from "@/components/shell/sw-register";
import "./globals.css";

const sans = Inter({ variable: "--font-sans", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--font-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Geofencing — Inspeksi K3 APAR", template: "%s — Inspeksi K3 APAR" },
  description: "Inspeksi APAR dan sarana K3 berbasis QR dan lokasi.",
  applicationName: "PAL-K3",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icons/icon.svg", apple: "/icons/icon-192.png" },
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "PAL-K3", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#031e25",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={`${sans.variable} ${mono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        {children}
        <Toaster richColors position="top-center" />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
