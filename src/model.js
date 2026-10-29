import { isAvailable, products, productById } from "./data.js";

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
  // Hidden and sold items leave the catalog; favorites still show sold ones.
  const result = products.filter(
    (p) =>
      (favorites ? p.status !== "hidden" : isAvailable(p)) &&
      (category === "all" || p.type === category) &&
      (gender === "all" || p.gender === gender || p.gender === "unisex") &&
      (!favorites || favorites.includes(p.id)) &&
      (!sale || p.oldPrice) &&
      (!needle ||
        `${p.name} ${p.brand} ${p.type} ${p.color} ${p.size} ${keywords[p.type]}`
          .toLocaleLowerCase()
          .includes(needle)),
  );
  if (sort === "price-asc") result.sort((a, b) => a.price - b.price);
  if (sort === "price-desc") result.sort((a, b) => b.price - a.price);
  return result;
}
// Each product is one physical item, so a cart line is always quantity 1.
// `quantity` stays in the line shape for orders and statistics.
export function sanitizeCart(value) {
  if (!Array.isArray(value)) return [];
  const result = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const product = productById(item.id);
    if (
      !product ||
      !isAvailable(product) ||
      item.size !== product.size ||
      result.some((row) => row.id === item.id)
    )
      continue;
    result.push({ id: item.id, size: product.size, quantity: 1 });
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
export const inCart = (cart, id) => cart.some((item) => item.id === id);
export function addToCart(cart, id) {
  const product = productById(id);
  if (!product || !isAvailable(product) || inCart(cart, id)) return cart;
  return [...cart.map((row) => ({ ...row })), { id, size: product.size, quantity: 1 }];
}
// Up to `limit` other products of the same type, then anything else.
export function relatedProducts(product, limit = 4) {
  if (!product) return [];
  const others = products.filter((p) => p.id !== product.id && isAvailable(p));
  return [
    ...others.filter((p) => p.type === product.type),
    ...others.filter((p) => p.type !== product.type),
  ].slice(0, limit);
}
// Newest owner items first; shipped demo items (no date) keep their order after them.
export const newestProducts = (limit = 4) =>
  products
    .map((product, index) => ({ product, index }))
    .filter(({ product }) => isAvailable(product))
    .sort((a, b) => (b.product.createdAt ?? 0) - (a.product.createdAt ?? 0) || a.index - b.index)
    .slice(0, limit)
    .map(({ product }) => product);

// Foot lengths this insole suits best (1 to 0.5 cm shorter).
export const footRange = (insoleCm) => ({ from: insoleCm - 1, to: insoleCm - 0.5 });
