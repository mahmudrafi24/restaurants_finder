// Import into one process; node:test runs and reports each registered test automatically.
const fs = require("node:fs");
const path = require("node:path");
for (const file of fs
  .readdirSync(__dirname)
  .filter((file) => file.endsWith(".test.cjs"))
  .sort()) {
  require(path.join(__dirname, file));
}
