// Owner catalog (demo). The owner's products live in this browser's localStorage and
// replace the contents of the shared `products` array, so the storefront, cart and
// search see them without any other change. On the Railway server this becomes API calls.
import { conditions, isAvailable, products } from "./data.js";
import { dictionaries } from "./i18n.js";
import { createDemoOlx, olxListing } from "./olx.js";

export { isAvailable, olxListing };

const catalogKey = "buyduck:catalog";
// What ships with the site, kept to restore the demo catalog.
const shipped = structuredClone(products);
export const shippedIds = new Set(shipped.map((p) => p.id));

export const productStatuses = ["active", "hidden", "sold"];
export const productTypes = ["sneakers", "clothing", "accessories"];
export const productGenders = ["unisex", "women", "men"];
export const productColors = ["white", "black", "stone", "cream", "sand", "brown", "red", "blue", "green", "pink", "multi"];
export const clothingSizes = ["XS", "S", "M", "L", "XL", "XXL"];
export const maxPhotos = 8;


const clean = (value, max) =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
const cleanText = (value, max) =>
  String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim()
    .slice(0, max);
const number = (value) => Number(String(value ?? "").replace(",", ".").trim());
const slug = (value) =>
  clean(value, 40)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "item";
export const isOlxUrl = (value) => /^https:\/\/(www\.|m\.)?olx\.ua\/\S+$/i.test(String(value ?? ""));

// Validates owner input; returns the product shape the storefront uses.
export function validateProduct(input = {}, { existing = null, takenIds = [] } = {}) {
  const name = clean(input.name, 80);
  const brand = clean(input.brand, 40);
  const type = input.type;
  const gender = input.gender;
  const color = input.color;
  const condition = input.condition;
  const price = number(input.price);
  const oldPrice = String(input.oldPrice ?? "").trim() ? number(input.oldPrice) : null;
  const images = Array.isArray(input.images) ? input.images.filter((src) => typeof src === "string" && src) : [];
  const description = {
    uk: cleanText(input.descriptionUk, 1500),
    ru: cleanText(input.descriptionRu, 1500),
    en: cleanText(input.descriptionEn, 1500),
  };
  if (!images.length) return { error: "photoRequired", field: "photos" };
  if (images.length > maxPhotos) return { error: "photoLimit", field: "photos" };
  if (name.length < 2) return { error: "productNameRequired", field: "name" };
  if (!brand) return { error: "brandRequired", field: "brand" };
  if (!productTypes.includes(type)) return { error: "typeRequired", field: "type" };
  if (!productGenders.includes(gender)) return { error: "genderRequired", field: "gender" };
  if (!productColors.includes(color)) return { error: "colorRequired", field: "color" };
  let size;
  let insoleCm;
  if (type === "sneakers") {
    const eu = number(input.size);
    if (!(eu >= 30 && eu <= 50 && Number.isInteger(eu * 2))) return { error: "shoeSizeInvalid", field: "size" };
    size = String(eu);
    insoleCm = number(input.insoleCm);
    if (!(insoleCm >= 15 && insoleCm <= 35)) return { error: "insoleInvalid", field: "insoleCm" };
    insoleCm = Math.round(insoleCm * 10) / 10;
  } else if (type === "clothing") {
    if (!clothingSizes.includes(input.size)) return { error: "clothingSizeRequired", field: "size" };
    size = input.size;
  } else size = "ONE SIZE";
  if (!conditions.includes(condition)) return { error: "conditionRequired", field: "condition" };
  if (!(Number.isInteger(price) && price > 0 && price <= 1000000)) return { error: "priceInvalid", field: "price" };
  if (oldPrice !== null && !(Number.isInteger(oldPrice) && oldPrice > price)) return { error: "oldPriceInvalid", field: "oldPrice" };
  if (description.uk.length < 10) return { error: "descriptionRequired", field: "descriptionUk" };
  const olxUrl = clean(input.olxUrl ?? existing?.olxUrl, 300);
  if (olxUrl && !isOlxUrl(olxUrl)) return { error: "olxUrlInvalid", field: "olxUrl" };
  const status = productStatuses.includes(input.status) ? input.status : existing?.status ?? "active";
  // Keep details the form doesn't edit (lining, fastening…); the form edits these three.
  const details = { ...(existing?.details || {}) };
  for (const key of ["upper", "sole", "season"]) {
    const value = clean(input[key], 60);
    if (value) details[key] = value;
    else delete details[key];
  }
  let id = existing?.id;
  if (!id) {
    const base = slug(`${brand} ${name}`);
    id = base;
    for (let n = 2; takenIds.includes(id); n++) id = `${base}-${n}`;
  }
  const product = {
    id,
    name,
    brand,
    type,
    gender,
    price,
    ...(oldPrice ? { oldPrice } : {}),
    image: images[0],
    ...(images.length > 1 ? { images } : {}),
    color,
    size,
    ...(insoleCm ? { insoleCm } : {}),
    condition,
    article: clean(input.article, 20) || existing?.article || `BD-${type.slice(0, 2).toUpperCase()}-${String(takenIds.length + 1).padStart(2, "0")}`,
    details,
    description: Object.fromEntries(Object.entries(description).filter(([, text]) => text)),
    status,
    ...(olxUrl ? { olxUrl } : {}),
    ...(existing?.olx ? { olx: existing.olx } : {}),
    // Shipped demo items have no date, so editing them keeps them out of "new arrivals".
    createdAt: existing ? (existing.createdAt ?? 0) : Date.now(),
  };
  return { ok: true, product };
}

export function createCatalogStore({
  storage = globalThis.localStorage,
  olx = createDemoOlx({ uk: dictionaries.uk }),
} = {}) {
  // One action for the owner: an item on sale is on the site and on OLX; when it is
  // sold or taken down, its OLX advert is deactivated too.
  const syncOlx = (product) => {
    if (isAvailable(product)) product.olx = olx.publish(product);
    else if (product.olx) product.olx = olx.deactivate(product);
    return product;
  };
  const read = () => {
    try {
      const value = JSON.parse(storage.getItem(catalogKey));
      return Array.isArray(value) ? value.filter((p) => p?.id && p.name && p.image) : null;
    } catch {
      return null;
    }
  };
  const write = (list) => {
    try {
      storage.setItem(catalogKey, JSON.stringify(list));
    } catch {
      return false;
    }
    products.splice(0, products.length, ...list);
    return true;
  };
  const update = (id, change) => {
    const list = structuredClone(products);
    const product = list.find((p) => p.id === id);
    if (!product) return { error: "productMissing" };
    change(product);
    return write(list) ? { ok: true, product } : { error: "storageFull" };
  };
  return {
    // Replace the shipped demo products with the owner's saved catalog, if any.
    load() {
      const saved = read();
      if (saved) products.splice(0, products.length, ...saved);
      return products;
    },
    save(input, id = null) {
      const existing = id ? products.find((p) => p.id === id) : null;
      if (id && !existing) return { error: "productMissing" };
      const result = validateProduct(input, {
        existing,
        takenIds: products.map((p) => p.id).filter((taken) => taken !== id),
      });
      if (!result.ok) return result;
      const list = structuredClone(products);
      const index = list.findIndex((p) => p.id === id);
      syncOlx(result.product);
      if (index >= 0) list[index] = result.product;
      else list.unshift(result.product);
      return write(list) ? result : { error: "storageFull" };
    },
    setStatus(id, status) {
      if (!productStatuses.includes(status)) return { error: "statusInvalid" };
      return update(id, (p) => {
        p.status = status;
        syncOlx(p);
      });
    },
    remove(id) {
      const product = products.find((p) => p.id === id);
      if (!product) return { error: "productMissing" };
      if (product.olx) olx.deactivate(product);
      return write(products.filter((p) => p.id !== id)) ? { ok: true } : { error: "storageFull" };
    },
    reset() {
      try {
        storage.removeItem(catalogKey);
      } catch {}
      products.splice(0, products.length, ...structuredClone(shipped));
      return { ok: true };
    },
  };
}

// Owner photos are shrunk in the browser before saving, so a few dozen fit in localStorage.
export async function compressPhoto(file, { maxSide = 1000, quality = 0.8 } = {}) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return canvas.toDataURL("image/jpeg", quality);
}
