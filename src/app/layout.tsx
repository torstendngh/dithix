import type { Metadata } from "next";
import "./globals.css";
import { cn } from "@/lib/tailwind-utils";
import fonts from "@/lib/fonts";

export const metadata: Metadata = {
  title: "dithix",
  description: "dithix - created with create-genesis",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn(fonts, "h-full antialiased")}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
