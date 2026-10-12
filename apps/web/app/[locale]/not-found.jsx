import "@/src/styles/public.css";
import { Compass, Home } from "lucide-react";
import { useTranslations } from "next-intl";
import { useLocalePath } from "@/src/i18n/navigation";
import { Button, EmptyState } from "@/src/components/ui";

// 404 du site public, dans la langue de l'URL.
export default function NotFound() {
  const t = useTranslations("site.notFound");
  const lp = useLocalePath();
  return (
    <div className="container section">
      <EmptyState
        icon={Compass}
        title={t("title")}
        description={t("text")}
        action={
          <div className="row" style={{ justifyContent: "center" }}>
            <Button href={lp("/")} icon={Home}>{t("home")}</Button>
            <Button href={lp("/projets")} variant="secondary">{t("projects")}</Button>
          </div>
        }
      />
    </div>
  );
}
