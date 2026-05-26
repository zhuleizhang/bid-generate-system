"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Typography,
  Select,
  Spin,
  Card,
  Empty,
  Button,
  Space,
  message,
  Popover,
  Tag,
  Tabs,
  Descriptions,
  Divider,
} from "antd";
import {
  ArrowLeftOutlined,
  InfoCircleOutlined,
} from "@ant-design/icons";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { ProjectFileItem } from "@/lib/types/project_file";
import type { AIRevision } from "@/lib/types/ai_revision";
import type { UnfinishedItem } from "@/lib/types/unfinished_item";
import {
  REVISION_TYPE_LABELS,
  REVISION_TYPE_COLORS,
  RISK_LEVEL_LABELS,
  RISK_LEVEL_COLORS,
  STATUS_LABELS,
  STATUS_COLORS,
} from "@/lib/types/ai_revision";
import ChapterTree from "@/components/ChapterTree";
import type { SectionItem } from "@/components/ChapterTree";
import RevisionSidebar from "@/components/RevisionSidebar";
import UnfinishedPanel from "@/components/UnfinishedPanel";

const { Title, Text } = Typography;

interface PreviewData {
  document_id: string;
  document_name: string;
  html: string;
  sections: SectionItem[];
  ai_revisions: AIRevision[];
  unfinished_items: UnfinishedItem[];
  warnings: string[];
}

/** AIRevision 按 ID 查找的映射 */
type RevisionMap = Map<string, AIRevision>;

export default function PreviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [pageLoading, setPageLoading] = useState(true);
  const [bidTemplates, setBidTemplates] = useState<ProjectFileItem[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [sidebarTab, setSidebarTab] = useState<string>("revisions");
  const previewContainerRef = useRef<HTMLDivElement>(null);

  // Popover 状态
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [popoverRevision, setPopoverRevision] = useState<AIRevision | null>(null);

  // 缓存 AIRevision 按 ID 查找的映射
  const revisionMapRef = useRef<RevisionMap>(new Map());

  useEffect(() => {
    let cancelled = false;
    const loadFiles = async () => {
      try {
        const data = await api.get<{ files: ProjectFileItem[] }>(
          `/api/projects/${id}/files`
        );
        if (!cancelled) {
          const templates = data.files.filter(
            (f) => f.document_type === "bid_template"
          );
          setBidTemplates(templates);
          if (templates.length > 0) {
            setSelectedDocId(templates[0].id);
          }
        }
      } catch {
        if (!cancelled) message.error("加载项目文件列表失败");
      } finally {
        if (!cancelled) setPageLoading(false);
      }
    };
    loadFiles();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!selectedDocId) return;
    let cancelled = false;
    // 提取为独立 async 函数避免 eslint set-state-in-effect 警告
    const doLoad = async () => {
      setPreviewLoading(true);
      setPreviewData(null);
      setSelectedSectionId(null);
      try {
        const data = await api.get<PreviewData>(
          `/api/documents/${selectedDocId}/preview`
        );
        if (!cancelled) setPreviewData(data);
      } catch {
        if (!cancelled) message.error("加载预览失败");
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    };
    doLoad();
    return () => {
      cancelled = true;
    };
  }, [selectedDocId]);

  // 侧边栏操作后刷新预览数据
  const handleRevisionRefresh = useCallback(async () => {
    if (!selectedDocId) return;
    try {
      const data = await api.get<PreviewData>(
        `/api/documents/${selectedDocId}/preview`
      );
      setPreviewData(data);
    } catch {
      message.error("刷新预览失败");
    }
  }, [selectedDocId]);

  // 将 AIRevision 列表构建为按 ID 查找的映射
  useEffect(() => {
    const map: RevisionMap = new Map();
    if (previewData?.ai_revisions) {
      for (const rev of previewData.ai_revisions) {
        map.set(rev.id, rev);
      }
    }
    revisionMapRef.current = map;
  }, [previewData?.ai_revisions]);

  const handleSectionSelect = useCallback((sectionId: string) => {
    setSelectedSectionId(sectionId);
    const anchor = document.getElementById(`sec-${sectionId}`);
    if (anchor && previewContainerRef.current) {
      anchor.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  // 点击未完成项时：切换到 AI 修订 tab 并滚动到对应高亮位置
  const handleUnfinishedLocate = useCallback((item: UnfinishedItem) => {
    const highlightEl = previewContainerRef.current?.querySelector(
      `[data-unfinished-id="${item.id}"]`,
    ) as HTMLElement | null;
    if (highlightEl) {
      highlightEl.scrollIntoView({ behavior: "smooth", block: "center" });
      // 闪烁高亮效果
      const origOutline = highlightEl.style.outline;
      highlightEl.style.outline = "3px solid #ff4d4f";
      highlightEl.style.transition = "outline 0.3s";
      setTimeout(() => {
        highlightEl.style.outline = origOutline;
      }, 1500);
    }
  }, []);

  // 在 HTML 渲染后，通过事件代理绑定点击 Popover
  const handlePreviewClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const wrapper = target.closest(".ai-revision-wrapper") as HTMLElement | null;
    if (!wrapper) {
      setPopoverOpen(false);
      return;
    }

    const revisionId = wrapper.getAttribute("data-revision-id");
    if (!revisionId) return;

    const rev = revisionMapRef.current.get(revisionId);
    if (rev) {
      setPopoverRevision(rev);
      setPopoverOpen(true);
    }
  }, []);

  // 渲染 Popover 内容
  const renderPopoverContent = useCallback(() => {
    if (!popoverRevision) return null;
    const rev = popoverRevision;
    return (
      <div style={{ maxWidth: 380 }}>
        <div style={{ marginBottom: 8 }}>
          <Tag color={REVISION_TYPE_COLORS[rev.revision_type]}>
            {REVISION_TYPE_LABELS[rev.revision_type] || rev.revision_type}
          </Tag>
          <Tag color={STATUS_COLORS[rev.status]}>
            {STATUS_LABELS[rev.status] || rev.status}
          </Tag>
          <Tag color={RISK_LEVEL_COLORS[rev.risk_level]}>
            {RISK_LEVEL_LABELS[rev.risk_level] || rev.risk_level}
          </Tag>
        </div>

        {rev.comment && (
          <div style={{ marginBottom: 8 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {rev.comment}
            </Text>
          </div>
        )}

        <Descriptions size="small" column={1} style={{ marginBottom: 8 }}>
          <Descriptions.Item label="置信度">
            {Math.round(rev.confidence * 100)}%
          </Descriptions.Item>
          {rev.before_content && (
            <Descriptions.Item label="原文">
              <Text
                style={{
                  background: "#fff3cd",
                  padding: "1px 4px",
                  borderRadius: 2,
                  fontSize: 12,
                  display: "inline-block",
                  maxWidth: "100%",
                  wordBreak: "break-all",
                }}
              >
                {rev.before_content.length > 120
                  ? rev.before_content.slice(0, 120) + "..."
                  : rev.before_content}
              </Text>
            </Descriptions.Item>
          )}
          {rev.ai_content && (
            <Descriptions.Item label="AI 建议内容">
              <Text
                style={{
                  background: "#d4edda",
                  padding: "1px 4px",
                  borderRadius: 2,
                  fontSize: 12,
                  display: "inline-block",
                  maxWidth: "100%",
                  wordBreak: "break-all",
                }}
              >
                {rev.ai_content.length > 200
                  ? rev.ai_content.slice(0, 200) + "..."
                  : rev.ai_content}
              </Text>
            </Descriptions.Item>
          )}
        </Descriptions>

        {rev.source_requirement_ids.length > 0 && (
          <>
            <Divider style={{ margin: "4px 0" }} />
            <Text type="secondary" style={{ fontSize: 11 }}>
              关联 {rev.source_requirement_ids.length} 条招标要求
            </Text>
          </>
        )}
      </div>
    );
  }, [popoverRevision]);

  if (pageLoading) {
    return (
      <div style={{ textAlign: "center", padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 64px - 48px)" }}>
      {/* 顶栏 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
          flexShrink: 0,
        }}
      >
        <Space>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => router.push(`/projects/${id}`)}
          >
            返回项目
          </Button>
          <Title level={4} style={{ margin: 0 }}>
            文档预览
          </Title>
        </Space>
        <Select
          style={{ minWidth: 280 }}
          placeholder="选择要预览的投标模板"
          value={selectedDocId}
          onChange={setSelectedDocId}
          loading={pageLoading}
          options={bidTemplates.map((t) => ({
            value: t.id,
            label: t.name,
          }))}
          notFoundContent={
            <Empty
              description="暂无投标模板"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          }
        />
      </div>

      {!selectedDocId ? (
        <Card style={{ flex: 1 }}>
          <Empty description="请先上传投标模板文档" />
        </Card>
      ) : (
        <div
          style={{
            display: "flex",
            flex: 1,
            gap: 16,
            minHeight: 0,
          }}
        >
          {/* 左侧章节树 */}
          <Card
            title="章节导航"
            size="small"
            style={{
              width: 280,
              flexShrink: 0,
              display: "flex",
              flexDirection: "column",
            }}
            styles={{ body: { flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" } }}
          >
            <ChapterTree
              sections={previewData?.sections ?? []}
              selectedSectionId={selectedSectionId}
              onSelect={handleSectionSelect}
              loading={previewLoading}
            />
          </Card>

          {/* 右侧 HTML 预览 */}
          <Card
            title={
              <Space>
                <Text ellipsis style={{ maxWidth: 400 }}>
                  {previewData?.document_name || "预览内容"}
                </Text>
                {previewData?.ai_revisions && previewData.ai_revisions.length > 0 && (
                  <Tag icon={<InfoCircleOutlined />} color="processing">
                    {previewData.ai_revisions.length} 条 AI 修订
                  </Tag>
                )}
              </Space>
            }
            size="small"
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              minWidth: 0,
            }}
            styles={{
              body: {
                flex: 1,
                overflow: "auto",
                padding: 24,
              },
            }}
          >
            {previewLoading ? (
              <div style={{ textAlign: "center", padding: 80 }}>
                <Spin size="large" tip="正在加载预览..." />
              </div>
            ) : previewData ? (
              <Popover
                content={renderPopoverContent()}
                title="AI 修订详情"
                trigger="contextMenu"
                open={popoverOpen}
                onOpenChange={setPopoverOpen}
                placement="right"
              >
                <div
                  ref={previewContainerRef}
                  className="mammoth-preview"
                  dangerouslySetInnerHTML={{ __html: previewData.html }}
                  style={{ maxWidth: 900, margin: "0 auto" }}
                  onClick={handlePreviewClick}
                />
              </Popover>
            ) : null}
          </Card>

          {/* 右侧侧边栏：AI 修订列表 + 未完成项 */}
          {(previewData?.ai_revisions && previewData.ai_revisions.length > 0) ||
          (previewData?.unfinished_items && previewData.unfinished_items.length > 0) ? (
            <Card
              size="small"
              style={{
                width: 360,
                flexShrink: 0,
                display: "flex",
                flexDirection: "column",
              }}
              styles={{
                body: {
                  flex: 1,
                  overflow: "auto",
                  padding: 8,
                },
              }}
            >
              <Tabs
                activeKey={sidebarTab}
                onChange={setSidebarTab}
                size="small"
                items={[
                  previewData?.ai_revisions && previewData.ai_revisions.length > 0
                    ? {
                        key: "revisions",
                        label: `AI 修订 (${previewData.ai_revisions.length})`,
                        children: (
                          <RevisionSidebar
                            revisions={previewData.ai_revisions}
                            onStatusChange={handleRevisionRefresh}
                          />
                        ),
                      }
                    : null,
                  previewData?.unfinished_items && previewData.unfinished_items.length > 0
                    ? {
                        key: "unfinished",
                        label: `未完成项 (${previewData.unfinished_items.filter((u) => u.status === "open").length})`,
                        children: (
                          <UnfinishedPanel
                            items={previewData.unfinished_items}
                            onStatusChange={handleRevisionRefresh}
                            onItemLocate={handleUnfinishedLocate}
                          />
                        ),
                      }
                    : null,
                ].filter(Boolean) as { key: string; label: string; children: React.ReactNode }[]}
                style={{ marginTop: -8 }}
              />
            </Card>
          ) : null}
        </div>
      )}
    </div>
  );
}
