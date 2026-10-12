import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { NotFoundIllustration } from "@/src/components/illustrations";

export default async function AdminNotFound() {
  const t = await getTranslations("errors");
  return (
    <div className="state">
      <NotFoundIllustration className="illustration--sm" />
      <span className="state__title">{t("notFoundTitle")}</span>
      <p className="muted" style={{ maxWidth: 440, margin: 0 }}>{t("notFoundText")}</p>
      <Link href="/admin" className="btn btn--secondary">{t("backAdmin")}</Link>
    </div>
  );
}
