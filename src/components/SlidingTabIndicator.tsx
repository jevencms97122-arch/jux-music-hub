import { motion, useReducedMotion } from 'framer-motion';

/**
 * Fond glissant d'un onglet actif dans une barre de type segmented control.
 * À placer en premier enfant du bouton actif (position relative + z-10 sur le bouton).
 */
export default function SlidingTabIndicator({ layoutId }: { layoutId: string }) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return <span className="absolute inset-0 -z-10 rounded-xl bg-gradient-primary shadow-elegant-sm" />;
  }

  return (
    <motion.span
      layoutId={layoutId}
      className="absolute inset-0 -z-10 rounded-xl bg-gradient-primary shadow-elegant-sm"
      transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }}
    />
  );
}
