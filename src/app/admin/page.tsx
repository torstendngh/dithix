import type { Metadata } from "next";
import { AdminPanel } from "@/components/gallery/admin-panel";

export const metadata: Metadata = {
  title: "dithix · gallery review",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return <AdminPanel />;
}
