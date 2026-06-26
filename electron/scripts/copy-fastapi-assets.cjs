const fs = require("fs");
const path = require("path");

const electronRoot = path.join(__dirname, "..");
const fastapiDir = path.join(electronRoot, "..", "servers", "fastapi");
const resourcesFastapiDir = path.join(electronRoot, "resources", "fastapi");

const sources = [
  { name: "static", src: path.join(fastapiDir, "static"), dest: path.join(resourcesFastapiDir, "static") },
  { name: "assets", src: path.join(fastapiDir, "assets"), dest: path.join(resourcesFastapiDir, "assets") },
];

function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    throw new Error(`Source directory not found: ${src}`);
  }
  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(src, dest, { recursive: true, force: true });
}

function main() {
  fs.mkdirSync(resourcesFastapiDir, { recursive: true });

  for (const { name, src, dest } of sources) {
    console.log(`[fastapi-assets] Copying ${name} -> ${dest}`);
    copyDir(src, dest);
  }
}

try {
  main();
} catch (error) {
  console.error(`[fastapi-assets] ${error.message}`);
  process.exit(1);
}
