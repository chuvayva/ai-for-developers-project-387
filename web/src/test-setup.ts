import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(cleanup);

// jsdom has no matchMedia or ResizeObserver, and Mantine calls both.
const noop = () => {};

window.matchMedia = (query: string): MediaQueryList => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener: noop,
  removeEventListener: noop,
  addListener: noop,
  removeListener: noop,
  dispatchEvent: () => false,
});

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

window.ResizeObserver = ResizeObserverStub;
