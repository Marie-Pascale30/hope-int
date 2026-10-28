// Page "Galerie" (composant serveur, contenu statique) : les 145 photos du livret partenaires
// 2021-2025, classees par action (albums), avec filtre par annee et visionneuse.
// Textes : site.gallery (titres, lieux, legendes des albums et textes alternatifs).
import "../../styles/public.css";
import { Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import { hl } from "../../components/motion/hl";
import PageBanner from "../../components/site/PageBanner";
import { Button } from "../../components/ui";
import { useFormat } from "../../i18n/format";
import { useLocalePath } from "../../i18n/navigation";
import { PublicHero } from "./components";
import GalleryBrowser from "./components/GalleryBrowser";
import { GALLERY_YEARS, galleryAlbums } from "./gallery";

export default function GalleryView() {
  const t = useTranslations("site.gallery");
  const f = useFormat();
  const lp = useLocalePath();
  const albums = galleryAlbums(t, f);
  const photos = albums.reduce((sum, album) => sum + album.items.length, 0);

  return (
    <>
      <PageBanner name="gallery" />
      <PublicHero eyebrow={t("eyebrow")} title={t.rich("title", { hl })} lead={t("lead", { photos, albums: albums.length })} />

      <section className="section section--tight" aria-label={t("eyebrow")}>
        <div className="container">
          <GalleryBrowser albums={albums} years={GALLERY_YEARS} />
        </div>
      </section>

      <section className="section section--tight" aria-labelledby="gallery-cta-title">
        <div className="container">
          <div className="home-cta shine-border">
            <div>
              <h2 id="gallery-cta-title">{t.rich("cta.title", { hl })}</h2>
              <p>{t("cta.text")}</p>
            </div>
            <div className="home-cta__actions">
              <Button href={lp("/don")} variant="accent" size="lg" icon={Heart}>{t("cta.donate")}</Button>
              <Button href={lp("/rejoindre")} variant="light" size="lg">{t("cta.join")}</Button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
