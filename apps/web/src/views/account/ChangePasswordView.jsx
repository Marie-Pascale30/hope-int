"use client";

import "../../styles/account.css";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Alert } from "../../components/ui";
import RequireAuth from "../../components/RequireAuth";
import { useAuth } from "../../context/AuthContext";
import { localizePath } from "../../i18n/config";
import { Link } from "../../i18n/navigation";
import { isStaff } from "../../utils/rbac";
import AuthCard from "./components/AuthCard";
import ChangePasswordForm from "./components/ChangePasswordForm";

function ChangePasswordContent() {
  const { user } = useAuth();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("account.changePassword");
  const required = user?.mustChangePassword;

  return (
    <AuthCard
      title={required ? t("requiredTitle") : t("title")}
      description={required ? t("requiredDescription") : t("description")}
      footer={required ? undefined : <Link href="/espace">{t("backToAccount")}</Link>}
    >
      {required && (
        <div className="acc-auth__alert">
          <Alert tone="info" title={t("welcome", { name: user.name.split(" ")[0] })}>
            {t("mandatory")}
          </Alert>
        </div>
      )}
      <ChangePasswordForm
        submitLabel={required ? t("saveAndContinue") : undefined}
        onDone={(nextUser) => router.replace(isStaff(nextUser) ? "/admin" : localizePath(locale, "/espace"))}
      />
    </AuthCard>
  );
}

export default function ChangePasswordView() {
  return (
    <RequireAuth>
      <ChangePasswordContent />
    </RequireAuth>
  );
}
