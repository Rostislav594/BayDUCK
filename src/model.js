import { products, productById } from "./data.js";

export function filterProducts({
  category = "all",
  gender = "all",
  query = "",
  favorites = null,
  sale = false,
  sort = "featured",
} = {}) {
  const needle = query.trim().toLocaleLowerCase();
  const keywords = {
    sneakers: "кросівки кроссовки взуття обувь sneakers shoes",
    clothing: "одяг одежда clothing shirt hoodie рубашка сорочка худі худи",
    accessories: "аксесуари аксессуары accessories backpack рюкзак",
  };
  const result = products.filter(
    (p) =>
      (category === "all" || p.type === category) &&
      (gender === "all" || p.gender === gender || p.gender === "unisex") &&
      (!favorites || favorites.includes(p.id)) &&
      (!sale || p.oldPrice) &&
      (!needle ||
        `${p.name} ${p.brand} ${p.type} ${p.color} ${keywords[p.type]}`
          .toLocaleLowerCase()
          .includes(needle)),
  );
  if (sort === "price-asc") result.sort((a, b) => a.price - b.price);
  if (sort === "price-desc") result.sort((a, b) => b.price - a.price);
  return result;
}
export function sanitizeCart(value) {
  if (!Array.isArray(value)) return [];
  const result = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const product = productById(item.id);
    if (
      !product ||
      !product.sizes.includes(item.size) ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1
    )
      continue;
    const duplicate = result.find(
      (row) => row.id === item.id && row.size === item.size,
    );
    if (duplicate)
      duplicate.quantity = Math.min(99, duplicate.quantity + item.quantity);
    else
      result.push({
        id: item.id,
        size: item.size,
        quantity: Math.min(99, item.quantity),
      });
  }
  return result;
}
export const cartTotal = (cart) =>
  cart.reduce(
    (total, item) => total + (productById(item.id)?.price || 0) * item.quantity,
    0,
  );
export const cartCount = (cart) =>
  cart.reduce((total, item) => total + item.quantity, 0);
export function addToCart(cart, id, size) {
  const product = productById(id);
  if (!product || !product.sizes.includes(size)) return cart;
  const next = cart.map((row) => ({ ...row }));
  const row = next.find((item) => item.id === id && item.size === size);
  if (row) row.quantity = Math.min(99, row.quantity + 1);
  else next.push({ id, size, quantity: 1 });
  return next;
}

// Typical insole length (cm) per EU shoe size. Demo values until each model is measured.
const insoleCm = {
  35: 22.5, 36: 23, 37: 23.5, 38: 24.5, 39: 25, 40: 25.5,
  41: 26.5, 42: 27, 43: 27.5, 44: 28.5, 45: 29, 46: 29.5,
};
// Body measurements (cm) per clothing size.
const clothingCm = {
  XS: { chest: "82–86", waist: "66–70" },
  S: { chest: "86–92", waist: "70–76" },
  M: { chest: "92–98", waist: "76–82" },
  L: { chest: "98–104", waist: "82–88" },
  XL: { chest: "104–110", waist: "88–94" },
};
export function sizeChart(product) {
  if (!product) return null;
  if (product.type === "sneakers")
    return {
      kind: "shoes",
      rows: product.sizes
        .filter((size) => insoleCm[size])
        .map((size) => ({ size, cm: insoleCm[size] })),
    };
  if (product.type === "clothing")
    return {
      kind: "clothing",
      rows: product.sizes
        .filter((size) => clothingCm[size])
        .map((size) => ({ size, ...clothingCm[size] })),
    };
  return null;
}
// Shoe size whose insole fits a foot of `footCm` with ~0.5 cm to spare.
export function suggestShoeSize(product, footCm) {
  const chart = sizeChart(product);
  if (chart?.kind !== "shoes" || !(footCm > 0)) return null;
  return chart.rows.find((row) => row.cm >= footCm + 0.5)?.size ?? null;
}
// Up to `limit` other products of the same type, then anything else.
export function relatedProducts(product, limit = 4) {
  if (!product) return [];
  const others = products.filter((p) => p.id !== product.id);
  return [
    ...others.filter((p) => p.type === product.type),
    ...others.filter((p) => p.type !== product.type),
  ].slice(0, limit);
}
