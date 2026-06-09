import { useEffect, useRef } from 'react';
import { usePlayer } from '@/contexts/PlayerContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { overlaySignal } from '@/lib/gamepadOverlaySignal';

// ── Config ────────────────────────────────────────────────────────────────────
const STICK_THRESHOLD = 0.45;   // left-stick must exceed this to trigger nav
const DEADZONE        = 0.12;   // ignore analog inputs below this (drift)
const NAV_COOLDOWN_MS = 210;    // min ms between two focus moves
const CURSOR_SPEED    = 4.5;     // px/frame at full left-stick deflection
const CURSOR_HIDE_MS  = 2500;   // hide cursor after this many ms of inactivity

const FOCUSABLE_SEL = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

// ── Spatial nav helpers ───────────────────────────────────────────────────────

function getFocusables(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(FOCUSABLE_SEL)).filter((el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return false;
    const s = window.getComputedStyle(el);
    return s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0';
  });
}

function centerOf(el: Element) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function findNearest(dx: number, dy: number): HTMLElement | null {
  const focusables = getFocusables();
  if (!focusables.length) return null;

  const current = document.activeElement as HTMLElement | null;
  if (!current || !focusables.includes(current)) {
    // Nothing focused: pick element closest to screen center
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    return focusables.reduce((best, el) => {
      const c = centerOf(el);
      const bc = centerOf(best);
      return Math.hypot(c.x - cx, c.y - cy) < Math.hypot(bc.x - cx, bc.y - cy) ? el : best;
    });
  }

  const cc = centerOf(current);
  const dirMag = Math.hypot(dx, dy);
  let best: HTMLElement | null = null;
  let bestScore = Infinity;

  for (const el of focusables) {
    if (el === current) continue;
    const ec = centerOf(el);
    const ex = ec.x - cc.x;
    const ey = ec.y - cc.y;
    const dot = ex * dx + ey * dy;
    if (dot <= 0) continue; // behind current element
    const dist = Math.hypot(ex, ey);
    const cos   = Math.min(1, dot / (dist * dirMag));
    const angle = Math.acos(cos);
    const score = dist * (1 + angle * 2.5);
    if (score < bestScore) { bestScore = score; best = el; }
  }

  return best;
}

function focusNearest(dx: number, dy: number) {
  const t = findNearest(dx, dy);
  if (t) { t.focus(); t.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
}

// ── Cursor (vanilla DOM, no React re-renders) ─────────────────────────────────

function createCursor(): HTMLDivElement {
  const el = document.createElement('div');
  el.id = 'gamepad-cursor';
  // Base styles — color is resolved from CSS variable at runtime
  el.style.cssText = `
    position: fixed;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    border: 2.5px solid hsl(var(--primary));
    background: transparent;
    pointer-events: none;
    z-index: 99999;
    transform: translate(-50%, -50%);
    display: none;
    will-change: left, top;
    transition: background 0.12s ease, box-shadow 0.12s ease;
    box-shadow: 0 0 10px hsl(var(--primary) / 0.35);
  `;
  document.body.appendChild(el);
  return el;
}

function setCursorClick(el: HTMLDivElement, clicked: boolean) {
  if (clicked) {
    el.style.background  = 'hsl(var(--primary) / 0.55)';
    el.style.boxShadow   = '0 0 18px hsl(var(--primary) / 0.65)';
  } else {
    el.style.background  = 'transparent';
    el.style.boxShadow   = '0 0 10px hsl(var(--primary) / 0.35)';
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useGamepad() {
  const player   = usePlayer();
  const navigate = useNavigate();

  // Everything dynamic is in a ref so the rAF loop never captures stale values
  const stateRef = useRef({ player, navigate });
  stateRef.current = { player, navigate };

  const prevRef    = useRef<boolean[]>([]);           // previous button states
  const leftNav    = useRef({ active: false, lastTime: 0 });
  const rafRef     = useRef<number | null>(null);
  const activeRef  = useRef(false);

  useEffect(() => {
    // ── Cursor setup ─────────────────────────────────────────────────────
    // Reuse if already in DOM (HMR-safe)
    const cursor: HTMLDivElement =
      (document.getElementById('gamepad-cursor') as HTMLDivElement | null) ?? createCursor();

    const cursorPos   = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    let cursorVisible = false;
    let lastMoveTime  = 0;

    function showCursor() {
      if (!cursorVisible) {
        cursor.style.left    = `${cursorPos.x}px`;
        cursor.style.top     = `${cursorPos.y}px`;
        cursor.style.display = 'block';
        cursorVisible = true;
      }
    }

    function hideCursor() {
      cursor.style.display = 'none';
      cursorVisible = false;
    }

    function moveCursor(dx: number, dy: number) {
      cursorPos.x = Math.max(0, Math.min(window.innerWidth,  cursorPos.x + dx));
      cursorPos.y = Math.max(0, Math.min(window.innerHeight, cursorPos.y + dy));
      cursor.style.left = `${cursorPos.x}px`;
      cursor.style.top  = `${cursorPos.y}px`;
      lastMoveTime = Date.now();
      showCursor();
    }

    function clickAtCursor() {
      // Flash fill animation
      setCursorClick(cursor, true);
      setTimeout(() => setCursorClick(cursor, false), 180);

      // Use visibility:hidden (not display:none) — keeps layout stable so
      // elementFromPoint returns the element underneath reliably.
      cursor.style.visibility = 'hidden';
      const target = document.elementFromPoint(cursorPos.x, cursorPos.y) as HTMLElement | null;
      cursor.style.visibility = 'visible';

      if (!target || target === document.body || target === document.documentElement) return;

      // Find the nearest clickable ancestor in case target is a child (e.g. <span> inside <button>)
      const clickable = target.closest<HTMLElement>('button, a, [role="button"], input, select, textarea') ?? target;

      try {
        // Dispatch mousedown first — panels that close on outside-mousedown need this
        clickable.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
        clickable.click();
      } catch {
        // Swallow any errors so the rAF loop is never interrupted
      }
    }

    // ── Poll loop ─────────────────────────────────────────────────────────
    function poll() {
      if (!activeRef.current) return;

      const gp = Array.from(navigator.getGamepads()).find((g) => g !== null);

      if (gp) {
        const { player: p, navigate: nav } = stateRef.current;
        const { buttons, axes } = gp;
        const prev = prevRef.current;
        const pressed = (i: number) => !!buttons[i]?.pressed && !prev[i];

        // ── LEFT STICK → cursor (mouse-like) ──────────────────────────
        const lx = axes[0] ?? 0;
        const ly = axes[1] ?? 0;

        if (Math.abs(lx) > DEADZONE || Math.abs(ly) > DEADZONE) {
          const adx = Math.abs(lx) > DEADZONE ? lx : 0;
          const ady = Math.abs(ly) > DEADZONE ? ly : 0;
          moveCursor(adx * CURSOR_SPEED, ady * CURSOR_SPEED);
        } else if (cursorVisible && Date.now() - lastMoveTime > CURSOR_HIDE_MS) {
          hideCursor();
        }

        // ── RIGHT STICK → scroll page ──────────────────────────────────
        const rx = axes[2] ?? 0;
        const ry = axes[3] ?? 0;

        if (Math.abs(rx) > DEADZONE || Math.abs(ry) > DEADZONE) {
          window.scrollBy(
            Math.abs(rx) > DEADZONE ? rx * 14 : 0,
            Math.abs(ry) > DEADZONE ? ry * 14 : 0,
          );
        }

        // ── D-PAD → same spatial nav, discrete ────────────────────────
        if (pressed(12)) focusNearest( 0, -1); // up
        if (pressed(13)) focusNearest( 0,  1); // down
        if (pressed(14)) focusNearest(-1,  0); // left
        if (pressed(15)) focusNearest( 1,  0); // right

        // ── A / Cross → click ─────────────────────────────────────────
        if (pressed(0)) {
          if (cursorVisible) {
            clickAtCursor();
          } else {
            // Cursor hidden: fall back to focused element
            const el = document.activeElement as HTMLElement | null;
            if (el && el !== document.body) el.click();
          }
        }

        // ── B / Circle → ferme l'overlay ouvert, sinon retour ─────────
        if (pressed(1)) {
          if (overlaySignal.any()) {
            // Ferme les panneaux flottants (VolumeControl, PlaybackRateControl)
            document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
            // Ferme aussi les dialogs Radix/shadcn
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true, cancelable: true }));
          } else if (p.isPlayerOpen) {
            p.closePlayer();
          } else {
            nav(-1);
          }
        }

        // ── X / Square → Play / Pause ─────────────────────────────────
        if (pressed(2)) p.togglePlay();

        // ── Y / Triangle → open / close full player ───────────────────
        if (pressed(3)) {
          if (p.isPlayerOpen) p.closePlayer();
          else if (p.currentSong) p.openPlayer();
        }

        // ── LB / L1 → previous ────────────────────────────────────────
        if (pressed(4)) p.previous();

        // ── RB / R1 → next ────────────────────────────────────────────
        if (pressed(5)) p.next();

        // ── LT / L2 → reculer 10s ─────────────────────────────────────
        if (pressed(6)) p.seek(Math.max(0, p.currentTime - 10));

        // ── RT / R2 → avancer 10s ─────────────────────────────────────
        if (pressed(7)) p.seek(Math.min(p.duration, p.currentTime + 10));

        // ── Start → open / close player ───────────────────────────────
        if (pressed(9)) {
          if (p.isPlayerOpen) p.closePlayer();
          else if (p.currentSong) p.openPlayer();
        }

        prevRef.current = Array.from(buttons).map((b) => b.pressed);
      }

      rafRef.current = requestAnimationFrame(poll);
    }

    // ── Connect / disconnect ──────────────────────────────────────────────
    function onConnect(e: GamepadEvent) {
      const name = e.gamepad.id.replace(/\s*\(.*\)\s*$/, '').trim() || 'Manette';
      toast.success('Manette connectée', { description: name, duration: 3000 });
      document.body.classList.add('gamepad-mode');
      activeRef.current = true;
      prevRef.current   = [];
      rafRef.current    = requestAnimationFrame(poll);
    }

    function onDisconnect() {
      toast.info('Manette déconnectée', { duration: 2000 });
      document.body.classList.remove('gamepad-mode');
      hideCursor();
      activeRef.current = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    window.addEventListener('gamepadconnected',    onConnect);
    window.addEventListener('gamepaddisconnected', onDisconnect);

    // Already connected before mount (HMR, page reload)
    if (Array.from(navigator.getGamepads()).some((g) => g !== null)) {
      document.body.classList.add('gamepad-mode');
      activeRef.current = true;
      rafRef.current    = requestAnimationFrame(poll);
    }

    return () => {
      window.removeEventListener('gamepadconnected',    onConnect);
      window.removeEventListener('gamepaddisconnected', onDisconnect);
      activeRef.current = false;
      document.body.classList.remove('gamepad-mode');
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      cursor.remove();
    };
  }, []);
}
