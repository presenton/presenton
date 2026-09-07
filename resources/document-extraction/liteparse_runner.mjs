#!/usr/bin/env node
/**
 * CLI bridge for Python: by default, raw extracted text on stdout (--python-bridge plain);
 * or one JSON line (--python-bridge json) for backward compatibility.
 *
 * OCR follows LlamaIndex LiteParse guidance. Use ISO 639-3 language codes for
 * Tesseract, such as "eng", "fra", or "deu+eng".
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { LiteParse } from "@llamaindex/liteparse";

function readArg(name) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return null;
  return process.argv[idx + 1] ?? null;
}

function parseBool(value, fallback) {
  if (value == null || value === "") return fallback;
  const s = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(s)) return true;
  if (["0", "false", "no", "off"].includes(s)) return false;
  return fallback;
}

function toNumber(value, fallback, min, max) {
  if (value == null || value === "") return fallback;
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

function normalizeOcrLanguage(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return "eng";
  if (!s.includes(",")) return s;
  return s
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .join("+");
}

function emit(result, exitCode = 0) {
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exit(exitCode);
}

const pyBridgeArg = readArg("--python-bridge");
const pyBridge =
  pyBridgeArg == null || pyBridgeArg === ""
    ? "json"
    : String(pyBridgeArg).trim().toLowerCase() === "plain"
      ? "plain"
      : "json";

function bridgeError(message, exitCode) {
  if (pyBridge === "plain") {
    process.stderr.write(`${message}\n`);
    process.exit(exitCode);
  }
  emit({ ok: false, error: message }, exitCode);
}

const filePath = readArg("--file");
if (!filePath) {
  bridgeError("Missing required --file argument", 2);
}

const resolvedPath = path.resolve(filePath);
if (!fs.existsSync(resolvedPath)) {
  bridgeError(`File not found: ${resolvedPath}`, 2);
}

const ocrEnabled = parseBool(readArg("--ocr-enabled"), true);
const dpi = toNumber(readArg("--dpi"), 150, 72, 600);
const numWorkers = toNumber(
  readArg("--num-workers"),
  Math.max(os.cpus().length - 2, 1),
  1,
  64
);

const cliOcrLanguage = readArg("--ocr-language");
const ocrLanguageRaw =
  (process.env.LITEPARSE_OCR_LANGUAGE && String(process.env.LITEPARSE_OCR_LANGUAGE).trim()) ||
  (cliOcrLanguage && String(cliOcrLanguage).trim()) ||
  "";
const ocrLanguage = normalizeOcrLanguage(ocrLanguageRaw || "eng");

const outputFormatRaw = (readArg("--output-format") || "text").trim().toLowerCase();
const outputFormat = outputFormatRaw === "json" ? "json" : "text";

const ocrServerUrlArg = readArg("--ocr-server-url");
const ocrServerUrl =
  (ocrServerUrlArg && String(ocrServerUrlArg).trim()) ||
  (process.env.LITEPARSE_OCR_SERVER_URL && String(process.env.LITEPARSE_OCR_SERVER_URL).trim()) ||
  undefined;

const tessdataArg = readArg("--tessdata-path");
const tessdataPath =
  (tessdataArg && String(tessdataArg).trim()) ||
  (process.env.LITEPARSE_TESSDATA_PATH && String(process.env.LITEPARSE_TESSDATA_PATH).trim()) ||
  (process.env.TESSDATA_PREFIX && String(process.env.TESSDATA_PREFIX).trim()) ||
  undefined;

try {
  const config = {
    ocrEnabled,
    ocrLanguage,
    outputFormat,
    dpi,
    numWorkers,
  };
  if (ocrServerUrl) {
    config.ocrServerUrl = ocrServerUrl;
  }
  if (tessdataPath) {
    config.tessdataPath = tessdataPath;
  }

  const parser = new LiteParse(config);
  const result = await parser.parse(resolvedPath, true);
  const text = result?.text ?? "";

  if (pyBridge === "plain") {
    process.stdout.write(text);
    process.exit(0);
  }

  emit({
    ok: true,
    filePath: resolvedPath,
    text,
    pageCount: Array.isArray(result?.pages) ? result.pages.length : 0,
    ocr: {
      engine: ocrServerUrl ? "http" : "tesseract",
      ocrLanguage,
      ocrEnabled,
      dpi,
      numWorkers,
    },
  });
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  if (pyBridge === "plain") {
    if (stack) {
      process.stderr.write(`${stack}\n`);
    }
    process.stderr.write(`${message}\n`);
    process.exit(1);
  }
  if (stack) {
    process.stderr.write(`${stack}\n`);
  }
  emit(
    {
      ok: false,
      filePath: resolvedPath,
      error: message,
    },
    1
  );
}
