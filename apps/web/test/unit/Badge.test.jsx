import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Badge, StatusBadge } from "@/src/components/ui/Display";
import { makeLabels } from "@/src/utils/labels";
import { message, renderWithIntl, translator } from "../intl";

describe("Badge", () => {
  it("applique la tonalite et la variante", () => {
    renderWithIntl(
      <Badge tone="success" plain className="extra">
        Actif
      </Badge>
    );
    expect(screen.getByText("Actif")).toHaveClass("badge", "badge--success", "badge--plain", "extra");
  });

  it("reste neutre sans tonalite", () => {
    renderWithIntl(<Badge>Neutre</Badge>);
    expect(screen.getByText("Neutre").className).toBe("badge");
  });
});

describe("StatusBadge", () => {
  it("affiche le libelle traduit d'un statut de don", () => {
    const labels = makeLabels(translator("labels"));
    renderWithIntl(<StatusBadge status={labels.status("paymentStatus", "refunded")} />);
    expect(screen.getByText(message("labels.paymentStatus.refunded"))).toHaveClass("badge--info");
  });

  it("n'affiche rien sans statut", () => {
    const { container } = renderWithIntl(<StatusBadge status={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
