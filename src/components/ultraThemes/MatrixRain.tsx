const COLUMNS_PER_PATTERN = 40;
const PATTERN_COUNT = 5;

export default function MatrixRain({ accentColor, paused }: { accentColor: string; paused: boolean }) {
  return (
    <div
      aria-hidden
      className={paused ? 'ultra-matrix paused' : 'ultra-matrix'}
      style={{ ['--ultra-c' as string]: accentColor }}
    >
      {Array.from({ length: PATTERN_COUNT }).map((_, patternIndex) => (
        <div className="ultra-matrix-pattern" key={patternIndex}>
          {Array.from({ length: COLUMNS_PER_PATTERN }).map((_, columnIndex) => (
            <div className="ultra-matrix-column" key={columnIndex} />
          ))}
        </div>
      ))}
    </div>
  );
}
