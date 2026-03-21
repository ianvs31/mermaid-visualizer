import "@testing-library/jest-dom/vitest";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = ResizeObserverMock;
}

const svgProto = SVGElement.prototype as SVGElement & {
  getBBox?: () => { x: number; y: number; width: number; height: number };
};

if (!svgProto.getBBox) {
  svgProto.getBBox = () => ({
    x: 0,
    y: 0,
    width: 80,
    height: 16,
  });
}

const localStorageMock = (() => {
  const store = new Map<string, string>();

  return {
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
    removeItem(key: string) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
})();

Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  configurable: true,
  writable: true,
});
