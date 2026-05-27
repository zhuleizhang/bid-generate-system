import { renderWithProviders } from "@/test/utils";

describe("前端测试基础设施冒烟", () => {
  it("renderWithProviders 正常工作", () => {
    const { container } = renderWithProviders(<div>hello</div>);
    expect(container.textContent).toBe("hello");
  });

  it("Ant Design 组件渲染正常", () => {
    const { container } = renderWithProviders(<button>click</button>);
    expect(container.textContent).toBe("click");
  });
});
