import { lazy, type ComponentType } from 'react';

import type { DotMatrixCommonProps } from '@/lib/dotmatrix-core';

/**
 * Chargement à la demande des animations de démarrage "dot matrix".
 *
 * Il y en a 89, et l'écran de démarrage n'en affiche qu'une, tirée au sort. Les
 * importer toutes statiquement mettait les 89 composants — plus le noyau
 * `dotmatrix-core` et sa feuille de style de 1 200 lignes — dans le bundle
 * initial, c'est-à-dire sur le chemin critique du démarrage, pour 1/89e
 * d'utilité. Avec `import.meta.glob` en mode paresseux, Vite les découpe en
 * morceaux séparés et seul celui tiré au sort part sur le réseau.
 *
 * Le glob couvre automatiquement les fichiers ajoutés plus tard : rien à tenir
 * à jour ici quand une nouvelle animation arrive.
 */
const modules = import.meta.glob<Record<string, unknown>>('./dotm-*.tsx');

const paths = Object.keys(modules).sort();

/**
 * Chaque fichier exporte son composant sous un nom différent (`DotmSquare1`,
 * `Dotm3x3_12`…). On prend donc la première fonction exportée plutôt que de
 * maintenir une table de 89 noms.
 */
function pickComponent(mod: Record<string, unknown>): ComponentType<DotMatrixCommonProps> {
  const found = Object.values(mod).find((v) => typeof v === 'function');
  if (!found) throw new Error('dotmLoaders: aucun composant exporté');
  return found as ComponentType<DotMatrixCommonProps>;
}

/**
 * Renvoie un composant paresseux tiré au sort, ou `null` s'il n'y a aucune
 * animation disponible (appelant chargé d'afficher un repli).
 */
export function randomDotmLoader(): ComponentType<DotMatrixCommonProps> | null {
  if (paths.length === 0) return null;
  const path = paths[Math.floor(Math.random() * paths.length)];
  return lazy(async () => ({ default: pickComponent(await modules[path]()) }));
}
