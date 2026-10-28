import { createServer } from "node:http";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { networkInterfaces } from "node:os";

const root = resolve(process.cwd());
const lan = process.argv.includes("--lan");
const port = Number(process.env.PORT || (lan ? 5174 : 5173));
const host = lan ? "0.0.0.0" : "127.0.0.1";
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
};
// The hero layout editor (/?edit-layout) saves here. Only on the private
// 127.0.0.1 preview, never on the LAN one, and only small JSON documents.
async function saveLayout(request, response) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 64 * 1024) return response.writeHead(413).end("Too large");
  }
  try {
    const layout = JSON.parse(body);
    if (!Array.isArray(layout.cards)) throw new Error("cards");
    await mkdir(resolve(root, "artifacts"), { recursive: true });
    const text = JSON.stringify(layout, null, 2);
    // The latest layout plus a timestamped copy, so no save is ever lost.
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    await writeFile(resolve(root, "artifacts", "hero-layout.json"), text);
    await writeFile(resolve(root, "artifacts", `hero-layout-${stamp}.json`), text);
    response.writeHead(204).end();
  } catch {
    response.writeHead(400).end("Bad layout");
  }
}
createServer(async (request, response) => {
  if (request.url === "/__layout" && !lan) {
    if (request.method === "POST") return saveLayout(request, response);
    try {
      const saved = await readFile(resolve(root, "artifacts", "hero-layout.json"));
      return response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-cache" }).end(saved);
    } catch {
      return response.writeHead(404).end("No layout yet");
    }
  }
  try {
    const pathname = decodeURIComponent(
      new URL(request.url, "http://localhost").pathname,
    );
    const path = resolve(
      root,
      "." +
        (pathname === "/"
          ? "/index.html"
          : pathname === "/admin"
            ? "/admin.html"
            : pathname),
    );
    const relativePath = path.slice(root.length + 1).split(sep);
    if (
      !path.startsWith(root + sep) ||
      relativePath.some((part) => part.startsWith(".")) ||
      !["index.html", "admin.html", "src", "assets", "p"].includes(relativePath[0])
    ) {
      response.writeHead(403).end("Forbidden");
      return;
    }
    if (!(await stat(path)).isFile()) {
      response.writeHead(404).end("Not found");
      return;
    }
    response.writeHead(200, {
      "Content-Type": types[extname(path)] || "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    response.end(await readFile(path));
  } catch {
    response.writeHead(404).end("Not found");
  }
}).listen(port, host, () => {
  console.log(`BuyDUCK local preview: http://127.0.0.1:${port}`);
  if (lan) {
    for (const entries of Object.values(networkInterfaces())) {
      for (const entry of entries || []) {
        if (entry.family === "IPv4" && !entry.internal) {
          console.log(`BuyDUCK network preview: http://${entry.address}:${port}`);
        }
      }
    }
  }
});
