import { useEffect, useRef, useState } from 'react';

/**
 * Lazy loading de section : `visible` passe à true (définitivement) quand
 * l'élément référencé approche du viewport. On ne déclenche les requêtes
 * backend qu'à ce moment-là, pour ne pas solliciter le serveur pour des
 * sections que l'utilisateur ne verra jamais.
 *
 * @param rootMargin marge de pré-chargement (par défaut 300px avant d'entrer à l'écran)
 */
export function useLazySection<T extends HTMLElement = HTMLDivElement>(rootMargin = '300px') {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (visible) return;
    const el = ref.current;
    if (!el) return;

    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [visible, rootMargin]);

  return { ref, visible };
}
