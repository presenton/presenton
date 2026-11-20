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
const authPath = "**/api/v1/ppt/codex/auth";
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
  describe(`ChatGPT sign-in polling in ${flow}`, () => {
    const begin = () => cy.contains("button", "Sign in with ChatGPT").click();

    beforeEach(() => {
      cy.intercept("**/api-js.mixpanel.com/**", { statusCode: 200, body: {} });
      cy.intercept("GET", catalogPath, catalog()).as("models");
      cy.intercept("POST", `${authPath}/initiate`, {
        session_id: "fixture-session", url: "https://example.test/oauth",
      }).as("initiate");
      cy.window().then((win) => cy.stub(win, "open"));
    });

    for (const [statusCode, connected] of [[404, false], [409, true]] as const) {
      it(`stops polling after HTTP ${statusCode} and reconciles the account once`, () => {
        let statusChecks = 0;
        cy.intercept("GET", `${authPath}/status`, (request) => {
          statusChecks += 1;
          request.reply(statusChecks > 1 && connected
            ? { ...profile, username: "Recovered account" }
            : { status: statusChecks === 1 ? "not_authenticated" : "expired" });
        }).as("status");
        cy.intercept("GET", `${authPath}/status/fixture-session`, { statusCode }).as("poll");
        cy.mount(<Harness flow={flow} />);
        cy.wait("@status");
        cy.clock(Date.now(), ["setTimeout", "clearTimeout"]);
        begin();
        cy.wait("@initiate");
        cy.contains("Waiting for sign-in").should("be.visible");
        cy.tick(2000);
        cy.wait("@poll");
        cy.wait("@status");
        if (connected) {
          cy.contains("Recovered account").should("be.visible");
          cy.wait("@models");
          cy.get(picker).should("not.be.disabled");
        } else {
          cy.contains("button", "Sign in with ChatGPT").should("be.enabled");
        }
        cy.contains("Waiting for sign-in").should("not.exist");
        cy.tick(6000);
        cy.get("@poll.all").should("have.length", 1);
        cy.get("@status.all").should("have.length", 2);
      });
    }

    it("retries a temporary upstream error and completes browser sign-in", () => {
      cy.intercept("GET", `${authPath}/status`, { status: "not_authenticated" });
      cy.intercept("GET", `${authPath}/status/fixture-session`, {
        ...profile, status: "success", username: "Connected account",
      }).as("success");
      cy.intercept({ method: "GET", url: `${authPath}/status/fixture-session`, times: 1 }, {
        statusCode: 503,
      }).as("temporary");
      cy.mount(<Harness flow={flow} />);
      begin();
      cy.wait("@temporary");
      cy.contains("Waiting for sign-in").should("be.visible");
      cy.wait("@success");
      cy.contains("Connected account").should("be.visible");
      cy.wait("@models");
    });

    it("preserves manual callback and stops polling when it succeeds", () => {
      cy.intercept("GET", `${authPath}/status`, { status: "not_authenticated" });
      cy.intercept("GET", `${authPath}/status/fixture-session`, { status: "pending" }).as("poll");
      cy.intercept("POST", `${authPath}/exchange`, {
        ...profile, username: "Manual account",
      }).as("exchange");
      cy.mount(<Harness flow={flow} />);
      cy.clock(Date.now(), ["setTimeout", "clearTimeout"]);
      begin();
      cy.get('input[placeholder="Paste URL or code…"]').type("fixture-code");
      cy.contains("button", "Submit").click();
      cy.wait("@exchange");
      cy.contains("Manual account").should("be.visible");
      cy.wait("@models");
      cy.tick(6000);
      cy.get("@poll.all").should("have.length", 0);
    });

    it("ignores the old polling response after cancellation and a new attempt", () => {
      cy.intercept("GET", `${authPath}/status`, { status: "not_authenticated" });
      cy.intercept("GET", `${authPath}/status/fixture-session`, {
        delay: 700, body: { ...profile, status: "success", username: "Old account" },
      });
      cy.window().then((win) => cy.spy(win, "fetch").as("pollFetch"));
      cy.mount(<Harness flow={flow} />);
      cy.clock(Date.now(), ["setTimeout", "clearTimeout"]);
      begin();
      cy.contains("Waiting for sign-in").should("be.visible");
      cy.tick(2000);
      cy.get("@pollFetch").should((spy) => {
        expect(spy.getCalls().some((call) => String(call.args[0]).includes("/status/fixture-session"))).to.equal(true);
      });
      cy.contains("button", "Cancel").click();
      cy.intercept("POST", `${authPath}/initiate`, {
        session_id: "new-session", url: "https://example.test/oauth",
      });
      begin();
      cy.contains("Waiting for sign-in").should("be.visible");
      cy.get("@pollFetch").then((spy) => {
        const oldPoll = spy.getCalls().find((call) => String(call.args[0]).includes("/status/fixture-session"));
        expect(oldPoll.args[1].signal.aborted).to.equal(true);
      });
      cy.contains("Old account").should("not.exist");
    });
  });

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
      cy.get('input[placeholder="Search models…"]').type("Future model");
      cy.contains('[cmdk-item=""]', "Future model").should("be.visible");
      cy.get('input[placeholder="Search models…"]').clear().type(FUTURE_ID);
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
