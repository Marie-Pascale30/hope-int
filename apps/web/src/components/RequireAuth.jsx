"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { localizePath } from "../i18n/config";
import { useAuth } from "../context/AuthContext";
import { can } from "../utils/rbac";
import { Button, LoadingState, EmptyState } from "./ui";

// Protege une page : redirige vers la connexion si besoin, affiche un refus si une permission manque.
export default function RequireAuth({ children, permission, permissions = [] }) {
  const { status, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations("ui.auth");
  const required = permission ? [permission, ...permissions] : permissions;

  useEffect(() => {
    if (status === "anonymous") {
      router.replace(localizePath(locale, `/connexion?next=${encodeURIComponent(pathname)}`));
    }
  }, [status, router, pathname, locale]);

  if (status !== "authenticated") {
    return <LoadingState label={t("checking")} />;
  }

  if (required.length && !can(user, ...required)) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title={t("deniedTitle")}
        description={t("deniedText")}
        action={<Button href={localizePath(locale, "/")}>{t("backHome")}</Button>}
      />
    );
  }

  return children;
}
