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
} from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { ProjectFileItem } from "@/lib/types/project_file";
import ChapterTree from "@/components/ChapterTree";
import type { SectionItem } from "@/components/ChapterTree";

const { Title, Text } = Typography;

interface PreviewData {
  document_id: string;
  document_name: string;
  html: string;
  sections: SectionItem[];
  warnings: string[];
}

export default function PreviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [pageLoading, setPageLoading] = useState(true);
  const [bidTemplates, setBidTemplates] = useState<ProjectFileItem[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);

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

    const loadPreview = async () => {
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
    loadPreview();
    return () => {
      cancelled = true;
    };
  }, [selectedDocId]);

  const handleSectionSelect = useCallback((sectionId: string) => {
    setSelectedSectionId(sectionId);
    const anchor = document.getElementById(`sec-${sectionId}`);
    if (anchor && previewContainerRef.current) {
      anchor.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

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
              <Text ellipsis style={{ maxWidth: 400 }}>
                {previewData?.document_name || "预览内容"}
              </Text>
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
              <div
                ref={previewContainerRef}
                className="mammoth-preview"
                dangerouslySetInnerHTML={{ __html: previewData.html }}
                style={{ maxWidth: 900, margin: "0 auto" }}
              />
            ) : null}
          </Card>
        </div>
      )}
    </div>
  );
}
