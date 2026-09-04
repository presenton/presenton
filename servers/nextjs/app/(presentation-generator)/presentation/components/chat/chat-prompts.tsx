import type { ReactNode } from "react";
import type { LLMConfig } from "@/types/llm_config";

export const suggestions: {
  id: string;
  icon: ReactNode;
  suggestion: string;
}[] = [
  {
    id: "generate",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="12"
        height="12"
        viewBox="0 0 12 12"
        fill="none"
        aria-hidden="true"
      >
        <g clipPath="url(#chat-suggestion-generate)">
          <path
            d="M10.82 1.82039L10.18 1.18039C10.1238 1.12355 10.0568 1.07842 9.98299 1.04763C9.90918 1.01683 9.83 1.00098 9.75002 1.00098C9.67005 1.00098 9.59087 1.01683 9.51706 1.04763C9.44325 1.07842 9.37628 1.12355 9.32002 1.18039L1.18002 9.32039C1.12318 9.37665 1.07806 9.44362 1.04726 9.51743C1.01647 9.59123 1.00061 9.67041 1.00061 9.75039C1.00061 9.83036 1.01647 9.90954 1.04726 9.98335C1.07806 10.0572 1.12318 10.1241 1.18002 10.1804L1.82002 10.8204C1.87593 10.8778 1.94279 10.9235 2.01664 10.9547C2.0905 10.9859 2.16985 11.0019 2.25002 11.0019C2.33019 11.0019 2.40955 10.9859 2.4834 10.9547C2.55726 10.9235 2.62411 10.8778 2.68002 10.8204L10.82 2.68039C10.8775 2.62448 10.9231 2.55762 10.9543 2.48377C10.9855 2.40991 11.0016 2.33056 11.0016 2.25039C11.0016 2.17022 10.9855 2.09087 10.9543 2.01701C10.9231 1.94316 10.8775 1.8763 10.82 1.82039Z"
            stroke="#7F22FE"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M7 3.5L8.5 5" stroke="#7F22FE" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M2.5 3V5" stroke="#7F22FE" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M9.5 7V9" stroke="#7F22FE" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5 1V2" stroke="#7F22FE" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M3.5 4H1.5" stroke="#7F22FE" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M10.5 8H8.5" stroke="#7F22FE" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5.5 1.5H4.5" stroke="#7F22FE" strokeLinecap="round" strokeLinejoin="round" />
        </g>
        <defs>
          <clipPath id="chat-suggestion-generate">
            <rect width="12" height="12" fill="white" />
          </clipPath>
        </defs>
      </svg>
    ),
    suggestion: "Generate a full presentation from my topic",
  },
  {
    id: "improve",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="12"
        height="12"
        viewBox="0 0 12 12"
        fill="none"
        aria-hidden="true"
      >
        <g clipPath="url(#chat-suggestion-improve)">
          <path
            d="M4.96847 7.75012C4.92383 7.57709 4.83364 7.41918 4.70728 7.29282C4.58092 7.16646 4.42301 7.07626 4.24997 7.03162L1.18247 6.24062C1.13014 6.22577 1.08407 6.19425 1.05128 6.15085C1.01848 6.10744 1.00073 6.05453 1.00073 6.00012C1.00073 5.94572 1.01848 5.89281 1.05128 5.8494C1.08407 5.806 1.13014 5.77448 1.18247 5.75962L4.24997 4.96812C4.42294 4.92353 4.58082 4.83341 4.70717 4.70714C4.83353 4.58088 4.92375 4.42307 4.96847 4.25012L5.75947 1.18262C5.77417 1.13008 5.80566 1.0838 5.84913 1.05082C5.8926 1.01785 5.94566 1 6.00022 1C6.05478 1 6.10784 1.01785 6.15131 1.05082C6.19478 1.0838 6.22627 1.13008 6.24097 1.18262L7.03147 4.25012C7.07611 4.42316 7.1663 4.58107 7.29266 4.70743C7.41902 4.83379 7.57693 4.92399 7.74997 4.96862L10.8175 5.75912C10.8702 5.77367 10.9167 5.80513 10.9499 5.84866C10.983 5.8922 11.001 5.94541 11.001 6.00012C11.001 6.05484 10.983 6.10805 10.9499 6.15159C10.9167 6.19512 10.8702 6.22657 10.8175 6.24112L7.74997 7.03162C7.57693 7.07626 7.41902 7.16646 7.29266 7.29282C7.1663 7.41918 7.07611 7.57709 7.03147 7.75012L6.24047 10.8176C6.22577 10.8702 6.19428 10.9165 6.15081 10.9494C6.10734 10.9824 6.05428 11.0002 5.99972 11.0002C5.94516 11.0002 5.8921 10.9824 5.84863 10.9494C5.80516 10.9165 5.77367 10.8702 5.75897 10.8176L4.96847 7.75012Z"
            stroke="#155DFC"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M10 1.5V3.5" stroke="#155DFC" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M11 2.5H9" stroke="#155DFC" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M2 8.5V9.5" stroke="#155DFC" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M2.5 9H1.5" stroke="#155DFC" strokeLinecap="round" strokeLinejoin="round" />
        </g>
        <defs>
          <clipPath id="chat-suggestion-improve">
            <rect width="12" height="12" fill="white" />
          </clipPath>
        </defs>
      </svg>
    ),
    suggestion: "Improve this slide content",
  },
  {
    id: "rewrite",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
        <path d="M6 10H10.5" stroke="#009966" strokeLinecap="round" strokeLinejoin="round" />
        <path
          d="M8.18799 1.81087C8.38703 1.61182 8.657 1.5 8.93849 1.5C9.21998 1.5 9.48994 1.61182 9.68899 1.81087C9.88803 2.00991 9.99986 2.27988 9.99986 2.56137C9.99986 2.84286 9.88803 3.11282 9.68899 3.31187L3.68399 9.31737C3.56504 9.43632 3.418 9.52333 3.25649 9.57037L1.82049 9.98937C1.77746 10.0019 1.73186 10.0027 1.68844 9.99155C1.64503 9.98042 1.6054 9.95783 1.57371 9.92614C1.54202 9.89445 1.51943 9.85483 1.50831 9.81141C1.49719 9.768 1.49794 9.72239 1.51049 9.67937L1.92949 8.24337C1.9766 8.08203 2.06361 7.93518 2.18249 7.81637L8.18799 1.81087Z"
          stroke="#009966"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    suggestion: "Rewrite this content professionally",
  },
  {
    id: "notes",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
        <path d="M1.5 1.5V9.5C1.5 9.76522 1.60536 10.0196 1.79289 10.2071C1.98043 10.3946 2.23478 10.5 2.5 10.5H10.5" stroke="#E17100" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9 8.5V4.5" stroke="#E17100" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M6.5 8.5V2.5" stroke="#E17100" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M4 8.5V7" stroke="#E17100" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    suggestion: "Add speaker notes to this slide",
  },
];

export const outlineQuickPrompts = [
  "Expand outline",
  "Shorten outline",
  "Reorder sections",
  "Merge similar slides",
  "Split large sections",
  "Improve conclusion",
  "Improve introduction",
];

export const presentationQuickPrompts = [
  "Create an executive summary",
  "Strengthen the story flow",
  "Add data and citations",
  "Create speaker notes",
];

export const templateV2QuickPrompts = [
  "Improve this slide's layout",
  "Rewrite this slide for executives",
  "Add a supporting visual",
  "Make the deck visually consistent",
  "Add data and source citations",
  "Create speaker notes for this slide",
];

export const editorQuickPrompts = [
  "Rewrite for executives",
  "Improve slide layout",
  "Add data & citations",
  "Create speaker notes",
  "Make the deck consistent",
];

export const outlineEditorQuickPrompts = [
  "Strengthen the story flow",
  "Make the outline concise",
  "Reorder the sections",
  "Merge similar slides",
  "Improve the conclusion",
];

export const quickPromptGroups = [
  {
    label: "Popular",
    prompts: [
      "Make it shorter",
      "Make this smaller",
      "Generate a new image and replace this one",
    ],
  },
  {
    label: "Add Data",
    prompts: ["Add data and citations", "Add a chart", "Add a table"],
  },
  {
    label: "Add Visuals",
    prompts: [
      "Generate a new image and replace this one",
      "Add a chart",
      "Add a table",
    ],
  },
];

export const outlineQuickPromptGroups = [
  {
    label: "Popular",
    prompts: [
      "Make the outline shorter",
      "Expand the outline",
      "Strengthen the story flow",
    ],
  },
  {
    label: "Structure",
    prompts: [
      "Reorder the sections",
      "Merge similar slides",
      "Split large sections",
    ],
  },
  {
    label: "Refine Content",
    prompts: [
      "Rewrite for executives",
      "Improve the introduction",
      "Improve the conclusion",
    ],
  },
];

export const getSelectedTextModel = (config: LLMConfig) => {
  switch (config.LLM) {
    case "openai":
      return config.OPENAI_MODEL;
    case "deepseek":
      return config.DEEPSEEK_MODEL;
    case "google":
      return config.GOOGLE_MODEL;
    case "vertex":
      return config.VERTEX_MODEL;
    case "azure":
      return config.AZURE_OPENAI_MODEL;
    case "bedrock":
      return config.BEDROCK_MODEL;
    case "openrouter":
      return config.OPENROUTER_MODEL;
    case "conifer":
      return config.CONIFER_MODEL;
    case "fireworks":
      return config.FIREWORKS_MODEL;
    case "together":
      return config.TOGETHER_MODEL;
    case "cerebras":
      return config.CEREBRAS_MODEL;
    case "litellm":
      return config.LITELLM_MODEL;
    case "lmstudio":
      return config.LMSTUDIO_MODEL;
    case "anthropic":
      return config.ANTHROPIC_MODEL;
    case "ollama":
      return config.OLLAMA_MODEL;
    case "custom":
      return config.CUSTOM_MODEL;
    case "codex":
      return config.CODEX_MODEL;
    default:
      return undefined;
  }
};
