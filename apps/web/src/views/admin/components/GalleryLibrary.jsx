"use client";

// Phototheque du livret partenaires (145 photos, @hope/shared/photos) : choix de photos a ajouter
// a une galerie, par album, avec cases a cocher. Les photos deja presentes sont signalees.
import { useMemo, useState } from "react";
import { Check, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button, Modal, Select } from "@/src/components/ui";
import { useFormat } from "@/src/i18n/format";
import { GALLERY_ALBUMS, albumDate, photoAlt, selectPhotos } from "@/src/views/site/gallery";

const ALL = "";
const TOTAL = GALLERY_ALBUMS.reduce((sum, album) => sum + album.photos.length, 0);

// selectedSrcs : adresses deja dans la galerie ; remaining : places encore disponibles.
export default function GalleryLibrary({ selectedSrcs, remaining, onClose, onAdd }) {
  const t = useTranslations("adminOps.contentForm.gallery.library");
  const tGallery = useTranslations("site.gallery");
  const f = useFormat();
  const [albumKey, setAlbumKey] = useState(ALL);
  const [picked, setPicked] = useState(() => new Set());

  const present = useMemo(() => new Set(selectedSrcs), [selectedSrcs]);
  const albums = useMemo(
    () => GALLERY_ALBUMS.map((album) => ({
      key: album.key,
      title: tGallery(`albums.${album.key}.title`),
      place: tGallery(`albums.${album.key}.place`),
      date: albumDate(album, f),
      photos: selectPhotos(album.key).map((photo) => ({ ...photo, alt: photoAlt(tGallery, photo) })),
    })),
    [tGallery, f]
  );
  const visible = albumKey ? albums.filter((album) => album.key === albumKey) : albums;
  const full = picked.size >= remaining;

  const toggle = (id) => {
    setPicked((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else if (next.size < remaining) next.add(id);
      return next;
    });
  };

  const selectVisible = () => {
    setPicked((previous) => {
      const next = new Set(previous);
      for (const album of visible) {
        for (const photo of album.photos) {
          if (next.size >= remaining) return next;
          if (!present.has(photo.src)) next.add(photo.id);
        }
      }
      return next;
    });
  };

  const add = () => {
    // Ordre de la phototheque (albums puis livret), quel que soit l'ordre des clics.
    const entries = albums
      .flatMap((album) => album.photos)
      .filter((photo) => picked.has(photo.id))
      .map(({ src, width, height, kind }) => ({ src, width, height, kind }));
    onAdd(entries);
  };

  const albumOptions = albums.map((album) => ({
    value: album.key,
    label: t("albumOption", { title: album.title, place: album.place, date: album.date, count: album.photos.length }),
  }));

  return (
    <Modal
      open
      large
      title={t("title")}
      onClose={onClose}
      footer={
        <>
          <span className="adm-library__count" aria-live="polite">{t("selected", { count: picked.size })}</span>
          <Button variant="ghost" onClick={onClose}>{t("cancel")}</Button>
          <Button icon={Plus} disabled={!picked.size} onClick={add}>{t("add", { count: picked.size })}</Button>
        </>
      }
    >
      <p className="adm-library__intro">{t("intro")}</p>
      <div className="adm-library__toolbar">
        <Select
          label={t("album")}
          placeholder={t("allAlbums", { count: TOTAL })}
          options={albumOptions}
          value={albumKey}
          onChange={(event) => setAlbumKey(event.target.value)}
        />
        <div className="adm-library__bulk">
          <Button size="sm" variant="secondary" icon={Check} disabled={full} onClick={selectVisible}>{t("selectAll")}</Button>
          <Button size="sm" variant="ghost" disabled={!picked.size} onClick={() => setPicked(new Set())}>{t("clear")}</Button>
        </div>
      </div>
      {full && <p className="field__hint" role="status">{t("limit", { count: remaining })}</p>}

      <div className="adm-library" aria-label={t("listLabel")} role="group">
        {visible.map((album) => (
          <fieldset key={album.key} className="adm-library__album">
            <legend className="adm-library__legend">
              {album.title} <span>· {album.place}, {album.date}</span>
            </legend>
            <ul className="adm-library__grid">
              {album.photos.map((photo) => {
                const already = present.has(photo.src);
                const checked = already || picked.has(photo.id);
                return (
                  <li key={photo.id}>
                    <label className={already ? "adm-library__item adm-library__item--present" : "adm-library__item"}>
                      <input
                        type="checkbox"
                        className="adm-library__check"
                        checked={checked}
                        disabled={already || (full && !checked)}
                        onChange={() => toggle(photo.id)}
                      />
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photo.src} alt={photo.alt} width={photo.width} height={photo.height} loading="lazy" decoding="async" />
                      {already && <span className="adm-library__badge">{t("already")}</span>}
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        ))}
      </div>
    </Modal>
  );
}
