import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Asymmetrical Macro Finder",
  description: "Editorial macro-risk dashboard powered by Macro Vault.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
