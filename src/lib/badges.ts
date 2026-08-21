/**
 * Le champ `badge` des profils est un texte libre (rempli à la main dans
 * PocketBase), donc son contenu ne doit jamais être utilisé tel quel comme
 * preuve d'un rôle : seules les valeurs contenant "PDG" ou "Publicateur"
 * correspondent à un rôle reconnu par l'app. Toute autre valeur (fautes de
 * frappe, texte non lié à un rôle…) doit être traitée comme l'absence de
 * badge.
 */

export type BadgeRole = 'PDG' | 'Publicateur';

export function normalizeBadge(raw: string | null | undefined): BadgeRole | null {
  if (!raw) return null;
  if (raw.includes('PDG')) return 'PDG';
  if (raw.includes('Publicateur')) return 'Publicateur';
  return null;
}

export function canPublish(raw: string | null | undefined): boolean {
  return normalizeBadge(raw) !== null;
}
