import type { Metadata } from "next"
import { Geist_Mono, Inter } from "next/font/google"
import { Toaster } from "sonner"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { AppBackground } from "@/components/app-background"
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Koinonia",
  description:
    "Gather a few friends, share what's on your heart, and pray together.",
}

const inter = Inter({subsets:['latin'],variable:'--font-sans'})

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased", fontMono.variable, "font-sans", inter.variable)}
    >
      <body>
        <ThemeProvider>
          <AppBackground />
          {children}
          <Toaster
            position="bottom-center"
            closeButton
            richColors
            theme="system"
          />
        </ThemeProvider>
      </body>
    </html>
  )
}
