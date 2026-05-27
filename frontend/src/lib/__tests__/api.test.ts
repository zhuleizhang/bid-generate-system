import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { api, ApiError } from "@/lib/api";

describe("ApiError", () => {
  it("status 和 detail 可访问", () => {
    const err = new ApiError(404, "not found");
    expect(err.status).toBe(404);
    expect(err.detail).toBe("not found");
    expect(err.message).toBe("not found");
    expect(err.name).toBe("ApiError");
  });

  it("detail 为对象时 message 为 JSON 字符串", () => {
    const err = new ApiError(500, { code: "DB_ERROR" });
    expect(err.message).toBe('{"code":"DB_ERROR"}');
  });
});

describe("api client", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("api.get 成功返回 JSON", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: "hello" }),
    } as Response);

    const result = await api.get("/test");
    expect(result).toEqual({ data: "hello" });
  });

  it("api.post 发送 JSON body", async () => {
    const mockFetch = vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: "1" }),
    } as Response);

    await api.post("/test", { name: "foo" });
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/test"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "foo" }),
      })
    );
  });

  it("api.put 发送 PUT 请求", async () => {
    const mockFetch = vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
    } as Response);

    await api.put("/test", { name: "bar" });
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ method: "PUT" })
    );
  });

  it("api.patch 发送 PATCH 请求", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    } as Response);

    await api.patch("/test", { x: 1 });
    const calls = vi.mocked(globalThis.fetch).mock.calls;
    expect(calls[0][1]).toMatchObject({ method: "PATCH" });
  });

  it("api.delete 发送 DELETE 请求", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    } as Response);

    await api.delete("/test");
    const calls = vi.mocked(globalThis.fetch).mock.calls;
    expect(calls[0][1]).toMatchObject({ method: "DELETE" });
  });

  it("非 ok 响应抛出 ApiError", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ detail: "not found" }),
    } as unknown as Response);

    await expect(api.get("/missing")).rejects.toThrow(ApiError);
  });

  it("非 ok 响应且无法解析 JSON 时使用 statusText", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error("parse error")),
      statusText: "Internal Server Error",
    } as unknown as Response);

    await expect(api.get("/crash")).rejects.toThrow("Internal Server Error");
  });
});
