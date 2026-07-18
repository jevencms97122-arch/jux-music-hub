import type { AppTheme } from '@/themes/appThemes';
import { cn } from '@/lib/utils';
import type { NebulaColors } from '@/lib/ultraNebulaPalette';
import MatrixRain from './MatrixRain';
import StarField from './StarField';
import AuroraNebula from './AuroraNebula';
import SymbolMatrix from './SymbolMatrix';
import { SYMBOL_PRESET_DEFAULT_ID } from '@/lib/ultraSymbolPresets';

/**
 * Fonds "Ultra" : composants DOM animés (pas de simple CSS background-position),
 * bien plus gourmands en ressources (backdrop-filter + gradients multiples).
 * `ultraId` sélectionne l'effet à monter.
 */
export default function UltraBackground({
  theme,
  paused,
  nebulaColors,
  nebulaSpeed,
  symbolPresetId,
}: {
  theme: AppTheme;
  paused: boolean;
  nebulaColors?: NebulaColors | null;
  nebulaSpeed?: number;
  symbolPresetId?: string;
}) {
  if (!theme.isUltra) return null;

  switch (theme.ultraId) {
    case 'starfall-rain':
      return (
        <div
          aria-hidden
          className={cn('ultra-starfall', paused && 'paused')}
          style={{ ['--ultra-c' as string]: theme.accentColor }}
        >
          <div className="ultra-starfall-rain" />
        </div>
      );
    case 'matrix-rain':
      return <MatrixRain accentColor={theme.accentColor} paused={paused} />;
    case 'star-field':
      return <StarField paused={paused} />;
    case 'aurora-nebula':
      return <AuroraNebula colors={nebulaColors ?? null} speed={nebulaSpeed ?? 1} paused={paused} />;
    case 'symbol-matrix':
      return <SymbolMatrix presetId={symbolPresetId ?? SYMBOL_PRESET_DEFAULT_ID} paused={paused} />;
    default:
      return null;
  }
}
