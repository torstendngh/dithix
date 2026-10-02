import { Inter, Geist_Mono } from "next/font/google";
import { cn } from "@/lib/tailwind-utils";

const regularSansFont = Inter({
  variable: "--font-regular-sans",
  subsets: ["latin"],
});

const regularMonoFont = Geist_Mono({
  variable: "--font-regular-mono",
  subsets: ["latin"],
});

export default cn(
  regularSansFont.variable,
  regularMonoFont.variable,
);
