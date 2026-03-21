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
