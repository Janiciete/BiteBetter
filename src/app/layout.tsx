import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BetterBites",
  description: "Healthier recipes made for you",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#FAF8F3] text-[#253238] antialiased">{children}</body>
    </html>
  );
}
