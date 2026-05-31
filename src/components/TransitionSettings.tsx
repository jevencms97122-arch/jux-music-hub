import { usePlayer } from '@/contexts/PlayerContext';
import { TRANSITION_MODES } from '@/contexts/PlayerContext';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';

export default function TransitionSettings() {
  const { crossfadeSeconds, setCrossfadeSeconds, transitionMode, setTransitionMode } = usePlayer();

  return (
    <div className="space-y-4">
      {/* Crossfade Toggle and Duration */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Fondu enchaîné</label>
          <Switch 
            checked={crossfadeSeconds > 0} 
            onCheckedChange={(checked) => checked ? setCrossfadeSeconds(3) : setCrossfadeSeconds(0)}
          />
        </div>
        
        {crossfadeSeconds > 0 && (
          <div className="space-y-2 pl-2">
            <div>
              <label className="text-xs text-muted-foreground block mb-2">Durée du fondu</label>
              <Slider 
                value={[crossfadeSeconds]} 
                min={1}
                max={12}
                step={0.5}
                onValueChange={(v) => setCrossfadeSeconds(v[0])}
                className="w-full"
              />
              <span className="text-xs text-muted-foreground mt-1 block">{crossfadeSeconds.toFixed(1)} s</span>
            </div>
          </div>
        )}
      </div>

      {/* Transition Type Selection */}
      <div className="space-y-2">
        <label className="text-sm font-medium block">Type de transition</label>
        <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-2">
          {TRANSITION_MODES.map((mode) => (
            <button
              key={mode.value}
              onClick={() => setTransitionMode(mode.value)}
              className={`px-3 py-2 text-xs rounded transition-all font-medium whitespace-nowrap overflow-hidden text-ellipsis ${
                transitionMode === mode.value
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'bg-muted hover:bg-muted/80 text-muted-foreground'
              }`}
              title={mode.description}
            >
              {mode.label}
            </button>
          ))}
        </div>
        {TRANSITION_MODES.find(m => m.value === transitionMode) && (
          <p className="text-xs text-muted-foreground italic mt-2 p-2 bg-muted rounded">
            {TRANSITION_MODES.find(m => m.value === transitionMode)?.description}
          </p>
        )}
      </div>
    </div>
  );
}
