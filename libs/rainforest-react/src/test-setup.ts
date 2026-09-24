// jsdom implements neither ResizeObserver nor matchMedia, and cmdk and sonner call both.
class ResizeObserverStub {
  observe() {
    return undefined;
  }
  unobserve() {
    return undefined;
  }
  disconnect() {
    return undefined;
  }
}

globalThis.ResizeObserver ??= ResizeObserverStub;

window.matchMedia ??= (query: string) =>
  ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }) as MediaQueryList;

Element.prototype.scrollIntoView ??= () => undefined;
