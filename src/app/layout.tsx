import type { Metadata } from "next";
import "./globals.css";
import { cn } from "@/lib/tailwind-utils";
import fonts from "@/lib/fonts";

export const metadata: Metadata = {
  title: "dithix",
  description: "dithix — image dithering in the browser",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn(fonts, "dark h-full antialiased")}>
      <body className="flex h-full min-h-full flex-col overflow-hidden font-mono text-xs">
        {children}
      </body>
    </html>
  );
}
