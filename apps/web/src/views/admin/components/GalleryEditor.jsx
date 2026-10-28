"use client";

// Edition de la galerie photos d'un projet ou d'une actualite (champ gallery) : vignettes dans
// l'ordre d'affichage, deplacement par boutons (pas de glisser-deposer seul), retrait, ajout depuis
// la phototheque du livret (@hope/shared/photos) ou envoi de nouvelles images (/admin/uploads/images).
import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowDown, ArrowUp, Images, Trash2, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/src/components/ui";
import { useFormat } from "@/src/i18n/format";
import { adminApi } from "@/src/services";
import { useAlerts } from "@/src/utils/alerts";
import { contentGallery } from "@/src/views/site/gallery";
import { IMAGE_ACCEPT, IMAGE_TYPES, MAX_IMAGE_SIZE, Thumb } from "./widgets";
import GalleryLibrary from "./GalleryLibrary";

// Meme limite que l'API (utils/gallery.js).
export const GALLERY_MAX = 200;

// Dimensions d'une image locale (avant envoi) ; null si le navigateur ne sait pas la lire.
function readDimensions(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const image = new window.Image();
    image.onload = () => {
      resolve(image.naturalWidth && image.naturalHeight ? { width: image.naturalWidth, height: image.naturalHeight } : null);
      URL.revokeObjectURL(url);
    };
    image.onerror = () => {
      resolve(null);
      URL.revokeObjectURL(url);
    };
    image.src = url;
  });
}

// value : [{ src, width?, height?, kind? }] ; title : titre du contenu (textes alternatifs).
export default function GalleryEditor({ value, onChange, title }) {
  const t = useTranslations("adminOps.contentForm.gallery");
  const tGallery = useTranslations("site.gallery");
  const tImage = useTranslations("adminOps.image");
  const f = useFormat();
  const { showError } = useAlerts();
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [progress, setProgress] = useState(null); // { done, total } pendant l'envoi
  const [announce, setAnnounce] = useState("");
  const listRef = useRef(null);
  const libraryButtonRef = useRef(null);

  const total = value.length;
  const remaining = Math.max(0, GALLERY_MAX - total);
  // Textes alternatifs : catalogue du livret, sinon "<titre> — photo n".
  const items = useMemo(() => contentGallery(tGallery, f, value, title || t("listLabel")), [tGallery, f, value, title, t]);

  // Focus apres un deplacement ou un retrait (les boutons changent de position).
  const focusControl = (index, action) => {
    window.requestAnimationFrame(() => {
      const list = listRef.current;
      const target = list?.querySelector(`[data-index="${index}"][data-action="${action}"]:not([disabled])`)
        || list?.querySelector(`[data-index="${index}"][data-action="remove"]`)
        || libraryButtonRef.current;
      target?.focus();
    });
  };

  const move = (from, to) => {
    if (to < 0 || to >= total) return;
    const next = [...value];
    const [entry] = next.splice(from, 1);
    next.splice(to, 0, entry);
    onChange(next);
    setAnnounce(t("moved", { index: to + 1, total }));
    focusControl(to, to < from ? "up" : "down");
  };

  const remove = (index) => {
    onChange(value.filter((_, position) => position !== index));
    setAnnounce(t("removed", { index: index + 1 }));
    focusControl(Math.min(index, total - 2), "remove");
  };

  const addEntries = (entries) => {
    const added = entries.slice(0, remaining);
    if (!added.length) return;
    onChange([...value, ...added]);
    setAnnounce(t("added", { count: added.length }));
  };

  const onFiles = async (event) => {
    const files = [...(event.target.files || [])];
    event.target.value = "";
    if (!files.length) return;
    const accepted = files.slice(0, remaining);
    const failed = [];
    const uploaded = [];
    setProgress({ done: 0, total: accepted.length });
    for (const [index, file] of accepted.entries()) {
      setProgress({ done: index + 1, total: accepted.length });
      if (!IMAGE_TYPES.includes(file.type) || file.size > MAX_IMAGE_SIZE) {
        failed.push(file.name);
        continue;
      }
      try {
        const dimensions = await readDimensions(file);
        const { url } = await adminApi.uploadImage(file);
        uploaded.push({ src: url, ...(dimensions || {}) });
      } catch {
        failed.push(file.name);
      }
    }
    setProgress(null);
    if (uploaded.length) addEntries(uploaded);
    const skipped = files.slice(accepted.length).map((file) => file.name);
    if (failed.length || skipped.length) {
      const names = [...failed, ...skipped];
      showError(t("uploadFailed"), `${t("uploadFailedText", { count: names.length, names: names.join(", ") })} ${tImage("formatText")} ${tImage("sizeText", { max: 5 })}`);
    }
  };

  const closeLibrary = () => {
    setLibraryOpen(false);
  };

  return (
    <div className="field field--full adm-gallery-editor">
      <p className="field__hint adm-gallery-editor__hint">
        <strong>{t("count", { count: total })}</strong> · {t("hint", { max: GALLERY_MAX })}
      </p>

      {total ? (
        <ol className="adm-gallery" ref={listRef} aria-label={t("listLabel")}>
          {value.map((entry, index) => (
            <li key={`${entry.src}-${index}`} className="adm-gallery__item">
              <Thumb src={entry.src} alt={items[index]?.alt || t("photoAlt", { index: index + 1 })} className="adm-gallery__img" />
              <span className="adm-gallery__pos">{t("position", { index: index + 1, total })}</span>
              <div className="adm-gallery__actions">
                <Button
                  size="sm"
                  variant="ghost"
                  icon={ArrowUp}
                  aria-label={t("moveUp", { index: index + 1 })}
                  title={t("moveUp", { index: index + 1 })}
                  data-index={index}
                  data-action="up"
                  disabled={index === 0}
                  onClick={() => move(index, index - 1)}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  icon={ArrowDown}
                  aria-label={t("moveDown", { index: index + 1 })}
                  title={t("moveDown", { index: index + 1 })}
                  data-index={index}
                  data-action="down"
                  disabled={index === total - 1}
                  onClick={() => move(index, index + 1)}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  icon={Trash2}
                  className="adm-gallery__remove"
                  aria-label={t("remove", { index: index + 1 })}
                  title={t("remove", { index: index + 1 })}
                  data-index={index}
                  data-action="remove"
                  onClick={() => remove(index)}
                />
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <div className="adm-gallery__empty">{t("empty")}</div>
      )}

      <div className="adm-gallery-editor__toolbar">
        <Button
          ref={libraryButtonRef}
          size="sm"
          variant="secondary"
          icon={Images}
          aria-haspopup="dialog"
          disabled={!remaining || Boolean(progress)}
          onClick={() => setLibraryOpen(true)}
        >
          {t("fromLibrary")}
        </Button>
        <div className={progress || !remaining ? "adm-file adm-file--disabled" : "adm-file"}>
          <span className="btn btn--secondary btn--sm" aria-hidden="true">
            {progress ? <span className="spinner spinner--sm" aria-hidden="true" /> : <Upload aria-hidden="true" />} {t("upload")}
          </span>
          <input
            type="file"
            multiple
            accept={IMAGE_ACCEPT}
            onChange={onFiles}
            disabled={Boolean(progress) || !remaining}
            aria-label={t("upload")}
          />
        </div>
      </div>
      <p className="field__hint">{remaining ? t("uploadHint", { max: 5 }) : t("full", { max: GALLERY_MAX })}</p>
      <p className="visually-hidden" role="status" aria-live="polite">
        {progress ? t("uploading", progress) : announce}
      </p>

      {libraryOpen && typeof document !== "undefined" && createPortal(
        <GalleryLibrary
          selectedSrcs={value.map((entry) => entry.src)}
          remaining={remaining}
          onClose={closeLibrary}
          onAdd={(entries) => {
            addEntries(entries);
            closeLibrary();
          }}
        />,
        document.body
      )}
    </div>
  );
}
