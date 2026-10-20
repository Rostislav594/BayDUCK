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
