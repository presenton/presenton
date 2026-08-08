const fs = require("fs");
const path = require("path");

const electronRoot = path.join(__dirname, "..");
const resourcesDir = path.join(electronRoot, "resources");
const preservedResourceEntries = new Set(["document-extraction", "ui"]);

if (fs.existsSync(resourcesDir)) {
  for (const entry of fs.readdirSync(resourcesDir)) {
    if (preservedResourceEntries.has(entry)) {
      continue;
    }

    fs.rmSync(path.join(resourcesDir, entry), {
      recursive: true,
      force: true,
    });
  }
}

fs.rmSync(path.join(electronRoot, "app_dist"), {
  recursive: true,
  force: true,
});
