/**
 * Docker / startup terminal banner for Presenton.
 * Renders a compact brand logo + startup status.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";

function fgRgb(r, g, b, text) {
  return `\x1b[38;2;${r};${g};${b}m${text}${RESET}`;
}

function brand(text) {
  return BOLD + fgRgb(138, 99, 255, text);
}

function accent(text) {
  return fgRgb(184, 176, 255, text);
}

function muted(text) {
  return DIM + fgRgb(160, 150, 210, text);
}

function styleAsciiArt(rawAscii) {
  const lines = rawAscii.replace(/\r/g, "").split("\n");
  const palette = [
    [153, 108, 255],
    [145, 103, 250],
    [136, 98, 245],
    [127, 92, 239],
    [118, 86, 233],
  ];

  return lines
    .map((line, lineIdx) => {
      const [r, g, b] = palette[lineIdx % palette.length];
      return line.replace(/[^\s]/g, (ch) => fgRgb(r, g, b, ch));
    })
    .join("\n");
}

function loadAsciiBanner() {
  const thisDir = path.dirname(fileURLToPath(import.meta.url));
  const asciiPath = path.join(thisDir, "presenton-ascii.txt");

  try {
    const raw = fs.readFileSync(asciiPath, "utf8").trimEnd();
    if (!raw) return "";
    return styleAsciiArt(raw);
  } catch {
    return "";
  }
}

/** Visible width (strips SGR sequences). */
function visLen(s) {
  return s.replace(/\x1b\[[0-9;:]*m/g, "").length;
}

/** Pad styled fragment to fixed visible width. */
function padVis(styled, width) {
  return styled + " ".repeat(Math.max(0, width - visLen(styled)));
}

/**
 * @param {object} [opts]
 * @param {number} [opts.nextPort]
 * @param {number} [opts.fastapiPort]
 * @param {string} [opts.hostHttpPort] — host-published HTTP port (docker -p HOST:80). Default from env or "5001".
 */
export function printPresentonStartupBanner(opts = {}) {
  const nextPort = opts.nextPort ?? 3000;
  const fastapiPort = opts.fastapiPort ?? 8000;
  const hostHttpPort =
    opts.hostHttpPort ??
    process.env.PRESENTON_HTTP_HOST_PORT ??
    process.env.PRESENTON_HOST_HTTP_PORT ??
    process.env.PRESENTON_PUBLIC_PORT ??
    "5001";

  const nextUrl = `http://127.0.0.1:${nextPort}`;
  const apiUrl = `http://127.0.0.1:${fastapiPort}`;
  const publicUrl =
    String(hostHttpPort) === "80"
      ? "http://127.0.0.1"
      : `http://127.0.0.1:${hostHttpPort}`;

  const iconBlock = loadAsciiBanner();

  const title = [
    "",
    BOLD + fgRgb(138, 99, 255, "   Open Source AI Presentation Generator"),
    "   " +
      accent("Love the Project?  ") +
      brand("Star us on github: ") +
      BOLD +
      fgRgb(224, 218, 255, "https://github.com/presenton/presenton"),
    muted("   ─────────────────────────────────────────────────────────"),
    "",
  ].join("\n");

  const W = 68;
  const pipe = (inner) => brand("  ║") + inner + brand("║");

  const summary = [
    brand(
      "  ╔════════════════════════════════════════════════════════════════════╗",
    ),
    pipe(padVis("  " + BOLD + "Routing summary" + RESET, W)),
    brand(
      "  ╠════════════════════════════════════════════════════════════════════╣",
    ),
    pipe(padVis("  " + accent("/         ") + muted("→ Next.js"), W)),
    pipe(padVis("  " + accent("/api/v1/  ") + muted("→ FastAPI"), W)),
    pipe(padVis("  " + muted("Next.js docker URL: ") + nextUrl, W)),
    pipe(padVis("  " + muted("FastAPI docker URL:     ") + apiUrl, W)),
    pipe(
      padVis(
        "  " +
          muted("Public URL (Ctrl+Click to open):     ") +
          BOLD +
          fgRgb(255, 255, 255, publicUrl),
        W,
      ),
    ),
    brand(
      "  ╚════════════════════════════════════════════════════════════════════╝",
    ),
    "",
    "   " + muted("Made with ❤️  by the Presenton team"),
  ].join("\n");

  const bannerHeader = iconBlock ? `${iconBlock}\n` : "";
  console.log("\n" + bannerHeader + title + summary);
}
