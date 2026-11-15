import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

// Self-hosted variable fonts (latin subset, woff2).
// Previously loaded via next/font/google, which requires a network fetch at
// build time and broke under Turbopack with:
//   "Module not found: Can't resolve '@vercel/turbopack-next/internal/font/google/font'"
// Local files remove that build-time dependency entirely while keeping the
// exact same CSS variables, so globals.css is unchanged.
const orbitron = localFont({
  src: "./fonts/orbitron-variable.woff2",
  variable: "--font-orbitron",
  weight: "400 900",
  display: "swap",
});

const spaceGrotesk = localFont({
  src: "./fonts/space-grotesk-variable.woff2",
  variable: "--font-space-grotesk",
  weight: "300 700",
  display: "swap",
});

const jetbrainsMono = localFont({
  src: "./fonts/jetbrains-mono-variable.woff2",
  variable: "--font-jetbrains",
  weight: "100 800",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Mission Control: Beyond Earth — Space Mission Design Simulator",
  description:
    "An educational space mission design simulator. Select a mission, engineer a spacecraft, balance budget, mass, fuel and power, then fly the mission and earn your score out of 1,000.",
  keywords: [
    "space mission design",
    "educational game",
    "NASA Space Apps Challenge",
    "spacecraft engineer simulator",
    "mission control",
  ],
  authors: [{ name: "Mission Control: Beyond Earth team" }],
  openGraph: {
    title: "Mission Control: Beyond Earth",
    description:
      "Design spacecraft, balance real engineering trade-offs and fly missions across the solar system.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#04070f",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${orbitron.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} antialiased bg-background text-foreground min-h-screen flex flex-col`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
