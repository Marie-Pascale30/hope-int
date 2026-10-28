import { describe, expect, it, vi } from "vitest";

// next-intl/navigation charge next/navigation (indisponible hors de Next) : version simplifiee.
vi.mock("@/src/i18n/navigation", () => ({
  useLocalePath: () => (path) => path,
  Link: ({ href, children, ...props }) => <a href={href} {...props}>{children}</a>,
}));
import { fireEvent, screen } from "@testing-library/react";
import { REGIONS } from "@hope/shared/constants";
import transparencyFr from "@/src/i18n/messages/fr/transparency.json";
import { shareRows, parseYear, varianceTone, groupTeam } from "@/src/views/transparency/helpers";
import { MAP_HEIGHT, MAP_WIDTH, REGION_PATHS, REGION_SHAPES, centroid, intensity } from "@/src/components/map/cameroonRegions";
import CameroonMap from "@/src/components/map/CameroonMap";
import ImpactCalculator, { CALCULATOR_RANGES, impactFor } from "@/src/views/site/components/ImpactCalculator";
import { frameValue, easeOut } from "@/src/views/site/components/AnimatedCounter";
import { journalEntries } from "@/src/views/site/components/FieldJournal";
import { frMessages, renderWithIntl } from "../intl";

const messages = { ...frMessages, ...transparencyFr };

describe("repartitions de la page Transparence", () => {
  it("calcule les parts, trie par montant et ignore les montants nuls", () => {
    const rows = shareRows(
      [{ method: "card", amountEur: 25 }, { method: "mobile_money", amountEur: 75 }, { method: "other", amountEur: 0 }],
      (row) => row.method,
      (row) => row.method.toUpperCase()
    );
    expect(rows).toEqual([
      { key: "mobile_money", label: "MOBILE_MONEY", value: 75, percent: 75 },
      { key: "card", label: "CARD", value: 25, percent: 25 },
    ]);
    expect(shareRows([], () => "", () => "")).toEqual([]);
  });

  it("valide l'annee de l'URL", () => {
    expect(parseYear("2025")).toBe(2025);
    expect(parseYear("25")).toBeNull();
    expect(parseYear("2025abc")).toBeNull();
  });

  it("qualifie l'ecart prevu / realise", () => {
    expect(varianceTone(100, 120)).toBe("danger");
    expect(varianceTone(100, 90)).toBe("success");
    expect(varianceTone(100, 10)).toBe("info");
    expect(varianceTone(0, 5)).toBe("warning");
    expect(varianceTone(0, 0)).toBe("neutral");
  });

  it("separe l'equipe et les benevoles", () => {
    const { team, volunteers } = groupTeam([{ name: "A", group: "team" }, { name: "B", group: "volunteers" }]);
    expect(team.map((m) => m.name)).toEqual(["A"]);
    expect(volunteers.map((m) => m.name)).toEqual(["B"]);
  });
});

describe("carte des regions", () => {
  it("dessine exactement les 10 regions du referentiel, dans le cadre", () => {
    expect(REGION_SHAPES.map((shape) => shape.region).sort()).toEqual([...REGIONS].sort());
    for (const { d, center } of REGION_PATHS) {
      expect(d).toMatch(/^M[\d. ]+( L[\d. ]+)+ Z$/);
      expect(center[0]).toBeGreaterThan(0);
      expect(center[0]).toBeLessThan(MAP_WIDTH);
      expect(center[1]).toBeGreaterThan(0);
      expect(center[1]).toBeLessThan(MAP_HEIGHT);
    }
  });

  it("calcule le centre d'un carre et l'intensite", () => {
    expect(centroid([[9, 13], [10, 13], [10, 12], [9, 12]])).toEqual([44, 32]);
    expect(intensity(0, 5)).toBe(0);
    expect(intensity(1, 9)).toBe(1);
    expect(intensity(9, 9)).toBe(3);
  });

  it("rend chaque region comme un lien nomme vers les projets filtres", () => {
    const regions = REGIONS.map((region) => ({ region, projects: region === "Littoral" ? 3 : 0, events: region === "Littoral" ? 1 : 0 }));
    const { container } = renderWithIntl(<CameroonMap regions={regions} selected="Littoral" />, { messages });
    const links = container.querySelectorAll("svg a");
    expect(links).toHaveLength(10);
    const littoral = screen.getAllByRole("link", { name: "Littoral : 3 projets, 1 événement à venir" });
    expect(littoral[0].getAttribute("href")).toBe("/projets?region=Littoral#projets-liste");
    expect(littoral[0].getAttribute("aria-current")).toBe("true");
    expect(screen.getAllByRole("link", { name: /^Nord : aucun projet/ }).length).toBeGreaterThan(0);
  });
});

describe("calculateur d'impact", () => {
  it("reprend les paliers d'impact du parcours de don, en euros ou en francs CFA", () => {
    expect(impactFor(25, "eur").key).toBe("christmas");
    expect(impactFor(65595.7, "xaf").key).toBe("business");
    expect(impactFor(5, "eur").key).toBe("hygieneKit");
    expect(CALCULATOR_RANGES.xaf.min).toBeGreaterThanOrEqual(500);
  });

  it("met a jour l'equivalence quand le curseur bouge", () => {
    renderWithIntl(<ImpactCalculator />, { messages });
    const slider = screen.getByRole("slider");
    fireEvent.change(slider, { target: { value: "100" } });
    // Texte ICU avec montant formate ({grant}) : comparaison sur le debut de la phrase.
    const [before] = messages.account.donate.impact.business.split("{grant}");
    expect(screen.getByText((content) => content.startsWith(before))).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Francs CFA" }));
    expect(screen.getByRole("slider").getAttribute("max")).toBe(String(CALCULATOR_RANGES.xaf.max));
  });
});

describe("compteurs et journal de terrain", () => {
  it("anime avec une deceleration et finit sur la valeur exacte", () => {
    expect(easeOut(0)).toBe(0);
    expect(easeOut(1)).toBe(1);
    expect(frameValue(1000, 0)).toBe(0);
    expect(frameValue(1000, 0.5)).toBe(875);
    expect(frameValue(1000, 2)).toBe(1000);
  });

  it("ne garde que les actualites du projet, de la plus recente a la plus ancienne", () => {
    const news = [
      { id: 1, project_id: 7, created_at: "2025-01-01T10:00:00Z" },
      { id: 2, project_id: 8, created_at: "2025-02-01T10:00:00Z" },
      { id: 3, project_id: "7", created_at: "2025-03-01T10:00:00Z" },
    ];
    expect(journalEntries(news, 7).map((item) => item.id)).toEqual([3, 1]);
  });
});
