/**
 * Sondage périodique qui respecte la visibilité de la page.
 *
 * Les sondages de l'app (sessions d'amis toutes les 8 s, badge de
 * notifications toutes les 30 s…) tournaient même quand l'app était en
 * arrière-plan ou l'écran éteint. Chaque réveil enchaîne une requête réseau
 * puis un `setState`, donc un rendu complet de la page : sur un appareil
 * modeste, c'est du temps CPU et de la batterie dépensés pour un écran que
 * personne ne regarde — et au retour au premier plan, tous les sondages en
 * retard se déclenchent en rafale.
 *
 * Ici, le minuteur ne déclenche rien tant que la page est cachée, et un seul
 * rattrapage est fait au retour au premier plan.
 */
export function startVisibilityPolling(
  fn: () => void,
  intervalMs: number,
  /** `immediate: false` quand l'appelant a déjà chargé les données lui-même. */
  { immediate = true }: { immediate?: boolean } = {},
): () => void {
  let lastRun = 0;

  const run = () => {
    lastRun = Date.now();
    fn();
  };

  const tick = () => {
    if (document.hidden) return;
    run();
  };

  const onVisibilityChange = () => {
    // Au retour au premier plan, on rafraîchit si l'intervalle est écoulé —
    // une seule fois, pas une fois par réveil manqué.
    if (!document.hidden && Date.now() - lastRun >= intervalMs) run();
  };

  if (immediate) run();
  else lastRun = Date.now();
  const timer = window.setInterval(tick, intervalMs);
  document.addEventListener('visibilitychange', onVisibilityChange);

  return () => {
    window.clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisibilityChange);
  };
}
