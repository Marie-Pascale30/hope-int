import { afterEach, describe, expect, it, vi } from "vitest";
import { getFormatters } from "@/src/utils/format";
import {
  campaignPercent, cx, eventTimeRange, euros, hasCampaign, imageSrc, isPast, isUnoptimizedImage,
  paragraphs, PLACEHOLDER, spotsStatus,
} from "@/src/views/site/components/helpers";
import { translator } from "../intl";

const f = getFormatters("fr");
const plain = (value) => value.replace(/[  ]/g, " ");

describe("images", () => {
  it("remplace une image absente par l'illustration par defaut", () => {
    expect(imageSrc(null)).toBe(PLACEHOLDER);
    expect(imageSrc("/uploads/a.jpg")).toBe("http://localhost:5000/uploads/a.jpg");
  });

  it("n'optimise ni les SVG ni les images d'une API locale", () => {
    expect(isUnoptimizedImage("/images/x.svg?v=2")).toBe(true);
    expect(isUnoptimizedImage("http://localhost:5000/uploads/a.jpg")).toBe(true);
    expect(isUnoptimizedImage("/images/photo.jpg")).toBe(false);
    expect(isUnoptimizedImage("")).toBe(true);
  });
});

describe("campagnes", () => {
  it("detecte une campagne active", () => {
    expect(hasCampaign({ goal_amount: 1000, status: "en_cours" })).toBe(true);
    expect(hasCampaign({ goal_amount: 1000, status: "termine" })).toBe(false);
    expect(hasCampaign({ goal_amount: null })).toBe(false);
    expect(hasCampaign(undefined)).toBe(false);
  });

  it("calcule la progression (valeur fournie par l'API prioritaire)", () => {
    expect(campaignPercent({ progress: 42 })).toBe(42);
    expect(campaignPercent({ goal_amount: 200, raised_eur: 50 })).toBe(25);
    expect(campaignPercent({ goal_amount: 0, raised_eur: 50 })).toBe(0);
  });

  it("arrondit les montants en euros", () => {
    expect(plain(euros(f, 12.6))).toBe("13 €");
  });
});

describe("evenements", () => {
  const t = translator("site.spots");

  afterEach(() => vi.useRealTimers());

  it("indique les places restantes avec une tonalite", () => {
    expect(spotsStatus({ remaining_spots: null }, t).tone).toBe("brand");
    expect(spotsStatus({ remaining_spots: 0 }, t).tone).toBe("danger");
    expect(spotsStatus({ remaining_spots: 3 }, t).tone).toBe("warning");
    expect(spotsStatus({ remaining_spots: 3 }, t).label).toContain("3");
    expect(spotsStatus({ remaining_spots: 20 }, t).tone).toBe("info");
  });

  it("formate la plage horaire sur un ou plusieurs jours", () => {
    expect(eventTimeRange({ start_at: "2026-05-10T07:00:00Z", end_at: "2026-05-10T11:00:00Z" }, f)).toBe("08:00 – 12:00");
    expect(eventTimeRange({ start_at: "2026-05-10T07:00:00Z" }, f)).toBe("08:00");
    expect(eventTimeRange({ start_at: "2026-05-10T07:00:00Z", end_at: "2026-05-11T16:00:00Z" }, f)).toBe(
      "08:00 → 11 mai 2026 17:00"
    );
  });

  it("detecte un evenement passe", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T00:00:00Z"));
    expect(isPast({ start_at: "2026-05-01T08:00:00Z" })).toBe(true);
    expect(isPast({ start_at: "2026-05-01T08:00:00Z", end_at: "2026-07-01T08:00:00Z" })).toBe(false);
    expect(isPast({})).toBe(false);
  });
});

describe("utilitaires", () => {
  it("assemble les classes CSS", () => {
    expect(cx("a", false, null, "b")).toBe("a b");
  });

  it("decoupe un texte en paragraphes", () => {
    expect(paragraphs("Un\nmeme paragraphe\n\n  Deux  \n \n\nTrois")).toEqual(["Un\nmeme paragraphe", "Deux", "Trois"]);
    expect(paragraphs(null)).toEqual([]);
  });
});
