// Generates p/<id>.html: tiny pages with Open Graph tags so a shared product link shows
// a photo, name and price in Telegram/Viber/Instagram, then redirects to #product/<id>.
// Messengers don't run JavaScript and ignore the #fragment, so the preview must live here.
// Run `npm run share-pages` after changing products, and commit the generated files.
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { products } from "../src/data.js";
import { dictionaries } from "../src/i18n.js";

// Public address of the published site; update when the store moves to its own domain.
export const siteUrl = "https://rostislav594.github.io/BayDUCK";

const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char],
  );
// Same "3 290 грн" form as the storefront (Node's ICU would print "₴").
const price = (value) => `${new Intl.NumberFormat("uk-UA").format(value)} грн`;

export function sharePage(product, base = siteUrl) {
  const uk = dictionaries.uk;
  const target = `../index.html#product/${product.id}`;
  // "демо" stays while the catalog is a prototype, so previews never look like real offers.
  const title = `${product.name} — ${price(product.price)} | BuyDUCK (демо)`;
  const description = `${uk[product.type]} · ${uk[product.color]}. ${product.description?.uk || ""}`.trim();
  const image = `${base}/assets/products/${product.image}`;
  return `<!doctype html>
<html lang="uk">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex, nofollow" />
    <title>${escape(title)}</title>
    <meta name="description" content="${escape(description)}" />
    <meta property="og:type" content="product" />
    <meta property="og:site_name" content="BuyDUCK" />
    <meta property="og:locale" content="uk_UA" />
    <meta property="og:title" content="${escape(title)}" />
    <meta property="og:description" content="${escape(description)}" />
    <meta property="og:image" content="${escape(image)}" />
    <meta property="og:url" content="${escape(`${base}/p/${product.id}.html`)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta http-equiv="refresh" content="0; url=${escape(target)}" />
    <script>location.replace(${JSON.stringify(target)});</script>
  </head>
  <body>
    <a href="${escape(target)}">${escape(product.name)}</a>
  </body>
</html>
`;
}

async function main() {
  const dir = resolve(process.cwd(), "p");
  await mkdir(dir, { recursive: true });
  // Drop pages of products that no longer exist.
  for (const file of await readdir(dir))
    if (file.endsWith(".html") && !products.some((p) => `${p.id}.html` === file))
      await rm(resolve(dir, file));
  for (const product of products)
    await writeFile(resolve(dir, `${product.id}.html`), sharePage(product));
  console.log(`Generated ${products.length} share pages in p/`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
