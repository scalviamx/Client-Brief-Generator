import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Scalvia Brief Generator",
  description: "Local client call processor for Scalvia.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
