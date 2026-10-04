import "@/src/styles/public.css";
import { Compass, Home } from "lucide-react";
import { useTranslations } from "next-intl";
import { useLocalePath } from "@/src/i18n/navigation";
import { Empty, LinkButton } from "@/src/views/site/components";

// 404 du site public, dans la langue de l'URL.
export default function NotFound() {
  const t = useTranslations("site.notFound");
  const lp = useLocalePath();
  return (
    <div className="container section">
      <Empty
        icon={Compass}
        title={t("title")}
        description={t("text")}
        action={
          <div className="row" style={{ justifyContent: "center" }}>
            <LinkButton href={lp("/")} icon={Home}>{t("home")}</LinkButton>
            <LinkButton href={lp("/projets")} variant="secondary">{t("projects")}</LinkButton>
          </div>
        }
      />
    </div>
  );
}
