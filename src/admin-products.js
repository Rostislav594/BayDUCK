// Admin "Products": one list and one form. "Publish" puts an item on the site and on OLX
// at once (the catalog syncs OLX itself, see src/catalog.js and src/olx.js).
import { conditions, imageUrl, productById, productImages, products } from "./data.js";
import { dictionaries } from "./i18n.js";
import {
  clothingSizes,
  compressPhoto,
  createCatalogStore,
  isAvailable,
  maxPhotos,
  productColors,
  productGenders,
  productTypes,
} from "./catalog.js";

export const catalogStore = createCatalogStore();
catalogStore.load();

const capital = (value) => value[0].toUpperCase() + value.slice(1);
const uk = dictionaries.uk;

export function createProductsAdmin({ t, escape, money, icon, toast, render }) {
  // Photos of the product being edited; kept outside the DOM so re-rendering the grid is cheap.
  let draft = { id: null, photos: [] };

  const sizeText = (p) =>
    p.size === "ONE SIZE" ? t("oneSize") : p.type === "sneakers" ? `${p.size.replace(".", ",")} EU` : p.size;
  const stateLabel = (p) => t(isAvailable(p) ? "productLive" : p.status === "sold" ? "productSold" : "productOff");
  const conditionBadge = (p) =>
    `<span class="condition-badge condition-${p.condition}">${t(p.condition === "newTag" ? "condNewTag" : "condUsed")}</span>`;
  const errorText = (key) => t(`err${capital(key)}`);

  function listView() {
    // Items on sale first, then sold and taken-down ones.
    const list = [...products].sort((a, b) => Number(isAvailable(b)) - Number(isAvailable(a)));
    const rows = list
      .map((p) => {
        const live = isAvailable(p);
        return `<tr class="product-row ${live ? "is-live" : "is-off"}"><td><div class="admin-product"><img src="${imageUrl(p.image)}" alt="" width="56" height="56" loading="lazy"/><span><strong>${escape(p.name)}</strong><small>${escape(p.brand)} · ${t(p.type)}</small></span></div></td><td class="admin-sizes">${escape(sizeText(p))}${p.insoleCm ? ` · ${String(p.insoleCm).replace(".", ",")} ${t("cmShort")}` : ""}</td><td>${conditionBadge(p)}</td><td class="admin-num">${money(p.price)}</td><td><span class="product-state ${live ? "is-live" : "is-off"}">${stateLabel(p)}</span></td><td><div class="admin-actions"><a class="admin-pill" href="#products/edit/${p.id}">${t("actionEdit")}</a><button type="button" class="admin-pill" data-product-live="${live ? "off" : "on"}" data-id="${p.id}">${t(live ? "actionTakeDown" : "actionRelist")}</button></div></td></tr>`;
      })
      .join("");
    return `<section class="admin-card" aria-labelledby="products-title"><div class="admin-card-head"><div><h1 id="products-title">${t("adminProducts")} <span class="admin-count">${products.length}</span></h1><p>${t("adminProductsCopy")}</p></div><a class="admin-pill admin-pill--dark" href="#products/new">${t("publishProduct")}</a></div>${
      list.length
        ? `<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th scope="col">${t("adminColProduct")}</th><th scope="col">${t("sizeLabel")}</th><th scope="col">${t("conditionLabel")}</th><th scope="col" class="admin-num">${t("adminColPrice")}</th><th scope="col">${t("adminColStatus")}</th><th scope="col"><span class="visually-hidden">${t("actionEdit")}</span></th></tr></thead><tbody>${rows}</tbody></table></div>`
        : `<div class="activity-empty">${icon("box")}<h2>${t("productsEmpty")}</h2></div>`
    }<p class="admin-hint">${t("olxDemoHint")} <button type="button" class="admin-link" data-action="reset-catalog">${t("productsResetDemo")}</button></p></section>`;
  }

  function photoGrid() {
    return draft.photos
      .map(
        (src, i) =>
          `<li class="photo-item"><img src="${imageUrl(src)}" alt="" width="120" height="120"/>${i === 0 ? `<span class="photo-main">${t("photoMain")}</span>` : `<button type="button" class="admin-link" data-photo-main="${i}">${t("makeMain")}</button>`}<button type="button" class="photo-remove" data-photo-remove="${i}" aria-label="${escape(t("removePhoto"))}">${icon("trash")}</button></li>`,
      )
      .join("");
  }
  function sizeFields(type, p = {}) {
    if (type === "sneakers")
      return `<div class="form-grid"><label class="admin-control">${t("fieldShoeSize")}<input name="size" inputmode="decimal" maxlength="4" placeholder="42" value="${escape(p.type === "sneakers" ? String(p.size).replace(".", ",") : "")}" required/></label><label class="admin-control">${t("fieldInsole")}<input name="insoleCm" inputmode="decimal" maxlength="4" placeholder="27,5" value="${escape(p.insoleCm ? String(p.insoleCm).replace(".", ",") : "")}" required/></label></div>`;
    if (type === "clothing")
      return `<label class="admin-control">${t("fieldClothingSize")}<select name="size" required><option value=""></option>${clothingSizes.map((s) => `<option ${p.size === s ? "selected" : ""}>${s}</option>`).join("")}</select></label>`;
    return `<p class="admin-hint">${t("oneSizeNote")}</p>`;
  }
  function formView(id) {
    const p = id ? productById(id) : null;
    if (id && !p) return `<section class="admin-card"><div class="activity-empty"><h2>${t("errProductMissing")}</h2><a class="admin-pill" href="#products">${t("backToProducts")}</a></div></section>`;
    if (draft.id !== (id || "new")) draft = { id: id || "new", photos: p ? [...productImages(p)] : [] };
    const type = p?.type || "sneakers";
    const select = (name, label, options, value) =>
      `<label class="admin-control">${label}<select name="${name}" required>${options.map(([v, text]) => `<option value="${v}" ${v === value ? "selected" : ""}>${escape(text)}</option>`).join("")}</select></label>`;
    const input = (name, label, attrs = "", value = "") =>
      `<label class="admin-control">${label}<input name="${name}" ${attrs} value="${escape(value ?? "")}"/></label>`;
    const detail = (key) => (p?.details?.[key] ? uk[p.details[key]] || p.details[key] : "");
    const radio = conditions
      .map(
        (c) =>
          `<label class="choice"><input type="radio" name="condition" value="${c}" ${(p?.condition || "used") === c ? "checked" : ""}/><span><strong>${t(c === "newTag" ? "condNewTag" : "condUsed")}</strong></span></label>`,
      )
      .join("");
    return `<section class="admin-card" aria-labelledby="form-title"><a class="admin-back" href="#products">${icon("arrow")}${t("backToProducts")}</a><div class="admin-card-head"><div><h1 id="form-title">${t(p ? "formEditTitle" : "formNewTitle")}</h1><p>${t(p ? "formEditCopy" : "formCopy")}</p></div></div><form id="product-form" class="product-form" novalidate data-id="${escape(id || "")}">
<fieldset class="form-section"><legend>${t("photosTitle")}</legend><p class="admin-hint">${t("photosHint")}</p><ul class="photo-grid">${photoGrid()}</ul><label class="admin-pill photo-add">${icon("down")}${t("addPhotos")}<input type="file" name="photoFiles" accept="image/*" multiple class="visually-hidden"/></label></fieldset>
<fieldset class="form-section"><legend>${t("basicsTitle")}</legend><div class="form-grid">${input("name", t("fieldName"), 'required maxlength="80"', p?.name)}${input("brand", t("fieldBrand"), 'required maxlength="40"', p?.brand)}${select("type", t("fieldType"), productTypes.map((v) => [v, t(v)]), type)}${select("gender", t("fieldGender"), productGenders.map((v) => [v, v === "unisex" ? t("adminUnisex") : t(v)]), p?.gender || "unisex")}${select("color", t("fieldColor"), productColors.map((v) => [v, t(v)]), p?.color || "white")}</div></fieldset>
<fieldset class="form-section"><legend>${t("sizeConditionTitle")}</legend><div class="size-fields">${sizeFields(type, p || {})}</div><div class="choice-row">${radio}</div></fieldset>
<fieldset class="form-section"><legend>${t("priceTitle")}</legend><div class="form-grid">${input("price", t("fieldPrice"), 'inputmode="numeric" required maxlength="7"', p?.price)}${input("oldPrice", t("fieldOldPrice"), 'inputmode="numeric" maxlength="7"', p?.oldPrice)}</div></fieldset>
<fieldset class="form-section"><legend>${t("descriptionTitle")}</legend><label class="admin-control">${t("fieldDescriptionUk")}<textarea name="descriptionUk" rows="4" maxlength="1500" required>${escape(p?.description?.uk || "")}</textarea></label><details class="form-details"><summary>${t("translationsToggle")}</summary><label class="admin-control">${t("fieldDescriptionRu")}<textarea name="descriptionRu" rows="3" maxlength="1500">${escape(p?.description?.ru || "")}</textarea></label><label class="admin-control">${t("fieldDescriptionEn")}<textarea name="descriptionEn" rows="3" maxlength="1500">${escape(p?.description?.en || "")}</textarea></label></details></fieldset>
<fieldset class="form-section"><legend>${t("detailsOptional")}</legend><div class="form-grid">${input("upper", t("detailUpper"), 'maxlength="60"', detail("upper"))}${input("sole", t("detailSole"), 'maxlength="60"', detail("sole"))}${input("season", t("detailSeason"), 'maxlength="60"', detail("season"))}</div></fieldset>
<p class="form-error" role="alert" hidden></p><div class="form-actions"><button type="submit" class="admin-pill admin-pill--dark">${t(p ? "saveChanges" : "publishProduct")}</button><a class="admin-pill" href="#products">${t("cancel")}</a>${p ? `<button type="button" class="admin-pill admin-danger" data-action="delete-product" data-id="${p.id}">${icon("trash")}${t("deleteProduct")}</button>` : ""}</div><p class="admin-hint">${t(p ? "publishEditHint" : "publishHint")}</p></form></section>`;
  }

  const refreshPhotos = () => {
    const grid = document.querySelector("#product-form .photo-grid");
    if (grid) grid.innerHTML = photoGrid();
  };
  async function addPhotos(files) {
    for (const file of files) {
      if (draft.photos.length >= maxPhotos) {
        toast(t("photosFull"));
        break;
      }
      try {
        draft.photos.push(await compressPhoto(file));
      } catch {
        toast(t("photoReadFailed"));
      }
      refreshPhotos();
    }
  }
  function showError(form, result) {
    const error = form.querySelector(".form-error");
    error.textContent = errorText(result.error);
    error.hidden = false;
    const field = result.field === "photos" ? form.querySelector('[name="photoFiles"]')?.closest("label") : form.elements[result.field];
    (field instanceof RadioNodeList ? field[0] : field)?.focus?.();
  }
  function submitProduct(form) {
    const id = form.dataset.id || null;
    const existing = id ? productById(id) : null;
    const data = Object.fromEntries(new FormData(form));
    delete data.photoFiles;
    // Untouched shipped details are i18n keys shown translated; keep the key if the text is unchanged.
    for (const key of ["upper", "sole", "season"]) {
      const original = existing?.details?.[key];
      if (original && (uk[original] || original) === String(data[key] ?? "").trim()) data[key] = original;
    }
    // A new item is published straight away: on the site and on OLX.
    const result = catalogStore.save({ ...data, images: draft.photos, ...(id ? {} : { status: "active" }) }, id);
    if (!result.ok) return showError(form, result);
    draft = { id: null, photos: [] };
    toast(t(id ? (isAvailable(result.product) ? "productUpdated" : "productSaved") : "productPublished"));
    location.hash = "products";
  }

  return {
    view(sub, id) {
      if (sub === "new") return formView(null);
      if (sub === "edit") return formView(id);
      draft = { id: null, photos: [] };
      return listView();
    },
    handleClick(event) {
      const target = event.target;
      const live = target.closest("[data-product-live]");
      if (live) {
        const on = live.dataset.productLive === "on";
        const result = catalogStore.setStatus(live.dataset.id, on ? "active" : "hidden");
        toast(result.ok ? t(on ? "productRelisted" : "productTakenDown") : errorText(result.error));
        render();
        return true;
      }
      const main = target.closest("[data-photo-main]");
      if (main) {
        const [photo] = draft.photos.splice(Number(main.dataset.photoMain), 1);
        draft.photos.unshift(photo);
        refreshPhotos();
        return true;
      }
      const remove = target.closest("[data-photo-remove]");
      if (remove) {
        draft.photos.splice(Number(remove.dataset.photoRemove), 1);
        refreshPhotos();
        return true;
      }
      if (target.closest('[data-action="delete-product"]')) {
        if (!confirm(t("productDeleteConfirm"))) return true;
        const result = catalogStore.remove(target.closest("[data-id]").dataset.id);
        toast(result.ok ? t("productDeleted") : errorText(result.error));
        if (result.ok) location.hash = "products";
        return true;
      }
      if (target.closest('[data-action="reset-catalog"]')) {
        if (!confirm(t("productsResetConfirm"))) return true;
        catalogStore.reset();
        toast(t("productsResetDone"));
        render();
        return true;
      }
      return false;
    },
    handleChange(event) {
      const target = event.target;
      if (target.name === "photoFiles" && target.files?.length) {
        addPhotos([...target.files]);
        target.value = "";
        return true;
      }
      if (target.form?.id === "product-form" && target.name === "type") {
        target.form.querySelector(".size-fields").innerHTML = sizeFields(target.value);
        return true;
      }
      return false;
    },
    handleSubmit(event) {
      if (event.target.id !== "product-form") return false;
      event.preventDefault();
      submitProduct(event.target);
      return true;
    },
  };
}
