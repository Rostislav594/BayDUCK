import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { products } from "../src/data.js";
import { sharePage, siteUrl } from "../scripts/share-pages.mjs";

test("share pages carry a preview and redirect to the product page", () => {
  const html = sharePage(products[0]);
  assert.match(html, /<meta property="og:title" content="Court Essential — 3\s290 грн \| BuyDUCK \(демо\)"/);
  assert.match(html, new RegExp(`og:image" content="${siteUrl}/assets/products/white-sneakers.jpg"`));
  assert.match(html, /location\.replace\("\.\.\/index\.html#product\/court"\)/);
  assert.match(html, /<meta name="robots" content="noindex, nofollow"/);
});

test("generated share pages are committed and up to date", () => {
  const files = readdirSync("p").filter((file) => file.endsWith(".html")).sort();
  assert.deepEqual(files, products.map((p) => `${p.id}.html`).sort(), "run npm run share-pages");
  // Git on Windows may check the files out with CRLF line endings.
  const lf = (text) => text.replace(/\r\n/g, "\n");
  for (const product of products)
    assert.equal(lf(readFileSync(`p/${product.id}.html`, "utf8")), sharePage(product), `p/${product.id}.html is stale — run npm run share-pages`);
});
