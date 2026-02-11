import { NextResponse } from "next/server";
import fs from "fs";
import { LLMConfig } from "@/types/llm_config";

const userConfigPath = process.env.USER_CONFIG_PATH!;
const canChangeKeys = process.env.CAN_CHANGE_KEYS !== "false";

export async function GET() {
  if (!canChangeKeys) {
    return NextResponse.json({
      error: "You are not allowed to access this resource",
      status: 403,
    });
  }
  if (!userConfigPath) {
    return NextResponse.json({
      error: "User config path not found",
      status: 500,
    });
  }

  if (!fs.existsSync(userConfigPath)) {
    return NextResponse.json({});
  }
  const configData = fs.readFileSync(userConfigPath, "utf-8");
  return NextResponse.json(JSON.parse(configData));
}

export async function POST(request: Request) {
  if (!canChangeKeys) {
    return NextResponse.json({
      error: "You are not allowed to access this resource",
    });
  }

  const userConfig = await request.json();

  let existingConfig: LLMConfig = {};
  if (fs.existsSync(userConfigPath)) {
    const configData = fs.readFileSync(userConfigPath, "utf-8");
    existingConfig = JSON.parse(configData);
  }
  const mergedConfig: LLMConfig = {
    LLM: userConfig.LLM || existingConfig.LLM,
    OPENAI_API_KEY: userConfig.OPENAI_API_KEY || existingConfig.OPENAI_API_KEY,
    OPENAI_MODEL: userConfig.OPENAI_MODEL || existingConfig.OPENAI_MODEL,
    GOOGLE_API_KEY: userConfig.GOOGLE_API_KEY || existingConfig.GOOGLE_API_KEY,
    GOOGLE_MODEL: userConfig.GOOGLE_MODEL || existingConfig.GOOGLE_MODEL,
    ANTHROPIC_API_KEY:
      userConfig.ANTHROPIC_API_KEY || existingConfig.ANTHROPIC_API_KEY,
    ANTHROPIC_MODEL:
      userConfig.ANTHROPIC_MODEL || existingConfig.ANTHROPIC_MODEL,
    OLLAMA_URL: userConfig.OLLAMA_URL || existingConfig.OLLAMA_URL,
    OLLAMA_MODEL: userConfig.OLLAMA_MODEL || existingConfig.OLLAMA_MODEL,
    CUSTOM_LLM_URL: userConfig.CUSTOM_LLM_URL || existingConfig.CUSTOM_LLM_URL,
    CUSTOM_LLM_API_KEY:
      userConfig.CUSTOM_LLM_API_KEY || existingConfig.CUSTOM_LLM_API_KEY,
    CUSTOM_MODEL: userConfig.CUSTOM_MODEL || existingConfig.CUSTOM_MODEL,
    DISABLE_IMAGE_GENERATION:
      userConfig.DISABLE_IMAGE_GENERATION === undefined
        ? existingConfig.DISABLE_IMAGE_GENERATION
        : userConfig.DISABLE_IMAGE_GENERATION,
    PIXABAY_API_KEY:
      userConfig.PIXABAY_API_KEY || existingConfig.PIXABAY_API_KEY,
    IMAGE_PROVIDER: userConfig.IMAGE_PROVIDER || existingConfig.IMAGE_PROVIDER,
    PEXELS_API_KEY: userConfig.PEXELS_API_KEY || existingConfig.PEXELS_API_KEY,
    COMFYUI_URL: userConfig.COMFYUI_URL || existingConfig.COMFYUI_URL,
    COMFYUI_WORKFLOW:
      userConfig.COMFYUI_WORKFLOW || existingConfig.COMFYUI_WORKFLOW,
    DALL_E_3_QUALITY:
      userConfig.DALL_E_3_QUALITY || existingConfig.DALL_E_3_QUALITY,
    GPT_IMAGE_1_5_QUALITY:
      userConfig.GPT_IMAGE_1_5_QUALITY || existingConfig.GPT_IMAGE_1_5_QUALITY,
    TOOL_CALLS:
      userConfig.TOOL_CALLS === undefined
        ? existingConfig.TOOL_CALLS
        : userConfig.TOOL_CALLS,
    DISABLE_THINKING:
      userConfig.DISABLE_THINKING === undefined
        ? existingConfig.DISABLE_THINKING
        : userConfig.DISABLE_THINKING,
    EXTENDED_REASONING:
      userConfig.EXTENDED_REASONING === undefined
        ? existingConfig.EXTENDED_REASONING
        : userConfig.EXTENDED_REASONING,
    WEB_GROUNDING:
      userConfig.WEB_GROUNDING === undefined
        ? existingConfig.WEB_GROUNDING
        : userConfig.WEB_GROUNDING,
    USE_CUSTOM_URL:
      userConfig.USE_CUSTOM_URL === undefined
        ? existingConfig.USE_CUSTOM_URL
        : userConfig.USE_CUSTOM_URL,
  };
  fs.writeFileSync(userConfigPath, JSON.stringify(mergedConfig));
  return NextResponse.json(mergedConfig);
}
