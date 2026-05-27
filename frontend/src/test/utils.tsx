import { AntdRegistry } from "@ant-design/nextjs-registry";
import { render, type RenderOptions } from "@testing-library/react";
import type { ReactElement } from "react";

function TestProviders({ children }: { children: React.ReactNode }) {
  return <AntdRegistry>{children}</AntdRegistry>;
}

/** 自定义 render 函数，包裹 AntdRegistry 以支持 Ant Design 组件测试。 */
export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">
) {
  return render(ui, { wrapper: TestProviders, ...options });
}
