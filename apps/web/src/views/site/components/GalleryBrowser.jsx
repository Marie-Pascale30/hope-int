"use client";

// Albums de la page Galerie avec filtre par annee (onglets). Donnees preparees cote serveur
// (src/views/site/gallery.js : galleryAlbums) : titres, lieux, dates et textes alternatifs traduits.
import { useState } from "react";
import { CalendarDays, Images, MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import { TabPanel, Tabs } from "@/src/components/ui/Tabs";
import PhotoGallery from "@/src/components/site/PhotoGallery";

const ALL = "all";

export default function GalleryBrowser({ albums, years }) {
  const t = useTranslations("site.gallery");
  const [year, setYear] = useState(ALL);
  const photosOf = (list) => list.reduce((sum, album) => sum + album.items.length, 0);
  const visible = year === ALL ? albums : albums.filter((album) => album.year === year);

  const tabs = [
    { value: ALL, label: t("allYears"), count: photosOf(albums) },
    ...years.map((value) => ({ value, label: String(value), count: photosOf(albums.filter((album) => album.year === value)) })),
  ];

  return (
    <>
      <div className="pub-filters">
        <Tabs id="galerie-annees" tabs={tabs} value={year} onChange={setYear} label={t("filterLabel")} />
      </div>
      <p className="pub-count" aria-live="polite">
        {t("status", { photos: photosOf(visible), albums: visible.length })}
      </p>
      <TabPanel tabsId="galerie-annees" value={year} className="gallery-albums">
        {visible.map((album) => (
          <section key={album.key} id={`album-${album.key}`} className="gallery-album" aria-labelledby={`album-${album.key}-title`}>
            <header className="gallery-album__head">
              <h2 id={`album-${album.key}-title`}>{album.title}</h2>
              <p className="gallery-album__meta">
                <span><MapPin aria-hidden="true" /> {album.place}</span>
                <span><CalendarDays aria-hidden="true" /> <time dateTime={album.dateTime}>{album.date}</time></span>
                <span><Images aria-hidden="true" /> {t("photoCount", { count: album.items.length })}</span>
              </p>
              <p className="gallery-album__caption">{album.caption}</p>
            </header>
            <PhotoGallery items={album.items} label={t("albumLabel", { title: album.title })} />
          </section>
        ))}
      </TabPanel>
    </>
  );
}
