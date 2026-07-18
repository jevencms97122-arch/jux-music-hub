import { cn } from '@/lib/utils';
import { getSymbolPreset } from '@/lib/ultraSymbolPresets';

const SYMBOLS = [
  '+', '−', '×', '÷', '=', '≠', '≈', '∞', '√', '∑', '∏', '∫', '∂', '∆', 'π', 'θ', 'λ', 'μ', 'σ', 'ω',
  'α', 'β', 'γ', 'δ', 'ε', 'ζ', 'η', 'ι', 'κ', 'ν', 'ξ', 'ρ', 'τ', 'φ', 'χ', 'ψ',
  '∈', '∉', '∩', '∪', '⊂', '⊃', '⊆', '⊇', '∧', '∨', '¬', '⇒', '⇔', '∀', '∃',
  'ℕ', 'ℤ', 'ℚ', 'ℝ', 'ℂ', '|', '∥', '∠', '⊥', '≅', '∝', '∴', '∵', '⊕', '⊗', '⊥', '⊢', '⊨', '∇',
];

const SPAN_COUNT = 800;

export default function SymbolMatrix({ presetId, paused }: { presetId: string; paused: boolean }) {
  const preset = getSymbolPreset(presetId);
  const style: Record<string, string> = {
    '--sym-idle': preset.idle,
    '--sym-c1': preset.c1,
    '--sym-c2': preset.c2,
    '--sym-c3': preset.c3,
  };
  return (
    <div aria-hidden className={cn('ultra-symbols', paused && 'paused')}>
      <div className="ultra-symbols-grid" style={style}>
        {Array.from({ length: SPAN_COUNT }).map((_, i) => (
          <span key={i}>{SYMBOLS[i % SYMBOLS.length]}</span>
        ))}
      </div>
    </div>
  );
}
