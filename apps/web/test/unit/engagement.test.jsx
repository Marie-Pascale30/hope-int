import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import engagementFr from "@/src/i18n/messages/fr/engagement.json";
import ConsentCheckboxes, { initialConsents } from "@/src/views/engagement/ConsentCheckboxes";
import SocialLinks from "@/src/views/engagement/SocialLinks";
import { isSafeSocialUrl, socialLinks } from "@/src/views/engagement/socialNetworks";
import { frMessages, renderWithIntl } from "../intl";

const messages = { ...frMessages, ...engagementFr };
const t = engagementFr.engagement;

describe("ConsentCheckboxes", () => {
  it("ne precoche jamais la newsletter (accord explicite)", () => {
    expect(initialConsents()).toEqual({ newsletter: false, project_news: true });
    renderWithIntl(<ConsentCheckboxes value={initialConsents()} onChange={() => {}} />, { messages });
    expect(screen.getByRole("checkbox", { name: t.consent.newsletter })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: t.consent.project_news })).toBeChecked();
    expect(screen.getByRole("group", { name: t.consent.legend })).toBeInTheDocument();
  });

  it("transmet la nouvelle valeur complete au changement", () => {
    const onChange = vi.fn();
    renderWithIntl(<ConsentCheckboxes value={initialConsents()} onChange={onChange} />, { messages });
    fireEvent.click(screen.getByRole("checkbox", { name: t.consent.newsletter }));
    expect(onChange).toHaveBeenCalledWith({ newsletter: true, project_news: true });
  });
});

describe("reseaux sociaux", () => {
  it("n'accepte que des URL https", () => {
    expect(isSafeSocialUrl("https://facebook.com/hope")).toBe(true);
    expect(isSafeSocialUrl("http://facebook.com/hope")).toBe(false);
    expect(isSafeSocialUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeSocialUrl("")).toBe(false);
    expect(socialLinks([
      ["facebook", "Facebook", "https://facebook.com/hope"],
      ["x", "X", undefined],
      ["youtube", "YouTube", "javascript:alert(1)"],
    ])).toEqual([{ id: "facebook", name: "Facebook", url: "https://facebook.com/hope" }]);
  });

  it("affiche les liens configures (nouvelle fenetre) et rien sinon", () => {
    const { container } = renderWithIntl(<SocialLinks links={[]} />, { messages });
    expect(container).toBeEmptyDOMElement();
    renderWithIntl(<SocialLinks links={[{ id: "instagram", name: "Instagram", url: "https://instagram.com/hope" }]} />, { messages });
    const link = screen.getByRole("link", { name: "Instagram (nouvelle fenêtre)" });
    expect(link).toHaveAttribute("href", "https://instagram.com/hope");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });
});
