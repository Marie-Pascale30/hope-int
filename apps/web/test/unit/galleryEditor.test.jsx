import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { fireEvent, screen, within } from "@testing-library/react";
import GalleryEditor from "@/src/views/admin/components/GalleryEditor";
import { renderWithIntl } from "../intl";

vi.mock("@/src/services", () => ({
  adminApi: { uploadImage: vi.fn(async () => ({ url: "/uploads/1700000000000-1.png" })) },
}));

const LIVRET = [
  { src: "/images/livret/p06_01.jpg", width: 616, height: 570, kind: "photo" },
  { src: "/images/livret/p06_02.jpg", width: 606, height: 530, kind: "photo" },
  { src: "/uploads/a.png", width: 800, height: 600 },
];

// Editeur controle, avec la valeur courante exposee pour les assertions.
function setup(initial = LIVRET) {
  const state = { current: initial };
  function Harness() {
    const [value, setValue] = useState(initial);
    state.current = value;
    return <GalleryEditor value={value} onChange={setValue} title="Projet test" />;
  }
  renderWithIntl(<Harness />);
  return state;
}

describe("GalleryEditor (administration)", () => {
  it("affiche les photos dans l'ordre avec des boutons accessibles", () => {
    setup();
    const list = screen.getByRole("list", { name: "Photos de la galerie" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByRole("button", { name: "Monter la photo 1" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Descendre la photo 3" })).toBeDisabled();
    expect(screen.getByText("3 photos")).toBeInTheDocument();
  });

  it("deplace et retire des photos", () => {
    const state = setup();
    fireEvent.click(screen.getByRole("button", { name: "Descendre la photo 1" }));
    expect(state.current.map((entry) => entry.src)).toEqual([LIVRET[1].src, LIVRET[0].src, LIVRET[2].src]);
    fireEvent.click(screen.getByRole("button", { name: "Monter la photo 3" }));
    expect(state.current.map((entry) => entry.src)).toEqual([LIVRET[1].src, LIVRET[2].src, LIVRET[0].src]);
    fireEvent.click(screen.getByRole("button", { name: "Retirer la photo 2" }));
    expect(state.current.map((entry) => entry.src)).toEqual([LIVRET[1].src, LIVRET[0].src]);
    expect(screen.getByRole("status")).toHaveTextContent("Photo 2 retirée de la galerie.");
  });

  it("ajoute des photos depuis la phototheque du livret, deja presentes signalees", () => {
    const state = setup([LIVRET[0]]);
    fireEvent.click(screen.getByRole("button", { name: "Ajouter depuis la photothèque du livret" }));
    const dialog = screen.getByRole("dialog", { name: "Photothèque du livret" });
    fireEvent.change(within(dialog).getByLabelText("Album"), { target: { value: "rentree-2021-balessing" } });
    const boxes = within(dialog).getAllByRole("checkbox");
    expect(boxes).toHaveLength(7);
    expect(boxes[0]).toBeChecked();
    expect(boxes[0]).toBeDisabled();
    expect(within(dialog).getByText("Déjà dans la galerie")).toBeInTheDocument();
    fireEvent.click(boxes[2]);
    fireEvent.click(boxes[1]);
    expect(within(dialog).getByText("2 photos sélectionnées")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Ajouter 2 photos" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(state.current.map((entry) => entry.src)).toEqual([
      "/images/livret/p06_01.jpg", "/images/livret/p06_02.jpg", "/images/livret/p06_03.jpg",
    ]);
    expect(state.current[1]).toEqual({ src: "/images/livret/p06_02.jpg", width: 606, height: 530, kind: "photo" });
  });

  it("ferme la phototheque avec Echap sans toucher a la galerie", () => {
    const state = setup([]);
    expect(screen.getByText("Aucune photo dans la galerie pour l'instant.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ajouter depuis la photothèque du livret" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(state.current).toEqual([]);
  });
});
