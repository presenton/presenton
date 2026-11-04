import React from "react";

import "@/app/globals.css";
import "@/app/motion.css";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

describe("DialogContent", () => {
  it("stays centered when another Tailwind runtime defines translate", () => {
    cy.viewport(1920, 1080);

    cy.document().then((document) => {
      const style = document.createElement("style");
      style.textContent = `
        [data-cy="dialog-content"] {
          translate: -50% -50%;
        }
      `;
      document.head.appendChild(style);
    });

    cy.mount(
      <Dialog open>
        <DialogContent data-cy="dialog-content">
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>Dialog positioning regression test.</DialogDescription>
        </DialogContent>
      </Dialog>,
    );

    cy.get('[data-cy="dialog-content"]')
      .should("be.visible")
      .and("have.css", "translate", "none")
      .then(($dialog) => {
        const bounds = $dialog[0].getBoundingClientRect();

        expect(bounds.left).to.be.greaterThan(-1);
        expect(bounds.top).to.be.greaterThan(-1);
        expect(bounds.right).to.be.lessThan(1921);
        expect(bounds.bottom).to.be.lessThan(1081);
        expect(bounds.left + bounds.width / 2).to.be.closeTo(960, 3);
        expect(bounds.top + bounds.height / 2).to.be.closeTo(540, 3);
      });
  });
});
