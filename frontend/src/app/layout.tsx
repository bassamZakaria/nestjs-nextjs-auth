import type { Metadata } from "next";
import { Bricolage_Grotesque } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const sans = Bricolage_Grotesque({
  variable: "--font-sans-face",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Auth module", template: "%s | Auth module" },
  description: "Sign up, sign in and a protected page.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={sans.variable}>
      <body className="antialiased">
        <main className="mx-auto flex min-h-dvh w-full max-w-md items-center px-4 py-10">
          {children}
        </main>
      </body>
    </html>
  );
}
