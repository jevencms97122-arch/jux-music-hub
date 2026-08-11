/** Clé localStorage partagée entre TauriUpdateManager (écrit avant l'install) et
 * UpdateAppliedNotice (lit au démarrage suivant pour afficher les notes de version). */
export const UPDATE_TRANSITION_KEY = 'jux:updateTransition';

export interface UpdateTransition {
  from: string;
  to: string;
}
