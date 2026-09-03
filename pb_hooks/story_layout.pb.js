/// <reference path="../pb_data/types.d.ts" />

/**
 * Validation serveur du champ `layout` des stories.
 *
 * Les règles d'API PocketBase ne savent pas valider la structure interne d'un
 * champ json : un client modifié pourrait écrire `w: 500` et faire déborder le
 * widget hors du canvas chez tous les spectateurs. On reparse donc et on clamp
 * ici, avant écriture.
 *
 * API JSVM PocketBase v0.23+ ($app.dao() n'existe plus).
 */

const MIN_W = 0.28;
const MAX_W = 1;
const VARIANTS = ["chip", "card", "cover"];
const MAX_LAYOUT_BYTES = 2000;

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function num(v, fallback) {
  return typeof v === "number" && isFinite(v) ? v : fallback;
}

/** Renvoie un layout propre, ou null si le champ est vide (story sans composition). */
function sanitizeLayout(raw) {
  if (raw === null || raw === undefined || raw === "") return null;

  let obj = raw;
  if (typeof obj === "string") {
    if (obj.length > MAX_LAYOUT_BYTES) throw new BadRequestError("layout trop volumineux");
    try {
      obj = JSON.parse(obj);
    } catch (_) {
      throw new BadRequestError("layout invalide");
    }
  }
  if (typeof obj !== "object" || obj === null) throw new BadRequestError("layout invalide");

  const m = obj.music;
  if (typeof m !== "object" || m === null) throw new BadRequestError("layout.music manquant");

  const variant = VARIANTS.indexOf(m.variant) !== -1 ? m.variant : "chip";

  return {
    v: 1,
    music: {
      x: clamp(num(m.x, 0.5), 0, 1),
      y: clamp(num(m.y, 0.86), 0, 1),
      w: clamp(num(m.w, 0.72), MIN_W, MAX_W),
      rot: clamp(num(m.rot, 0), -180, 180),
      variant: variant,
    },
  };
}

function applyLayout(e) {
  const cleaned = sanitizeLayout(e.record.get("layout"));
  if (cleaned === null) e.record.set("layout", null);
  else e.record.set("layout", cleaned);
  e.next();
}

onRecordCreateRequest((e) => applyLayout(e), "stories");
onRecordUpdateRequest((e) => applyLayout(e), "stories");
