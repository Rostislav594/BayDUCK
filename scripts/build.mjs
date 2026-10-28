import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const out = resolve(root, "dist");
await mkdir(out, { recursive: true });
for (const file of ["index.html", "admin.html", "src", "assets", "p"])
  await cp(resolve(root, file), resolve(out, file), { recursive: true });
const html = await readFile(resolve(out, "index.html"), "utf8");
if (!html.includes("src/app.js")) throw new Error("Missing application entry");
await writeFile(
  resolve(out, ".build-info.json"),
  JSON.stringify({ builtAt: new Date().toISOString() }),
);
console.log("Built static prototype in dist/");
