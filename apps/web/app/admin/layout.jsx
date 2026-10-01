import AdminShell from "@/src/components/admin/AdminShell";

export const metadata = {
  title: { default: "Administration", template: "%s · Administration HOPE" },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }) {
  return <AdminShell>{children}</AdminShell>;
}
