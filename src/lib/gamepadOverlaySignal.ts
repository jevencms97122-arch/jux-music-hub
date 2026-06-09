// Lightweight counter: panels increment on mount, decrement on unmount.
// The gamepad hook reads this to know whether an overlay is currently open.
let _count = 0;

export const overlaySignal = {
  open:  () => { _count++; },
  close: () => { _count = Math.max(0, _count - 1); },
  any:   () => _count > 0,
};
