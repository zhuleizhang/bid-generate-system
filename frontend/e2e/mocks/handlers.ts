import type { Page, Route } from "@playwright/test";
import {
  mockProject,
  mockProjectList,
  mockRequirements,
  mockFiles,
  mockPreviewData,
  mockAIRevisions,
  mockReviewResult,
  mockExportHistory,
  mockExportResult,
  mockBidTasks,
  mockDashboardStats,
  mockConfirmAndGenerateResult,
} from "./data";

/** 简化 page.route 的封装：将 JSON 对象作为响应返回 */
async function jsonRoute(
  page: Page,
  method: string,
  urlPattern: string | RegExp,
  body: unknown,
  status = 200,
) {
  await page.route(urlPattern, async (route: Route) => {
    if (route.request().method() !== method) {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
}

// ── Projects ──────────────────────────────────────────────────

export async function setupProjectRoutes(page: Page) {
  // Get/Update single project by ID: /api/projects/:id
  await page.route(/\/api\/projects\/[^/?]+$/, async (route: Route) => {
    const method = route.request().method();
    if (method !== "GET" && method !== "PUT") { await route.fallback(); return; }
    const id = route.request().url().split("/api/projects/")[1].split("?")[0];

    if (method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockProject({ id })),
      });
    } else {
      const body = JSON.parse(route.request().postData() || "{}");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockProject({ id, ...body })),
      });
    }
  });

  // List projects: GET /api/projects or /api/projects?...
  await page.route(/\/api\/projects(\?.*)?$/, async (route: Route) => {
    if (route.request().method() !== "GET") { await route.fallback(); return; }
    const url = new URL(route.request().url());
    const status = url.searchParams.get("status");
    const search = url.searchParams.get("search") || "";

    let items = mockProjectList().items;
    if (status === "in_review") items = items.filter((p) => p.status === "in_review");
    if (status === "completed") items = items.filter((p) => p.status === "completed");
    if (search) items = items.filter((p) => p.name.includes(search));

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items, total: items.length, page: 1, page_size: 20 }),
    });
  });

  // Create project: POST /api/projects
  await page.route(/\/api\/projects\/?$/, async (route: Route) => {
    if (route.request().method() !== "POST") { await route.fallback(); return; }
    const body = JSON.parse(route.request().postData() || "{}");
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify(mockProject({ ...body })),
    });
  });
}

// ── Files ─────────────────────────────────────────────────────

export async function setupFileRoutes(page: Page) {
  // Get project files
  await page.route(/\/api\/projects\/[^/]+\/files$/, async (route: Route) => {
    if (route.request().method() !== "GET") { await route.fallback(); return; }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ files: mockFiles("proj-001") }),
    });
  });

  // Upload files
  await page.route(/\/api\/projects\/[^/]+\/files\/upload/, async (route: Route) => {
    if (route.request().method() !== "POST") { await route.fallback(); return; }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        project_id: "proj-001",
        results: [
          { filename: "uploaded-file.pdf", document_id: "file-new", file_size: 1527626, document_type: "tender_doc", status: "success", error: null },
        ],
        success_count: 1,
        failed_count: 0,
      }),
    });
  });
}

// ── Requirements ──────────────────────────────────────────────

export async function setupRequirementRoutes(page: Page) {
  // List requirements
  await page.route(/\/api\/projects\/[^/]+\/requirements$/, async (route: Route) => {
    if (route.request().method() !== "GET") { await route.fallback(); return; }
    const url = route.request().url();
    const id = url.match(/\/api\/projects\/([^/]+)\/requirements/)![1];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockRequirements(id)),
    });
  });

  // Create requirement
  await page.route(/\/api\/projects\/[^/]+\/requirements$/, async (route: Route) => {
    if (route.request().method() !== "POST") { await route.fallback(); return; }
    const url = route.request().url();
    const id = url.match(/\/api\/projects\/([^/]+)\/requirements/)![1];
    const body = JSON.parse(route.request().postData() || "{}");
    const newReq = { ...mockRequirements(id)[0], id: "req-new", ...body };
    await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify(newReq) });
  });

  // Update requirement
  await jsonRoute(page, "PUT", /\/api\/projects\/[^/]+\/requirements\/[^/]+$/, { success: true });

  // Update requirement status (soft delete: set to ignored)
  await jsonRoute(page, "PATCH", /\/api\/projects\/[^/]+\/requirements\/[^/]+\/status/, { success: true });
}

// ── Workbench ─────────────────────────────────────────────────

export async function setupWorkbenchRoutes(page: Page) {
  // Confirm and generate
  await jsonRoute(page, "POST", /\/api\/projects\/[^/]+\/workbench\/confirm-and-generate/, mockConfirmAndGenerateResult());
}

// ── Preview ───────────────────────────────────────────────────

export async function setupPreviewRoutes(page: Page) {
  // Get preview data for a document
  await jsonRoute(page, "GET", /\/api\/documents\/[^/]+\/preview/, mockPreviewData());
}

// ── Revisions ─────────────────────────────────────────────────

export async function setupRevisionRoutes(page: Page) {
  // Update revision status (accept / reject / etc.)
  await page.route(/\/api\/revisions\/[^/]+\/status/, async (route: Route) => {
    if (route.request().method() !== "PATCH") { await route.fallback(); return; }
    const body = JSON.parse(route.request().postData() || "{}");
    const revId = route.request().url().match(/\/api\/revisions\/([^/]+)\/status/)![1];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ...mockAIRevisions().find((r) => r.id === revId) || mockAIRevisions()[0],
        status: body.status || "accepted",
      }),
    });
  });

  // Update unfinished item status
  await jsonRoute(page, "PATCH", /\/api\/unfinished\/[^/]+\/status/, { success: true });
}

// ── Review ────────────────────────────────────────────────────

export async function setupReviewRoutes(page: Page) {
  // Run review check
  await page.route(/\/api\/projects\/[^/]+\/review/, async (route: Route) => {
    if (route.request().method() !== "POST") { await route.fallback(); return; }
    const url = route.request().url();
    const id = url.match(/\/api\/projects\/([^/]+)\/review/)![1];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockReviewResult(id)),
    });
  });
}

// ── Export ────────────────────────────────────────────────────

export async function setupExportRoutes(page: Page) {
  // List exports
  await jsonRoute(page, "GET", /\/api\/projects\/[^/]+\/exports$/, mockExportHistory());

  // Run export
  await jsonRoute(page, "POST", /\/api\/projects\/[^/]+\/export/, mockExportResult());

  // Download export → return empty binary with Content-Disposition header
  await page.route(/\/api\/projects\/[^/]+\/export\/download/, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      headers: { "Content-Disposition": 'attachment; filename="bid.docx"' },
      body: Buffer.from("mock-docx-content"),
    });
  });
}

// ── Tasks ─────────────────────────────────────────────────────

export async function setupTaskRoutes(page: Page) {
  // List tasks
  await page.route(/\/api\/projects\/[^/]+\/tasks/, async (route: Route) => {
    if (route.request().method() !== "GET") { await route.fallback(); return; }
    const url = route.request().url();
    const id = url.match(/\/api\/projects\/([^/]+)\/tasks/)![1];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockBidTasks(id)),
    });
  });

  // Create task
  await page.route(/\/api\/projects\/[^/]+\/tasks/, async (route: Route) => {
    if (route.request().method() !== "POST") { await route.fallback(); return; }
    const body = JSON.parse(route.request().postData() || "{}");
    const url = route.request().url();
    const id = url.match(/\/api\/projects\/([^/]+)\/tasks/)![1];
    const task = { ...mockBidTasks(id)[0], id: "task-new", ...body };
    await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify(task) });
  });

  // Update task status (drag-and-drop)
  await jsonRoute(page, "PATCH", /\/api\/projects\/[^/]+\/tasks\/[^/]+\/status/, { success: true });
}

// ── Dashboard ─────────────────────────────────────────────────

export async function setupDashboardRoutes(page: Page) {
  // Unfinished count
  await jsonRoute(page, "GET", /\/api\/unfinished\/count/, { total: mockDashboardStats().pendingTasks });
}

// ── Convenience: register all routes ──────────────────────────

export async function mockAllRoutes(page: Page) {
  await setupDashboardRoutes(page);
  await setupProjectRoutes(page);
  await setupFileRoutes(page);
  await setupRequirementRoutes(page);
  await setupWorkbenchRoutes(page);
  await setupPreviewRoutes(page);
  await setupRevisionRoutes(page);
  await setupReviewRoutes(page);
  await setupExportRoutes(page);
  await setupTaskRoutes(page);
}
