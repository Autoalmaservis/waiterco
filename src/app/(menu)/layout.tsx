import type { Metadata, Viewport } from "next"

export const metadata: Metadata = {
  title: "Waiterco – Digitálne menu",
  description: "Objednajte si jedlo a sledujte stav objednávky priamo na vašom stole.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Waiterco",
  },
  formatDetection: { telephone: false },
  openGraph: {
    type: "website",
    title: "Waiterco",
    description: "Digitálne menu a online objednávanie",
  },
}

export const viewport: Viewport = {
  themeColor: "#E85B1A",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function MenuLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
