import { useState } from "react";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import SettingCodex from "@/app/(presentation-generator)/(dashboard)/settings/SettingCodex";
import CodexConfig from "@/components/CodexConfig";
import AdvancedTextProviderSettings from "@/components/AdvancedTextProviderSettings";
import { CodexModelCatalogProvider, useCodexModels } from "@/components/CodexModelCatalog";
import { handleSaveLLMConfig } from "@/utils/storeHelpers";
import type { LLMConfig } from "@/types/llm_config";
import "@/app/globals.css";

const FUTURE_ID = "FutureModel/ExactCase";
const model = (id = FUTURE_ID, name = "Future model") => ({
  id, name, supported_reasoning_levels: ["none", "low", "high", "ultra"],
  context_window: 200000,
});
const catalog = (models = [model()]) => ({ models, client_version: "0.169.0" });
const profile = { status: "authenticated", account_id: "fixture-account-a" };
const catalogPath = "**/api/v1/admin/codex/models";
const picker = '[aria-label="ChatGPT model"]';

function AccountControl() {
  const { updateConnection } = useCodexModels();
  return <button onClick={() => updateConnection(true, "fixture-account-b")}>Switch catalog account</button>;
}

function Harness({ flow, initialModel = "", initialEffort = "" }: {
  flow: "settings" | "onboarding";
  initialModel?: string;
  initialEffort?: string;
}) {
  const [config, setConfig] = useState<LLMConfig>({
    LLM: "codex", CODEX_MODEL: initialModel, LLM_REASONING_EFFORT: initialEffort,
    DISABLE_IMAGE_GENERATION: true,
  });
  const [saved, setSaved] = useState("");
  const [saveError, setSaveError] = useState("");
  const onChange = (value: unknown, field: string) => {
    setConfig((previous) => ({ ...previous, [field === "codex_model" ? "CODEX_MODEL" : field]: value }));
  };
  const save = async () => {
    try {
      await handleSaveLLMConfig(config);
      setSaved(config.CODEX_MODEL || "");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Save failed");
    }
  };
  const Auth = flow === "settings" ? SettingCodex : CodexConfig;
  return <AppRouterContext.Provider value={{
    push: () => {}, replace: () => {}, refresh: () => {}, back: () => {}, forward: () => {}, prefetch: async () => {},
  }}>
    <PathnameContext.Provider value={flow === "settings" ? "/settings" : "/"}>
      <CodexModelCatalogProvider>
        <Auth codexModel={config.CODEX_MODEL || ""} onInputChange={onChange} />
        <AdvancedTextProviderSettings config={config} onChange={onChange} />
        <AccountControl />
        <button onClick={save}>Save fixture configuration</button>
        <output data-cy="selection">{config.CODEX_MODEL}</output>
        <output data-cy="effort">{config.LLM_REASONING_EFFORT}</output>
        <output data-cy="saved">{saved}</output>
        <output data-cy="save-error">{saveError}</output>
      </CodexModelCatalogProvider>
    </PathnameContext.Provider>
  </AppRouterContext.Provider>;
}

for (const flow of ["settings", "onboarding"] as const) {
  describe(`ChatGPT dynamic models in ${flow}`, () => {
    beforeEach(() => {
      cy.intercept("GET", "**/api/v1/ppt/codex/auth/status", profile).as("auth");
      cy.intercept("POST", "**/api/v1/ppt/codex/auth/logout", { status: "ok" });
      // These component tests never contact a real provider or analytics service.
      cy.intercept("**/api-js.mixpanel.com/**", { statusCode: 200, body: {} });
    });

    it("selects and saves an exact new ID, then preserves it when the view is reopened", () => {
      cy.intercept("GET", catalogPath, catalog()).as("models");
      cy.intercept("POST", "/api/user-config", (request) => {
        expect(request.body.CODEX_MODEL).to.equal(FUTURE_ID);
        request.reply({ status: "ok" });
      }).as("save");
      cy.mount(<Harness flow={flow} />);
      cy.wait("@models");
      cy.get(picker).click();
      cy.screenshot(`codex-${flow}-dynamic-models`, { capture: "viewport" });
      cy.contains('[cmdk-item=""]', "Future model").click();
      cy.get('[data-cy="selection"]').should("have.text", FUTURE_ID);
      cy.contains("button", "Save fixture configuration").click();
      cy.wait("@save");
      cy.get('[data-cy="saved"]').should("have.text", FUTURE_ID);
      cy.mount(<Harness flow={flow} initialModel={FUTURE_ID} />);
      cy.wait("@models");
      cy.get(picker).should("contain.text", "Future model");
      cy.get('[data-cy="selection"]').should("have.text", FUTURE_ID);
    });

    it("surfaces server-side selection rejection without changing the saved model", () => {
      cy.intercept("GET", catalogPath, catalog()).as("models");
      cy.intercept("POST", "/api/user-config", {
        statusCode: 400, body: { detail: "The selected ChatGPT model is no longer available." },
      }).as("rejectedSave");
      cy.mount(<Harness flow={flow} initialModel={FUTURE_ID} />);
      cy.wait("@models");
      cy.contains("button", "Save fixture configuration").click();
      cy.wait("@rejectedSave");
      cy.get('[data-cy="save-error"]').should("contain.text", "selected ChatGPT model is no longer available");
      cy.get('[data-cy="selection"]').should("have.text", FUTURE_ID);
      cy.get('[data-cy="saved"]').should("be.empty");
    });

    it("loads fresh models after refreshing the connected account", () => {
      let requestCount = 0;
      cy.intercept("GET", catalogPath, (request) => {
        requestCount += 1;
        request.reply(requestCount === 1 ? catalog() : catalog([model("NewAccountID", "New account model")]));
      }).as("models");
      cy.intercept("POST", "**/api/v1/ppt/codex/auth/refresh", {
        ...profile, account_id: "fixture-account-b",
      }).as("refreshAccount");
      cy.mount(<Harness flow={flow} initialModel={FUTURE_ID} />);
      cy.wait("@models");
      cy.get('button[title="Refresh token"]').click();
      cy.wait("@refreshAccount");
      cy.get(picker).should("not.be.disabled").click();
      cy.contains('[cmdk-item=""]', "New account model").should("exist");
      cy.contains('[cmdk-item=""]', "Future model").should("not.exist");
      cy.get('[data-cy="selection"]').should("have.text", FUTURE_ID);
    });

    it("keeps the saved selection through refresh failures, removed models and empty catalogs", () => {
      let requestCount = 0;
      cy.intercept("GET", catalogPath, (request) => {
        requestCount += 1;
        if (requestCount === 1) request.reply(catalog());
        else if (requestCount === 2) request.reply({ statusCode: 503, body: { detail: "Catalog unavailable" } });
        else if (requestCount === 3) request.reply(catalog([model("DifferentID", "Different model")]));
        else request.reply(catalog([]));
      }).as("models");
      cy.mount(<Harness flow={flow} initialModel={FUTURE_ID} />);
      cy.wait("@models");
      cy.contains("button", "Refresh models").click();
      cy.wait("@models");
      cy.get('[data-cy="codex-model-picker"] [role="alert"]').should("contain.text", "saved model has not been changed");
      cy.get('[data-cy="selection"]').should("have.text", FUTURE_ID);
      cy.contains("button", "Refresh models").click();
      cy.wait("@models");
      cy.get('[data-cy="codex-model-picker"] [role="alert"]').should("contain.text", "no longer available");
      cy.get('[data-cy="selection"]').should("have.text", FUTURE_ID);
      cy.contains("button", "Refresh models").click();
      cy.wait("@models");
      cy.get(picker).should("be.disabled");
      cy.get('[data-cy="selection"]').should("have.text", FUTURE_ID);
      cy.get('button[title="Sign out"]').click();
      cy.get('[data-cy="selection"]').should("be.empty");
      cy.get(picker).should("not.exist");
    });

    it("uses advertised SDK reasoning levels without inventing a maximum output limit", () => {
      cy.intercept("GET", catalogPath, catalog()).as("models");
      cy.mount(<Harness flow={flow} initialModel={FUTURE_ID} initialEffort="none" />);
      cy.wait("@models");
      cy.contains("summary", "Advanced text-provider settings").click();
      cy.get('input[type="number"]').should("have.value", "").and("have.attr", "placeholder", "Provider default");
      cy.contains("Use the selected model's maximum output limit").should("not.exist");
      cy.get('details [role="combobox"]').click();
      cy.get('[role="option"]').should("have.length", 4);
      cy.contains('[role="option"]', "None").should("exist");
      cy.contains('[role="option"]', "ultra").should("not.exist");
      cy.contains('[role="option"]', "High").click();
      cy.get('[data-cy="effort"]').should("have.text", "high");
    });

    it("aborts the previous account's request and ignores its late response", () => {
      let requestCount = 0;
      cy.intercept("GET", catalogPath, (request) => {
        requestCount += 1;
        request.reply(requestCount === 1
          ? { delay: 1200, body: catalog([model("OldAccountID", "Old account model")]) }
          : { body: catalog([model("NewAccountID", "New account model")]) });
      });
      cy.window().then((win) => cy.spy(win, "fetch").as("fetchCalls"));
      cy.mount(<Harness flow={flow} initialModel={FUTURE_ID} />);
      cy.get("@fetchCalls").should((spy) => {
        expect(spy.getCalls().filter((call) => String(call.args[0]).includes("/admin/codex/models"))).to.have.length(1);
      });
      cy.contains("button", "Switch catalog account").click();
      cy.get(picker).should("not.be.disabled");
      cy.get("@fetchCalls").then((spy) => {
        const request = spy.getCalls().find((call) => String(call.args[0]).includes("/admin/codex/models"));
        expect(request.args[1].signal.aborted).to.equal(true);
        expect(request.args[1].cache).to.equal("no-store");
      });
      cy.wait(1300);
      cy.get(picker).click();
      cy.contains('[cmdk-item=""]', "New account model").should("exist");
      cy.contains('[cmdk-item=""]', "Old account model").should("not.exist");
      cy.get('[data-cy="selection"]').should("have.text", FUTURE_ID);
    });
  });
}
