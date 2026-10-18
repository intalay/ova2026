import { act, render, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { StartupOverlay } from '@/components/StartupOverlay';
beforeEach(() => vi.useFakeTimers());
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
function motion(reduced: boolean) { vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: reduced }))); }
it('ends launch in 2.7 seconds and does not replay on rerender', () => {
  motion(false);
  const view = render(<StartupOverlay />);
  act(() => vi.advanceTimersByTime(2699));
  expect(view.container.querySelector('[data-startup-overlay]')).not.toBeNull();
  act(() => vi.advanceTimersByTime(1));
  expect(view.container.querySelector('[data-startup-overlay]')).toBeNull();
  view.rerender(<StartupOverlay />);
  expect(view.container.querySelector('[data-startup-overlay]')).toBeNull();
});
it('uses a 450ms reduced-motion launch', () => {
  motion(true);
  const view = render(<StartupOverlay />);
  act(() => vi.advanceTimersByTime(449));
  expect(view.container.querySelector('[data-startup-overlay]')).not.toBeNull();
  act(() => vi.advanceTimersByTime(1));
  expect(view.container.querySelector('[data-startup-overlay]')).toBeNull();
});
