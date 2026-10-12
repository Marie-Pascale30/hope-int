import "@/src/styles/public.css";
import { Home } from "lucide-react";
import { useTranslations } from "next-intl";
import { useLocalePath } from "@/src/i18n/navigation";
import { Button } from "@/src/components/ui";
import { NotFoundIllustration } from "@/src/components/illustrations";

// 404 du site public, dans la langue de l'URL, avec l'illustration de marque.
export default function NotFound() {
  const t = useTranslations("site.notFound");
  const lp = useLocalePath();
  return (
    <div className="container section">
      <div className="tp-empty">
        <NotFoundIllustration />
        <h1>{t("title")}</h1>
        <p>{t("text")}</p>
        <div className="row" style={{ justifyContent: "center" }}>
          <Button href={lp("/")} icon={Home}>{t("home")}</Button>
          <Button href={lp("/projets")} variant="secondary">{t("projects")}</Button>
        </div>
      </div>
    </div>
  );
}
