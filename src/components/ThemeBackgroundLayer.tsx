import { useTheme } from '@/contexts/ThemeContext';
import UltraBackground from '@/components/ultraThemes/UltraBackground';

/**
 * Repeint le fond du thème actif (animé ou Ultra) localement, à l'intérieur d'un
 * conteneur qui a déjà son propre empilement (position + z-index). Utile pour les
 * écrans plein écran (Mode Voiture, lecteur) qui ne doivent pas devenir transparents
 * pour voir le thème — d'autres écrans opaques restent montés en dessous et
 * transparaîtraient sinon. On repeint donc le thème par-dessus une base opaque.
 */
export default function ThemeBackgroundLayer() {
  const { currentTheme, nebulaColors, nebulaSpeed, symbolPresetId, animPaused } = useTheme();

  if (currentTheme.isUltra) {
    return (
      <UltraBackground
        theme={currentTheme}
        paused={animPaused}
        nebulaColors={nebulaColors}
        nebulaSpeed={nebulaSpeed}
        symbolPresetId={symbolPresetId}
      />
    );
  }

  if (currentTheme.backgroundAnimation) {
    return (
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: currentTheme.background,
          backgroundSize: '300% 300%',
          animation: currentTheme.backgroundAnimation,
          animationPlayState: animPaused ? 'paused' : 'running',
        }}
      />
    );
  }

  return (
    <div aria-hidden className="absolute inset-0" style={{ background: currentTheme.background }} />
  );
}
