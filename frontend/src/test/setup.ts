import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// mock Next.js App Router hooks
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
  useParams: () => ({}),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

// mock matchMedia (Ant Design 依赖)
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// mock IntersectionObserver
class IntersectionObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
Object.defineProperty(window, "IntersectionObserver", {
  writable: true,
  value: IntersectionObserverMock,
});

// mock getComputedStyle (jsdom 不支持，Ant Design rc-table 需要)
const _getComputedStyle = window.getComputedStyle;
window.getComputedStyle = (elt: Element, pseudoElt?: string | null) => {
  try {
    return _getComputedStyle(elt, pseudoElt);
  } catch {
    // jsdom fallback: 返回最小可用的 CSSStyleDeclaration
    return {
      getPropertyValue: () => "",
      getPropertyPriority: () => "",
    } as unknown as CSSStyleDeclaration;
  }
};

// mock scrollIntoView
Element.prototype.scrollIntoView = vi.fn();
