import { describe, expect, it, vi } from "vitest";

// next-intl/navigation charge next/navigation (indisponible hors de Next) : version simplifiee.
vi.mock("@/src/i18n/navigation", () => ({
  useLocalePath: () => (path) => path,
  Link: ({ href, children, ...props }) => <a href={href} {...props}>{children}</a>,
}));
import { screen } from "@testing-library/react";
import NewsDetailView from "@/src/views/site/NewsDetailView";
import { renderWithIntl } from "../intl";

describe("photos d'une actualite", () => {
  it("rend la galerie d'une actualite (chaine JSON)", () => {
    const gallery = JSON.stringify([{ src: "/images/livret/p12_06.jpg", width: 645, height: 618 }, { src: "/images/livret/p12_07.jpg", width: 688, height: 613 }]);
    renderWithIntl(<NewsDetailView item={{ id: 1, title: "Noël", content: "Texte", created_at: "2023-12-22T10:00:00Z", image_url: "/images/livret/p12_12.jpg", gallery }} />);
    expect(screen.getByRole("heading", { name: "Photos" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Mère Teresa/ })).toHaveLength(2);
  });
  it("n'affiche rien sans galerie", () => {
    renderWithIntl(<NewsDetailView item={{ id: 1, title: "Noël", content: "Texte", created_at: "2023-12-22T10:00:00Z", gallery: null }} />);
    expect(screen.queryByRole("heading", { name: "Photos" })).toBeNull();
  });
});
