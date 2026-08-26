import { useState } from "react";

import "@/app/globals.css";
import SmartHtmlSelectionOverlay, {
  type SmartSelectionRect,
} from "@/app/(presentation-generator)/components/SmartHtmlSelectionOverlay";

const INITIAL_RECT: SmartSelectionRect = {
  left: 80,
  top: 90,
  width: 600,
  height: 60,
};

function OverlayHarness() {
  const [selected, setSelected] = useState(false);
  const [rect, setRect] = useState(INITIAL_RECT);

  return (
    <>
      <button data-cy="select" onClick={() => setSelected(true)}>
        Select
      </button>
      <button
        data-cy="move"
        onClick={() =>
          setRect((current) => ({
            ...current,
            left: current.left + 80,
            top: current.top + 30,
            width: current.width * 0.8,
            height: current.height * 0.8,
          }))
        }
      >
        Move slide
      </button>
      <SmartHtmlSelectionOverlay
        hoverRect={selected ? null : rect}
        selectionRect={selected ? rect : null}
      />
    </>
  );
}

describe("SmartHtmlSelectionOverlay", () => {
  it("stays simple and follows live selection bounds", () => {
    cy.mount(<OverlayHarness />);

    cy.get('[data-smart-selection-overlay="hover"]')
      .should("have.css", "border-top-style", "solid")
      .and("have.css", "border-top-width", "1px")
      .and("have.css", "border-radius", "0px")
      .and("have.css", "background-image", "none")
      .and("have.css", "box-shadow", "none");

    cy.get('[data-cy="select"]').click();
    cy.get('[data-smart-selection-overlay="hover"]').should("not.exist");
    cy.get('[data-smart-selection-overlay="selected"]')
      .should("contain.text", "AI edit")
      .then(($overlay) => {
        const bounds = $overlay[0].getBoundingClientRect();
        expect(bounds.left).to.be.closeTo(80, 1);
        expect(bounds.top).to.be.closeTo(90, 1);
        expect(bounds.width).to.be.closeTo(600, 1);
        expect(bounds.height).to.be.closeTo(60, 1);
      });

    cy.get('[data-cy="move"]').click();
    cy.get('[data-smart-selection-overlay="selected"]').then(($overlay) => {
      const bounds = $overlay[0].getBoundingClientRect();
      expect(bounds.left).to.be.closeTo(160, 1);
      expect(bounds.top).to.be.closeTo(120, 1);
      expect(bounds.width).to.be.closeTo(480, 1);
      expect(bounds.height).to.be.closeTo(48, 1);
    });
  });
});
