import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  onComplete: () => void;
}

export default function SplashScreen({ onComplete }: Props) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const hide = setTimeout(() => setVisible(false), 1800);
    const done = setTimeout(() => onComplete(), 2600);
    return () => {
      clearTimeout(hide);
      clearTimeout(done);
    };
  }, [onComplete]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="splash"
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-6 bg-background"
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: 'easeInOut' }}
        >
          <motion.img
            src="/jux-icon-512.png"
            alt="Nexora-Music"
            className="w-48 h-48 rounded-2xl shadow-2xl"
            initial={{ opacity: 0, scale: 0.85, y: -16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
          <motion.h1
            className="text-4xl font-bold tracking-widest text-foreground"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.35, ease: 'easeOut' }}
          >
            Nexora-Music
          </motion.h1>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
