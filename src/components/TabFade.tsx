import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

interface Props {
  /** Clé qui identifie l'onglet actif — change = crossfade. */
  tabKey: string;
  children: React.ReactNode;
  className?: string;
}

/** Fondu doux du contenu quand on change d'onglet/catégorie. */
export default function TabFade({ tabKey, children, className }: Props) {
  const reduceMotion = useReducedMotion();
  const y = reduceMotion ? 0 : 8;

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={tabKey}
        initial={{ opacity: 0, y }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -y }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
