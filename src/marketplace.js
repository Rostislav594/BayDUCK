import { productById } from "./data.js";
import { dictionaries } from "./i18n.js";

// Marketplace listings are always written in Ukrainian, whatever the admin language.
const uk = dictionaries.uk;

// Category paths are hints for the Shafa form; verify them on the first real listing.
const shafaKinds = {
  sneakers: { noun: "Кросівки", path: ["Взуття", "Кросівки"], euSizes: true },
  shirt: { noun: "Сорочка", path: ["Одяг", "Сорочки"] },
  hoodie: { noun: "Худі", path: ["Одяг", "Худі та світшоти"] },
  backpack: { noun: "Рюкзак", path: ["Аксесуари", "Рюкзаки"] },
};

export const shafaConditions = ["newTag", "new", "excellent", "good"];
export const shafaSections = ["women", "men"];
export const oneSize = "ONE SIZE";

export const defaultShafaSection = (product) =>
  product.gender === "men" ? "men" : "women";

const lower = (text) => text.charAt(0).toLocaleLowerCase("uk") + text.slice(1);

export function buildShafaListing({
  id,
  size,
  section,
  condition = "newTag",
  price,
  notes = "",
} = {}) {
  const product = productById(id);
  if (!product) return null;
  const kind = shafaKinds[product.kind] || shafaKinds.sneakers;
  const chosenSize = product.sizes.includes(size) ? size : product.sizes[0];
  const chosenSection = shafaSections.includes(section)
    ? section
    : defaultShafaSection(product);
  const chosenCondition = shafaConditions.includes(condition)
    ? condition
    : "newTag";
  const conditionLabel = uk[`condition${chosenCondition[0].toUpperCase()}${chosenCondition.slice(1)}`];
  const sizeLabel =
    chosenSize === oneSize
      ? "універсальний"
      : `${chosenSize}${kind.euSizes ? " (EU)" : ""}`;
  const finalPrice =
    Number.isInteger(price) && price > 0 ? price : product.price;
  const title = `${kind.noun} ${product.brand} ${product.name}${
    chosenSize === oneSize ? "" : `, розмір ${chosenSize}`
  }`;
  const description = [
    `${kind.noun} ${product.brand} ${product.name}.`,
    `Колір: ${lower(uk[product.color])}.`,
    `Розмір: ${sizeLabel}.`,
    `Стан: ${lower(conditionLabel)}.`,
    notes.trim(),
  ]
    .filter(Boolean)
    .join("\n");
  return {
    title,
    description,
    category: [uk[chosenSection], ...kind.path].join(" → "),
    brand: product.brand,
    size: chosenSize === oneSize ? "Універсальний" : chosenSize,
    condition: conditionLabel,
    color: uk[product.color],
    price: String(finalPrice),
    photo: `assets/products/${product.image}`,
  };
}
