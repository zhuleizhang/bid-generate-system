"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Typography,
  Tree,
  Select,
  Spin,
  Card,
  Empty,
  Button,
  Space,
  message,
} from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import type { DataNode } from "antd/es/tree";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { ProjectFileItem } from "@/lib/types/project_file";

const { Title, Text } = Typography;

interface SectionItem {
  id: string;
  section_id: string;
  title: string;
  level: number;
  section_path: string;
  parent_section_id: string | null;
}

interface PreviewData {
  document_id: string;
  document_name: string;
  html: string;
  sections: SectionItem[];
  warnings: string[];
}

function buildSectionTree(sections: SectionItem[]): DataNode[] {
  const map = new Map<string, DataNode>();
  const roots: DataNode[] = [];

  for (const s of sections) {
    map.set(s.section_id, {
      key: s.section_id,
      title: s.title,
      children: [],
    });
  }

  for (const s of sections) {
    const node = map.get(s.section_id)!;
    if (s.parent_section_id && map.has(s.parent_section_id)) {
      map.get(s.parent_section_id)!.children!.push(node);
    } else {
      roots.push(node);
    }
  }

  // 清理空的 children 数组
  const cleanChildren = (nodes: DataNode[]) => {
    for (const node of nodes) {
      if (node.children && node.children.length === 0) {
        delete node.children;
      } else if (node.children) {
        cleanChildren(node.children);
      }
    }
  };
  cleanChildren(roots);

  return roots;
}

export default function PreviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [pageLoading, setPageLoading] = useState(true);
  const [bidTemplates, setBidTemplates] = useState<ProjectFileItem[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);

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

  const treeData = useMemo(
    () => (previewData?.sections ? buildSectionTree(previewData.sections) : []),
    [previewData]
  );

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
              overflow: "auto",
            }}
            styles={{ body: { padding: "8px 12px" } }}
          >
            {previewLoading ? (
              <div style={{ textAlign: "center", padding: 40 }}>
                <Spin />
              </div>
            ) : treeData.length === 0 ? (
              <Empty
                description="暂无章节数据"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ) : (
              <Tree
                treeData={treeData}
                defaultExpandAll
                showLine={{ showLeafIcon: false }}
                style={{ maxHeight: "100%" }}
              />
            )}
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
