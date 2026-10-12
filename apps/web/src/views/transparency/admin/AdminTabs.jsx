"use client";

// Sous-navigation des ecrans "Transparence" du back-office (budget, publication, portraits).
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/src/context/AuthContext";
import { can, PERMISSIONS as P } from "@/src/utils/rbac";

export const TRANSPARENCY_ADMIN_LINKS = [
  { href: "/admin/budget", key: "budget", permission: P.MANAGE_FINANCE },
  { href: "/admin/budget/publication", key: "publication", permission: P.MANAGE_FINANCE },
  { href: "/admin/budget/equipe", key: "team", permission: P.MANAGE_HR },
];

export default function AdminTabs() {
  const t = useTranslations("transparency.admin.tabs");
  const pathname = usePathname();
  const { user } = useAuth();
  const links = TRANSPARENCY_ADMIN_LINKS.filter((link) => can(user, link.permission));
  if (links.length < 2) return null;
  return (
    <nav className="tp-admin-tabs" aria-label={t("label")}>
      {links.map((link) => (
        <Link key={link.href} href={link.href} className={pathname === link.href ? "is-active" : undefined} aria-current={pathname === link.href ? "page" : undefined}>
          {t(link.key)}
        </Link>
      ))}
    </nav>
  );
}
