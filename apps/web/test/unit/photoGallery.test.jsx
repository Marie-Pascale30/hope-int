import { beforeAll, describe, expect, it } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import PhotoGallery from "@/src/components/site/PhotoGallery";
import { getFormatters } from "@/src/utils/format";
import { galleryItems, selectPhotos } from "@/src/views/site/gallery";
import { renderWithIntl, translator } from "../intl";

// jsdom ne gere pas toujours <dialog>.showModal() : version minimale (attribut open).
beforeAll(() => {
  const proto = window.HTMLDialogElement?.prototype;
  if (proto && !proto.showModal) {
    proto.showModal = function showModal() { this.setAttribute("open", ""); };
    proto.close = function close() { this.removeAttribute("open"); };
  }
});

const items = galleryItems(translator("site.gallery"), getFormatters("fr"), selectPhotos("rentree-2021-balessing"));

describe("PhotoGallery et visionneuse", () => {
  it("affiche les premieres vignettes et un bouton pour la suite", () => {
    renderWithIntl(<PhotoGallery items={items} variant="strip" limit={5} label="Photos : Balessing" />);
    expect(screen.getByRole("list", { name: "Photos : Balessing" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rentrée scolaire à Balessing, Balessing (Ouest) — photo 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Voir les 2 autres photos" })).toBeInTheDocument();
  });

  it("ouvre la visionneuse, navigue au clavier et se ferme avec Echap", () => {
    const { container } = renderWithIntl(<PhotoGallery items={items} label="Photos : Balessing" />);
    fireEvent.click(screen.getByRole("button", { name: /photo 2$/ }));
    const dialog = container.querySelector("dialog.lightbox");
    expect(dialog).toHaveAttribute("open");
    expect(screen.getByText("Image 2 / 7")).toBeInTheDocument();
    fireEvent.keyDown(dialog, { key: "ArrowRight" });
    expect(screen.getByText("Image 3 / 7")).toBeInTheDocument();
    fireEvent.keyDown(dialog, { key: "ArrowLeft" });
    fireEvent.keyDown(dialog, { key: "ArrowLeft" });
    fireEvent.keyDown(dialog, { key: "ArrowLeft" });
    expect(screen.getByText("Image 7 / 7")).toBeInTheDocument();
    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    expect(dialog).not.toHaveAttribute("open");
  });
});
