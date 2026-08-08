const fs = require("fs");
const path = require("path");

const electronRoot = path.join(__dirname, "..");
const source = path.join(electronRoot, "..", "templates");
const destination = path.join(electronRoot, "resources", "templates");

if (!fs.existsSync(source)) {
  console.error(`[templates] Source directory not found: ${source}`);
  process.exit(1);
}

console.log(`[templates] Copying ${source} -> ${destination}`);
fs.rmSync(destination, { recursive: true, force: true });
fs.mkdirSync(path.dirname(destination), { recursive: true });
fs.cpSync(source, destination, { recursive: true, force: true });
