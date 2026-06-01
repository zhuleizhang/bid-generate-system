/** API 端点路径常量 — 集中管理所有后端路由，避免调用处硬编码。 */

const PROJECTS = (projectId: string) => `/api/projects/${projectId}`;

export const API = {
  projects: {
    list: "/api/projects",
    create: "/api/projects",
    detail: PROJECTS,
    update: PROJECTS,
    delete: PROJECTS,
    transition: (projectId: string) => `${PROJECTS(projectId)}/transition`,
    startParsing: (projectId: string) => `${PROJECTS(projectId)}/start-parsing`,
  },
  files: {
    list: (projectId: string) => `${PROJECTS(projectId)}/files`,
    upload: (projectId: string) => `${PROJECTS(projectId)}/files/upload`,
    delete: (projectId: string, fileId: string) =>
      `${PROJECTS(projectId)}/files/${fileId}`,
  },
  requirements: {
    list: (projectId: string) => `${PROJECTS(projectId)}/requirements`,
    create: (projectId: string) => `${PROJECTS(projectId)}/requirements`,
    update: (projectId: string, reqId: string) =>
      `${PROJECTS(projectId)}/requirements/${reqId}`,
    patchStatus: (projectId: string, reqId: string) =>
      `${PROJECTS(projectId)}/requirements/${reqId}/status`,
  },
  documents: {
    parse: (docId: string) => `/api/documents/${docId}/parse`,
    detectSections: (docId: string) => `/api/documents/${docId}/detect-sections`,
    sections: (docId: string) => `/api/documents/${docId}/sections`,
    slots: (docId: string) => `/api/documents/${docId}/slots`,
    generateSlots: (docId: string) => `/api/documents/${docId}/generate-slots`,
    classifySlots: (docId: string) => `/api/documents/${docId}/classify-slots`,
    preview: (docId: string) => `/api/documents/${docId}/preview`,
    aiRevisions: (docId: string) => `/api/documents/${docId}/ai-revisions`,
    generateAiRevisions: (docId: string) =>
      `/api/documents/${docId}/ai-revisions/generate`,
    unfinished: (docId: string) => `/api/documents/${docId}/unfinished`,
    parseTender: (docId: string) => `/api/documents/${docId}/parse-tender`,
    extractRequirements: (docId: string) =>
      `/api/documents/${docId}/extract-requirements`,
  },
  revisions: {
    updateStatus: (revisionId: string) => `/api/revisions/${revisionId}/status`,
    batchStatus: "/api/revisions/batch-status",
    checkReviewComplete: (projectId: string) =>
      `/api/revisions/check-review-complete?project_id=${projectId}`,
  },
  workbench: {
    confirmRequirements: (projectId: string) =>
      `${PROJECTS(projectId)}/workbench/confirm-requirements`,
    confirmStructure: (projectId: string) =>
      `${PROJECTS(projectId)}/workbench/confirm-structure`,
    confirmAndGenerate: (projectId: string) =>
      `${PROJECTS(projectId)}/workbench/confirm-and-generate`,
  },
  review: {
    check: (projectId: string) => `${PROJECTS(projectId)}/review`,
  },
  export: {
    docx: (projectId: string) => `${PROJECTS(projectId)}/export`,
    download: (projectId: string) => `${PROJECTS(projectId)}/export/download`,
  },
  unfinished: {
    globalCount: "/api/unfinished/count",
    byProject: (projectId: string) => `/api/unfinished/${projectId}/count`,
  },
} as const;
