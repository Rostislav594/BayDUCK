// OLX publishing adapter (demo). The catalog calls it whenever an item goes on sale,
// changes or leaves sale, so the owner never handles OLX separately.
// With OLX Partner API access this module becomes the API client (create / update /
// deactivate adverts on the owner's account); nothing else in the site has to change.

// Ready listing text for OLX, always in Ukrainian. Category paths are hints until the
// API category/attribute mapping is known.
export function olxListing(product, uk) {
  const size =
    product.size === "ONE SIZE"
      ? uk.oneSize.toLowerCase()
      : product.type === "sneakers"
        ? `${product.size.replace(".", ",")} EU`
        : product.size;
  const insole = product.insoleCm ? `${String(product.insoleCm).replace(".", ",")} см` : "";
  const condition = product.condition === "newTag" ? uk.condNewTag : uk.condUsed;
  const title = `${uk[product.type]} ${product.brand} ${product.name}, ${product.type === "accessories" ? size : `розмір ${size}`}`;
  const lines = [
    product.description?.uk || "",
    "",
    `Розмір: ${size}`,
    ...(insole ? [`Довжина устілки: ${insole}`] : []),
    `Стан: ${condition.toLowerCase()}`,
    "",
    "Відправка Новою Поштою після підтвердження. Можлива Безпечна угода OLX.",
  ];
  const who = { women: "Жіноче", men: "Чоловіче", unisex: "Чоловіче або жіноче" }[product.gender] || "";
  const category =
    product.type === "sneakers"
      ? `Мода і стиль → ${who} взуття → Кросівки`
      : product.type === "clothing"
        ? `Мода і стиль → ${{ women: "Жіночий", men: "Чоловічий", unisex: "Чоловічий або жіночий" }[product.gender]} одяг`
        : "Мода і стиль → Аксесуари";
  return {
    title,
    description: lines.join("\n").trim(),
    category,
    condition: product.condition === "newTag" ? "Нове" : "Вживане",
    price: product.price,
  };
}

// Demo adapter: records what would be sent to OLX, without creating a real advert.
export function createDemoOlx({ uk, now = () => Date.now() }) {
  const advert = (product, status) => ({
    demo: true,
    status,
    advertId: product.olx?.advertId || `demo-${product.id}`,
    title: olxListing(product, uk).title,
    syncedAt: now(),
  });
  return {
    publish: (product) => advert(product, "active"),
    deactivate: (product) => (product.olx ? { ...product.olx, status: "inactive", syncedAt: now() } : null),
  };
}
