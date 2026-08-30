import React from "react";

import "@/app/globals.css";
import { Switch } from "@/components/ui/switch";

describe("Switch", () => {
  it("keeps the thumb inside the track when another Tailwind runtime defines translate", () => {
    cy.document().then((document) => {
      const style = document.createElement("style");
      style.textContent = `
        [class~="data-[state=checked]:translate-x-4"][data-state="checked"],
        .translate-x-4 {
          translate: 16px 0;
        }
      `;
      document.head.appendChild(style);
    });

    cy.mount(<Switch aria-label="Test switch" />);

    const expectThumbInsideTrack = () => {
      cy.get('[role="switch"]').then(($switch) => {
        const trackBounds = $switch[0].getBoundingClientRect();

        cy.wrap($switch)
          .children()
          .first()
          .then(($thumb) => {
            const thumbBounds = $thumb[0].getBoundingClientRect();

            expect(thumbBounds.left).to.be.at.least(trackBounds.left);
            expect(thumbBounds.right).to.be.at.most(trackBounds.right);
            expect(thumbBounds.top).to.be.at.least(trackBounds.top);
            expect(thumbBounds.bottom).to.be.at.most(trackBounds.bottom);
          });
      });
    };

    expectThumbInsideTrack();
    cy.get('[role="switch"]').click().should("have.attr", "data-state", "checked");
    expectThumbInsideTrack();
  });
});
