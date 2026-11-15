import { sanitizeImage } from '../lib/images.mjs';
import { getStore } from "../lib/storage.mjs";
import { HttpError, configured, session, login, logout, cookie, sameOrigin, csrfCheck, limit, boundedRequest, readJSON, safeTree, secureResponse, conditionalJSON } from '../lib/security.mjs';
import { INITIAL_CONFIG } from "../lib/initial-config.mjs";

const STORE_NAME = "bencho19-config";
const KEY = "config";
const IMAGE_STORE_NAME = "bencho19-images";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

const PASSWORD_HASH_PREFIX = "pbkdf2-sha256";
const PASSWORD_HASH_BYTES = 32;

const MAX_CATEGORIES = 50;
const MAX_ITEMS_PER_CATEGORY = 200;
const MAX_CATEGORY_NAME = 80;
const MAX_PRODUCT_NAME = 120;
const MAX_PRODUCT_DESCRIPTION = 1000;
const MAX_TEXT = 1000;
const MAX_IMAGE_URL = 500;
const MAX_PRICE = 1_000_000_000;
const LOGIN_RATE_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_RATE_MAX_ATTEMPTS = 5;
const AUTH_RATE_STORE_NAME = "bencho19-auth-rate-limit";
const MAX_CONFIG_BYTES = 900_000;

// --- Validación estricta de entrada (misma arquitectura que Chef Burger) ---
// A diferencia de normalizeText/cleanPrice (que "arreglan" datos inválidos en
// silencio), estas funciones RECHAZAN la petición con un error claro cuando
// el dato no es válido. Se usan en validateConfigInput() antes de guardar.

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ValidationError";
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertSafeObjectKeys(value, label) {
  if (!isPlainObject(value)) throw new ValidationError(`${label} debe ser un objeto.`);
  const forbidden = ["__proto__", "prototype", "constructor"];
  for (const key of Object.keys(value)) {
    if (forbidden.includes(key)) {
      throw new ValidationError(`${label} contiene una propiedad no permitida.`);
    }
  }
}

function requiredString(value, label, maxLength = 200) {
  if (typeof value !== "string") throw new ValidationError(`${label} debe ser texto.`);
  const result = value.trim();
  if (!result) throw new ValidationError(`${label} es obligatorio.`);
  if (result.length > maxLength) throw new ValidationError(`${label} es demasiado largo.`);
  return result;
}

function optionalString(value, label, maxLength = 200) {
  if (value == null || value === "") return "";
  if (typeof value !== "string") throw new ValidationError(`${label} debe ser texto.`);
  const result = value.trim();
  if (result.length > maxLength) throw new ValidationError(`${label} es demasiado largo.`);
  return result;
}

function finiteNumber(value, label, { min = -MAX_PRICE, max = MAX_PRICE } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new ValidationError(`${label} debe ser un número válido.`);
  if (n < min || n > max) throw new ValidationError(`${label} está fuera de rango.`);
  return n;
}

function normalizeText(value, max, fallback = "") {
  return String(value ?? fallback).trim().slice(0, max);
}

function cleanPrice(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > MAX_PRICE) return fallback;
  return Math.round(n);
}

function slug(value) {
  return String(value || "producto")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "producto";
}

function normalizeProductId(value, categoryName, productName, categoryIndex, itemIndex) {
  const provided = normalizeText(value, 120);
  if (/^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/.test(provided)) return provided;
  return `product-${slug(categoryName)}-${slug(productName)}-${categoryIndex + 1}-${itemIndex + 1}`;
}

function normalizeZoneId(value, name, index) {
  const provided = normalizeText(value, 80);
  if (/^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/.test(provided)) return provided;
  return `zone-${slug(name)}-${index + 1}`;
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...extraHeaders
    }
  });
}

function store() {
  return getStore({ name: STORE_NAME, consistency: "strong" });
}

async function isAuthenticated(request) { return Boolean(await session(request)); }

function mergeMenuData(sourceMenu) {
  if (!Array.isArray(sourceMenu)) return structuredClone(INITIAL_CONFIG.menuData);

  const merged = sourceMenu.map(sourceCategory => {
    const initialCategory = INITIAL_CONFIG.menuData.find(
      category => category.category === sourceCategory.category
    );

    if (!initialCategory) return structuredClone(sourceCategory);

    const sourceItems = Array.isArray(sourceCategory.items) ? sourceCategory.items : [];

    return {
      ...initialCategory,
      ...sourceCategory,
      items: sourceItems.map(sourceItem => {
        const initialItem = initialCategory.items.find(
          item => item.name === sourceItem.name
        );

        if (!initialItem) return sourceItem;

        const mergedItem = { ...initialItem, ...sourceItem };
        if (initialItem.allowAddons === true) mergedItem.allowAddons = true;
        if (initialItem.isAddon === true) mergedItem.isAddon = true;
        return mergedItem;
      })
    };
  });

  INITIAL_CONFIG.menuData.forEach(initialCategory => {
    let category = merged.find(
      sourceCategory => sourceCategory.category === initialCategory.category
    );

    if (!category) {
      merged.push(structuredClone(initialCategory));
      return;
    }

    if (!Array.isArray(category.items)) category.items = [];

    initialCategory.items.forEach(initialItem => {
      const existingItem = category.items.find(
        sourceItem => sourceItem.name === initialItem.name
      );

      if (!existingItem) {
        category.items.push(structuredClone(initialItem));
        return;
      }

      if (initialItem.allowAddons === true) existingItem.allowAddons = true;
      if (initialItem.isAddon === true) existingItem.isAddon = true;
    });
  });

  return merged;
}


function normalizeMenuData(menuData) {
  const raw = Array.isArray(menuData) ? menuData.slice(0, MAX_CATEGORIES) : [];
  const usedIds = new Set();
  return raw.map((rawCategory, ci) => {
    const category = rawCategory && typeof rawCategory === "object" ? rawCategory : {};
    const categoryName = normalizeText(category.category, MAX_CATEGORY_NAME, `Categoría ${ci + 1}`) || `Categoría ${ci + 1}`;
    const items = Array.isArray(category.items) ? category.items.slice(0, MAX_ITEMS_PER_CATEGORY) : [];
    const normalizedItems = items.map((rawItem, ii) => {
      const item = rawItem && typeof rawItem === "object" ? { ...rawItem } : {};
      const name = normalizeText(item.name, MAX_PRODUCT_NAME, `Producto ${ii + 1}`) || `Producto ${ii + 1}`;
      let id = normalizeProductId(item.id, categoryName, name, ci, ii);
      if (usedIds.has(id)) id = `${id}-${ci + 1}-${ii + 1}`;
      usedIds.add(id);
      const proteinSelector = Array.isArray(item.proteinSelector)
        ? item.proteinSelector.map(v => normalizeText(v, 60)).filter(Boolean).slice(0, 20)
        : undefined;
      const cleanItem = {
        ...item,
        id,
        name,
        price: cleanPrice(item.price, 0),
        description: normalizeText(item.description, MAX_PRODUCT_DESCRIPTION),
        image: normalizeText(item.image, MAX_IMAGE_URL),
        outOfStock: Boolean(item.outOfStock),
        isSoldOut: Boolean(item.isSoldOut),
        isFeatured: Boolean(item.isFeatured),
        allowAddons: Boolean(item.allowAddons),
        isAutoApplied: Boolean(item.isAutoApplied),
        isAddon: Boolean(item.isAddon)
      };
      if (proteinSelector?.length) cleanItem.proteinSelector = proteinSelector;
      else delete cleanItem.proteinSelector;
      const promoDay = Number(item.promoDay);
      if (Number.isInteger(promoDay) && promoDay >= 1 && promoDay <= 6) cleanItem.promoDay = promoDay;
      else delete cleanItem.promoDay;
      return cleanItem;
    });
    return { ...category, category: categoryName, isHidden: Boolean(category.isHidden), items: normalizedItems };
  });
}

function safeExternalUrl(value) {
  if (value == null || value === "") return true;
  try { const url = new URL(String(value)); return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password; }
  catch { return false; }
}
function safeImageUrl(value) {
  if (value == null || value === "") return true;
  const v = String(value);
  return /^\/?(?:images\/|bencho-19\/images\/|api\/images\/)[A-Za-z0-9_./-]+$/.test(v) && !v.includes("..") || safeExternalUrl(v);
}
function validateConfigInput(config) {
  assertSafeObjectKeys(config, "config");
  validateLegalPages(config.legalPages);

  if (JSON.stringify(config).length > MAX_CONFIG_BYTES) {
    throw new ValidationError("La configuración es demasiado grande.");
  }

  const restaurant = config.restaurant;
  assertSafeObjectKeys(restaurant, "restaurant");
  requiredString(restaurant.name, "restaurant.name", 120);
  optionalString(restaurant.subtitle, "restaurant.subtitle", 160);
  optionalString(restaurant.slogan, "restaurant.slogan", 160);
  optionalString(restaurant.fullName, "restaurant.fullName", 160);
  optionalString(restaurant.description, "restaurant.description", MAX_TEXT);
  optionalString(restaurant.whatsapp, "restaurant.whatsapp", 40);
  optionalString(restaurant.instagram, "restaurant.instagram", 300);
  optionalString(restaurant.tiktok, "restaurant.tiktok", 300);
  optionalString(restaurant.location, "restaurant.location", 300);
  for (const key of ["instagram", "tiktok"]) if (!safeExternalUrl(restaurant[key])) throw new ValidationError(`restaurant.${key} requiere una URL HTTP(S) válida.`);
  for (const key of ["logo", "cover", "watermark"]) if (!safeImageUrl(restaurant[key])) throw new ValidationError(`restaurant.${key} requiere una imagen válida.`);
  optionalString(restaurant.logo, "restaurant.logo", MAX_IMAGE_URL);
  optionalString(restaurant.watermark, "restaurant.watermark", MAX_IMAGE_URL);
  optionalString(restaurant.cover, "restaurant.cover", MAX_IMAGE_URL);

  if (config.exchangeDivisors != null) {
    assertSafeObjectKeys(config.exchangeDivisors, "exchangeDivisors");
    for (const currency of ["usd", "bs"]) {
      const value = config.exchangeDivisors[currency];
      if (value != null && value !== "") finiteNumber(value, `exchangeDivisors.${currency}`, { min: 0.000001, max: 1e9 });
    }
  }
  if (config.paymentMethods != null) {
    if (!Array.isArray(config.paymentMethods) || !config.paymentMethods.length || config.paymentMethods.length > 20)
      throw new ValidationError("Configura entre 1 y 20 métodos de pago.");
    const ids = new Set(), names = new Set();
    for (const [i, method] of config.paymentMethods.entries()) {
      assertSafeObjectKeys(method, `paymentMethods[${i}]`);
      const id = requiredString(method.id, `paymentMethods[${i}].id`, 120);
      if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/.test(id)) throw new ValidationError("Identificador de pago inválido.");
      const name = requiredString(method.name, `paymentMethods[${i}].name`, 60);
      if (ids.has(id) || names.has(name.toLocaleLowerCase('es'))) throw new ValidationError("No repitas métodos de pago.");
      ids.add(id); names.add(name.toLocaleLowerCase('es'));
    }
  }
  finiteNumber(config.deliveryCost ?? 0, "deliveryCost", { min: 0, max: MAX_PRICE });
  optionalString(config.hoursText, "hoursText", 300);

  if (config.schedule != null) {
    assertSafeObjectKeys(config.schedule, "schedule");
    const timeFields = ["openingTime", "closingTime", "secondOpeningTime", "secondClosingTime"];
    for (const field of timeFields) {
      if (config.schedule[field] != null) {
        if (typeof config.schedule[field] !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(config.schedule[field])) {
          throw new ValidationError(`schedule.${field} debe tener formato HH:MM.`);
        }
      }
    }
    if (config.schedule.secondShiftEnabled != null && typeof config.schedule.secondShiftEnabled !== "boolean") {
      throw new ValidationError("schedule.secondShiftEnabled debe ser booleano.");
    }
  }

  if (config.theme != null) assertSafeObjectKeys(config.theme, "theme");

  if (config.storeStatus != null) {
    assertSafeObjectKeys(config.storeStatus, "storeStatus");
    if (config.storeStatus.forceClose != null && typeof config.storeStatus.forceClose !== "boolean") {
      throw new ValidationError("storeStatus.forceClose debe ser booleano.");
    }
  }

  if (config.googleReviews != null) {
    assertSafeObjectKeys(config.googleReviews, "googleReviews");
    const rating = Number(config.googleReviews.rating ?? 0);
    if (!Number.isFinite(rating) || rating < 0 || rating > 5) {
      throw new ValidationError("googleReviews.rating debe estar entre 0 y 5.");
    }
    const totalReviews = Number(config.googleReviews.totalReviews ?? 0);
    if (!Number.isInteger(totalReviews) || totalReviews < 0) {
      throw new ValidationError("googleReviews.totalReviews debe ser un entero no negativo.");
    }
    optionalString(config.googleReviews.url, "googleReviews.url", 500);
    if (!safeExternalUrl(config.googleReviews.url)) throw new ValidationError("URL de reseñas inválida.");
  }

  if (!Array.isArray(config.deliveryZones)) {
    throw new ValidationError("deliveryZones debe ser una lista.");
  }
  if (config.deliveryZones.length > 50) {
    throw new ValidationError("Demasiadas zonas de delivery.");
  }
  config.deliveryZones.forEach((zone, i) => {
    assertSafeObjectKeys(zone, `deliveryZones[${i}]`);
    requiredString(zone.name, `deliveryZones[${i}].name`, 80);
    finiteNumber(zone.price, `deliveryZones[${i}].price`, { min: 0, max: MAX_PRICE });
  });

  if (!Array.isArray(config.menuData)) {
    throw new ValidationError("menuData debe ser una lista.");
  }
  if (config.menuData.length > MAX_CATEGORIES) {
    throw new ValidationError("Demasiadas categorías.");
  }

  config.menuData.forEach((category, ci) => {
    assertSafeObjectKeys(category, `menuData[${ci}]`);
    requiredString(category.category, `menuData[${ci}].category`, MAX_CATEGORY_NAME);
    if (category.isHidden != null && typeof category.isHidden !== "boolean") {
      throw new ValidationError(`menuData[${ci}].isHidden debe ser booleano.`);
    }
    if (!Array.isArray(category.items)) {
      throw new ValidationError(`menuData[${ci}].items debe ser una lista.`);
    }
    if (category.items.length > MAX_ITEMS_PER_CATEGORY) {
      throw new ValidationError(`La categoría "${category.category}" tiene demasiados productos.`);
    }

    category.items.forEach((item, ii) => {
      assertSafeObjectKeys(item, `menuData[${ci}].items[${ii}]`);
      requiredString(item.name, `menuData[${ci}].items[${ii}].name`, MAX_PRODUCT_NAME);
      finiteNumber(item.price, `menuData[${ci}].items[${ii}].price`, { min: 0, max: MAX_PRICE });
      optionalString(item.description, `menuData[${ci}].items[${ii}].description`, MAX_PRODUCT_DESCRIPTION);
      optionalString(item.image, `menuData[${ci}].items[${ii}].image`, MAX_IMAGE_URL);
      if (!safeImageUrl(item.image)) throw new ValidationError("La imagen del producto debe tener una URL HTTP(S) o ruta válida.");

      for (const key of ["outOfStock", "isSoldOut", "isFeatured", "allowAddons", "isAutoApplied", "isAddon"]) {
        if (item[key] != null && typeof item[key] !== "boolean") {
          throw new ValidationError(`menuData[${ci}].items[${ii}].${key} debe ser booleano.`);
        }
      }

      if (item.proteinSelector != null) {
        if (!Array.isArray(item.proteinSelector)) {
          throw new ValidationError(`menuData[${ci}].items[${ii}].proteinSelector debe ser una lista.`);
        }
        item.proteinSelector.forEach((option, oi) => {
          requiredString(option, `menuData[${ci}].items[${ii}].proteinSelector[${oi}]`, 60);
        });
      }

      if (item.promoDay != null) {
        const promoDay = Number(item.promoDay);
        if (!Number.isInteger(promoDay) || promoDay < 1 || promoDay > 6) {
          throw new ValidationError(`menuData[${ci}].items[${ii}].promoDay debe ser un entero entre 1 y 6.`);
        }
      }
    });
  });
}

function normalizeDivisor(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0.000001 && number <= 1e9 ? number : null;
}
function legacyDivisors(payments) {
  const old = payments && typeof payments === "object" ? payments : {};
  const usd = normalizeDivisor(old.copPerUsd);
  return {
    usd,
    bs: normalizeDivisor(old.copPerBs) ||
      (usd && normalizeDivisor(old.bsPerUsd) ? normalizeDivisor(usd / Number(old.bsPerUsd)) : null)
  };
}
function normalizePaymentMethods(value) {
  if (!Array.isArray(value)) return structuredClone(INITIAL_CONFIG.paymentMethods);
  const seenIds = new Set(), seenNames = new Set();
  const valid = [];
  for (const item of value.slice(0, 20)) {
    const id = typeof item?.id === 'string' ? item.id.trim() : '';
    const name = typeof item?.name === 'string' ? item.name.trim().slice(0, 60) : '';
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/.test(id) || !name) continue;
    if (seenIds.has(id) || seenNames.has(name.toLocaleLowerCase('es'))) continue;
    seenIds.add(id); seenNames.add(name.toLocaleLowerCase('es'));
    valid.push({ id, name });
  }
  return valid.length ? valid : structuredClone(INITIAL_CONFIG.paymentMethods);
}
const LEGAL_PAGE_KEYS = ["privacidad", "cookies", "terminos", "eliminar-datos"];
function normalizeLegalPages(value) {
  const src = isPlainObject(value) ? value : {};
  const out = {};
  for (const key of LEGAL_PAGE_KEYS) {
    const defaultPage = INITIAL_CONFIG.legalPages[key];
    const page = isPlainObject(src[key]) ? src[key] : {};
    out[key] = {
      title: normalizeText(page.title, 120, defaultPage.title) || defaultPage.title,
      body: normalizeText(page.body, 14000, defaultPage.body) || defaultPage.body
    };
  }
  return out;
}
function validateLegalPages(value) {
  if (value == null) return;
  assertSafeObjectKeys(value, "legalPages");
  for (const key of Object.keys(value)) {
    if (!LEGAL_PAGE_KEYS.includes(key)) throw new ValidationError("Página legal desconocida.");
    assertSafeObjectKeys(value[key], `legalPages.${key}`);
    requiredString(value[key].title, `legalPages.${key}.title`, 120);
    requiredString(value[key].body, `legalPages.${key}.body`, 14000);
  }
}
function cleanConfig(input) {
  const source = input && typeof input === "object" ? input : {};
  const base = Array.isArray(source.menuData) ? source.menuData : INITIAL_CONFIG.menuData;
  const zonesRaw = Array.isArray(source.deliveryZones)
    ? source.deliveryZones.slice(0, 50)
    : structuredClone(INITIAL_CONFIG.deliveryZones || []);
  const usedZoneIds = new Set();
  const deliveryZones = zonesRaw.map((rawZone, index) => {
    const zone = rawZone && typeof rawZone === "object" ? rawZone : {};
    const name = normalizeText(zone.name, 80, `Zona ${index + 1}`) || `Zona ${index + 1}`;
    let id = normalizeZoneId(zone.id, name, index);
    if (usedZoneIds.has(id)) id = `${id}-${index + 1}`;
    usedZoneIds.add(id);
    return { id, name, price: cleanPrice(zone.price, 0) };
  }).filter(zone => zone.name);

  const restaurantSource = source.restaurant && typeof source.restaurant === "object" ? source.restaurant : {};
  const themeSource = source.theme && typeof source.theme === "object" ? source.theme : {};
  const statusSource = source.storeStatus && typeof source.storeStatus === "object" ? source.storeStatus : {};
  const reviewsSource = source.googleReviews && typeof source.googleReviews === "object" ? source.googleReviews : {};
  const scheduleSource = source.schedule && typeof source.schedule === "object" ? source.schedule : {};
  const defaultSchedule = INITIAL_CONFIG.schedule || { openingTime: "11:00", closingTime: "15:00", secondOpeningTime: "18:00", secondClosingTime: "23:00", secondShiftEnabled: true };
  const safeSchedule = {
    openingTime: /^([01]\d|2[0-3]):[0-5]\d$/.test(String(scheduleSource.openingTime || "")) ? String(scheduleSource.openingTime) : defaultSchedule.openingTime,
    closingTime: /^([01]\d|2[0-3]):[0-5]\d$/.test(String(scheduleSource.closingTime || "")) ? String(scheduleSource.closingTime) : defaultSchedule.closingTime,
    secondOpeningTime: /^([01]\d|2[0-3]):[0-5]\d$/.test(String(scheduleSource.secondOpeningTime || "")) ? String(scheduleSource.secondOpeningTime) : defaultSchedule.secondOpeningTime,
    secondClosingTime: /^([01]\d|2[0-3]):[0-5]\d$/.test(String(scheduleSource.secondClosingTime || "")) ? String(scheduleSource.secondClosingTime) : defaultSchedule.secondClosingTime,
    secondShiftEnabled: scheduleSource.secondShiftEnabled !== false
  };

  return {
    legalPages: normalizeLegalPages(source.legalPages),
    restaurant: {
      ...INITIAL_CONFIG.restaurant, ...restaurantSource,
      name: normalizeText(restaurantSource.name, 120, INITIAL_CONFIG.restaurant.name),
      subtitle: normalizeText(restaurantSource.subtitle, 160),
      slogan: normalizeText(restaurantSource.slogan, 160),
      fullName: normalizeText(restaurantSource.fullName, 160),
      description: normalizeText(restaurantSource.description, MAX_TEXT),
      whatsapp: normalizeText(restaurantSource.whatsapp, 40),
      instagram: (safeExternalUrl(restaurantSource.instagram) ? normalizeText(restaurantSource.instagram, 300) : ""),
      tiktok: (safeExternalUrl(restaurantSource.tiktok) ? normalizeText(restaurantSource.tiktok, 300) : ""),
      location: normalizeText(restaurantSource.location, 300),
      logo: normalizeText(restaurantSource.logo, MAX_IMAGE_URL),
      watermark: normalizeText(restaurantSource.watermark, MAX_IMAGE_URL),
      cover: normalizeText(restaurantSource.cover, MAX_IMAGE_URL)
    },
    // Migración sin pérdida: los valores antiguos se convierten UNA VEZ al leer.
    // Si la nueva propiedad existe (incluso con valores nulos), manda sobre lo anterior.
    exchangeDivisors: source.exchangeDivisors && isPlainObject(source.exchangeDivisors) ? {
      usd: normalizeDivisor(source.exchangeDivisors.usd),
      bs: normalizeDivisor(source.exchangeDivisors.bs)
    } : legacyDivisors(source.payments),
    paymentMethods: normalizePaymentMethods(source.paymentMethods),
    deliveryCost: cleanPrice(source.deliveryCost, cleanPrice(INITIAL_CONFIG.deliveryCost, 0)),
    deliveryZones,
    schedule: safeSchedule,
    hoursText: normalizeText(source.hoursText, 300, INITIAL_CONFIG.hoursText),
    theme: { ...INITIAL_CONFIG.theme, ...themeSource },
    storeStatus: { ...INITIAL_CONFIG.storeStatus, ...statusSource, forceClose: Boolean(statusSource.forceClose) },
    googleReviews: {
      ...INITIAL_CONFIG.googleReviews, ...reviewsSource,
      rating: Math.max(0, Math.min(5, Number(reviewsSource.rating ?? INITIAL_CONFIG.googleReviews.rating) || 0)),
      totalReviews: Math.max(0, Math.min(1000000, Math.floor(Number(reviewsSource.totalReviews ?? INITIAL_CONFIG.googleReviews.totalReviews) || 0))),
      url: safeExternalUrl(reviewsSource.url) ? normalizeText(reviewsSource.url, 500) : ""
    },
    menuData: normalizeMenuData(base)
  };
}

async function loadConfig() {
  const entry = await store().getWithMetadata(KEY, { type: 'json' });
  const clean = cleanConfig(entry?.data || INITIAL_CONFIG);
  clean._revision = entry?.etag || 'new';
  return clean;
}
// Use an application header; retain body/legacy transport compatibility.
// Never replace the client's revision with a freshly fetched server revision.
function configRevision(request, input) {
  return request.headers.get('x-config-revision') || request.headers.get('if-match') || input?._revision;
}
async function saveConfig(input, expectedRevision) {
  safeTree(input);
  validateConfigInput(input);
  if (!expectedRevision || typeof expectedRevision !== 'string') throw new HttpError(428, 'Recarga el panel antes de guardar.');
  const current = await store().getWithMetadata(KEY, { type: 'json' });
  if ((current?.etag || 'new') !== expectedRevision) throw new HttpError(409, 'Otro administrador cambió la carta. Recarga el panel antes de guardar.');
  const clean = cleanConfig(input);
  // Last 30 UTC daily snapshots, outside public API. Write backup before mutation.
  if (current) {
    const day = Math.floor(Date.now()/86400000);
    const backups = getStore({ name: STORE_NAME + '-backups-v2', consistency: 'strong' });
    await backups.setJSON('day-' + day % 30, { createdAt: Date.now(), config: current.data });
  }
  const result = await conditionalJSON(store(), KEY, clean, current ? { onlyIfMatch: current.etag } : { onlyIfNew: true });
  if (!result.modified) throw new HttpError(409, 'Otro administrador guardó al mismo tiempo. Recarga el panel.');
  return { ...clean, _revision: result.etag };
}

function imageStore() {
  return getStore({ name: IMAGE_STORE_NAME, consistency: "strong" });
}

function imageExtension(contentType) {
  const map = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif"
  };
  return map[contentType] || null;
}

function uploadedImageKeyFromUrl(value) {
  const raw = String(value || "");
  const match = raw.match(/\/api\/images\/([0-9a-f-]{36}\.(?:jpg|jpeg|png|webp|gif))$/i);
  return match ? match[1] : null;
}

async function deleteOldImage(value) {
  const key = uploadedImageKeyFromUrl(value);
  if (key) await imageStore().delete(key);
}

async function handleImageDelete(request) {
  if (!(await isAuthenticated(request))) return json({ ok: false, error: "No autorizado." }, 401);

  const body = await readJSON(request, 4096);
  const target = String(body.target || "product");
  const config = await loadConfig();
  let current = null;

  if (target === "product") {
    const ci = Number(body.categoryIndex);
    const ii = Number(body.itemIndex);
    const item = config.menuData?.[ci]?.items?.[ii];
    if (!item) return json({ ok: false, error: "Producto no encontrado." }, 404);
    current = item.image || null;
    item.image = "";
  } else if (target === "logo" || target === "watermark" || target === "cover") {
    const field = target === "logo" ? "logo" : target === "watermark" ? "watermark" : "cover";
    current = config.restaurant?.[field] || null;
    config.restaurant[field] = "";
  } else {
    return json({ ok: false, error: "Destino de imagen no válido." }, 400);
  }

  const saved = await saveConfig(config, configRevision(request));
  return json({ ok: true, config: saved });
}

async function handleImageUpload(request) {
  if (!(await isAuthenticated(request))) return json({ ok: false, error: "No autorizado." }, 401);

  const form = await request.formData();
  const file = await sanitizeImage(form.get("file"), MAX_IMAGE_BYTES);
  const target = String(form.get("target") || "product");

  if (!(file instanceof File)) return json({ ok: false, error: "No se recibió una imagen." }, 400);
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) return json({ ok: false, error: "Formato no permitido. Usa JPG, PNG, WEBP o GIF." }, 400);
  if (file.size <= 0) return json({ ok: false, error: "La imagen está vacía." }, 400);
  if (file.size > MAX_IMAGE_BYTES) return json({ ok: false, error: "La imagen supera el límite de 5 MB." }, 400);

  const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const mime = file.type;
  const validSignature = (mime === "image/jpeg" && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) ||
    (mime === "image/png" && header.slice(0, 8).every((n, i) => n === [137,80,78,71,13,10,26,10][i])) ||
    (mime === "image/webp" && String.fromCharCode(...header.slice(0,4)) === "RIFF" && String.fromCharCode(...header.slice(8,12)) === "WEBP") ||
    (mime === "image/gif" && ["GIF87a","GIF89a"].includes(String.fromCharCode(...header.slice(0,6))));
  if (!validSignature) return json({ ok:false, error:"La imagen no corresponde al formato indicado." }, 400);
  const ext = imageExtension(file.type);
  const key = `${crypto.randomUUID()}.${ext}`;
  await imageStore().set(key, file, {
    metadata: { contentType: file.type, createdAt: Date.now() }
  });

  const config = await loadConfig();
  const publicUrl = `/api/images/${key}`;

  if (target === "product") {
    const ci = Number(form.get("categoryIndex"));
    const ii = Number(form.get("itemIndex"));
    const item = config.menuData?.[ci]?.items?.[ii];
    if (!item) {
      await imageStore().delete(key);
      return json({ ok: false, error: "Producto no encontrado." }, 404);
    }
    item.image = publicUrl;
  } else if (target === "logo" || target === "watermark" || target === "cover") {
    const field = target === "logo" ? "logo" : target === "watermark" ? "watermark" : "cover";
    config.restaurant[field] = publicUrl;
  } else {
    await imageStore().delete(key);
    return json({ ok: false, error: "Destino de imagen no válido." }, 400);
  }

  let saved;
  try { saved = await saveConfig(config, configRevision(request)); }
  catch (error) { await imageStore().delete(key); throw error; }
  return json({ ok: true, imageUrl: publicUrl, config: saved });
}

async function serveImage(request) {
  const path = getApiPath(request);
  const encodedKey = path.startsWith("/images/") ? path.slice("/images/".length) : "";
  const key = decodeURIComponent(encodedKey);
  if (!/^[0-9a-f-]{36}\.(?:jpg|jpeg|png|webp|gif)$/i.test(key)) return new Response("Not found", { status: 404 });

  const entry = await imageStore().getWithMetadata(key, {
    consistency: 'strong',
    type: 'arrayBuffer'
  });
  if (!entry || entry.data === null) return new Response('Not found', { status: 404 });

  const contentType = entry.metadata?.contentType || 'application/octet-stream';
  const body = entry.data;

  return new Response(body, {
    status: 200,
    headers: {
      'content-type': contentType,
      'cache-control': 'public, max-age=31536000, immutable',
      'x-content-type-options': 'nosniff'
    }
  });
}

function getApiPath(request) {
  const pathname = new URL(request.url).pathname;
  return pathname
    .replace(/^\/api/, "")
    .replace(/^\/\.netlify\/functions\/api/, "") || "/";
}



// Audited standard edition. WhatsApp orders are not server records.
export const config = { path: '/api/*', rateLimit: { windowLimit: 600, windowSize: 60, aggregateBy: ['ip','domain'], action: 'rate_limit' } };
async function route(request, context) {
  const path = getApiPath(request), method = request.method;
  if (!['GET','POST','PUT'].includes(method)) throw new HttpError(405, 'Método no permitido.', { Allow: 'GET, POST, PUT' });
  if (method !== 'GET') sameOrigin(request);
  if (method === 'GET' && path === '/health') return json({ ok:true, edition:'standard', security:2 });
  if (method === 'GET' && path === '/config') { const data=await loadConfig();delete data._revision;return json(data); }
  if (method === 'GET' && path.startsWith('/images/')) return serveImage(request);
  if (method === 'POST' && path === '/login') {
    const result=await login(request,context);
    return json({ok:true,csrfToken:result.csrf},200,{'set-cookie':cookie(result.raw)});
  }
  if (method === 'GET' && path === '/session') {
    const auth=await session(request);
    return json({authenticated:Boolean(auth),configured:configured(),...(auth?{csrfToken:auth.csrf}:{})});
  }
  if (path.startsWith('/admin/') || path === '/logout') {
    const auth=await session(request);
    if(!auth) throw new HttpError(401,'No autorizado.');
    if(method !== 'GET') csrfCheck(request,auth);
    if(method === 'POST' && path === '/logout') { await logout(request);return json({ok:true},200,{'set-cookie':cookie('',0)}); }
    await limit(`admin:${auth.key}`,180,60000);
    if(method === 'GET' && path === '/admin/config') return json(await loadConfig(),200,{'x-csrf-token':auth.csrf});
    if(method === 'PUT' && path === '/admin/config') {
      await limit('config:write',60,60000);
      const input=await readJSON(request);
      return json({ok:true,config:await saveConfig(input,configRevision(request,input))});
    }
    if(method === 'POST' && ['/admin/upload-image','/admin/delete-image'].includes(path)) {
      await limit('images:write',30,600000);
      if(!configRevision(request)) throw new HttpError(428,'Recarga el panel antes de guardar.');
      request=await boundedRequest(request,path.endsWith('upload-image')?MAX_IMAGE_BYTES+65536:4096);
      if(path.endsWith('upload-image')) {
        if(!request.headers.get('content-type')?.startsWith('multipart/form-data;')) throw new HttpError(415,'Se requiere multipart/form-data.');
        return handleImageUpload(request);
      }
      return handleImageDelete(request);
    }
  }
  throw new HttpError(404,'Ruta no disponible en la edición estándar.');
}
export default async function handler(request,context={}) {
  try { return secureResponse(await route(request,context)); }
  catch(error) {
    if(error instanceof HttpError) return secureResponse(json({ok:false,error:error.message},error.status,error.headers));
    if(error instanceof ValidationError || error instanceof SyntaxError || error instanceof URIError) return secureResponse(json({ok:false,error:error instanceof ValidationError?error.message:'Solicitud inválida.'},400));
    // No cookies, passwords, personal content or SDK context in logs.
    console.error('API operation failed');
    return secureResponse(json({ok:false,error:'Servicio temporalmente no disponible.'},503));
  }
}

