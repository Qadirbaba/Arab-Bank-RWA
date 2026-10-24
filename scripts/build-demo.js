// Builds the browser-only demo (GitHub Pages) into ./_site: same UI and engine, sample data, no server.
import fs from "node:fs";
const out = "_site";
fs.rmSync(out, { recursive: true, force: true });
fs.cpSync("public", out, { recursive: true });
fs.cpSync("shared", `${out}/shared`, { recursive: true });
const cfg = fs.readFileSync(`${out}/config.js`, "utf8").replace(/window\.EWRA_MODE = "server"/, 'window.EWRA_MODE = "demo"');
fs.writeFileSync(`${out}/config.js`, cfg);
fs.writeFileSync(`${out}/.nojekyll`, "");
console.log("Demo site built in", out);
