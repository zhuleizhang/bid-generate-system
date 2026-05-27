"use client";

import { useEffect, useState, useCallback } from "react";
import { Typography, Card, Tabs, Button, Space, Spin, message, Result } from "antd";
import { useParams, useRouter } from "next/navigation";
import type { RequirementDBItem } from "@/lib/types/requirement";
import { api } from "@/lib/api";
import type { Project } from "@/lib/types/project";
import RequirementConfirmationPanel from "@/components/RequirementConfirmationPanel";

const { Title } = Typography;

/** 项目工作台 — 2 个 Tab 确认招标要求和模板结构，然后触发全量生成。 */
export default function WorkbenchPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<Project | null>(null);
  const [requirements, setRequirements] = useState<RequirementDBItem[]>([]);
  const [tab1Confirmed, setTab1Confirmed] = useState(false);
  const [tab2Confirmed, setTab2Confirmed] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateResult, setGenerateResult] = useState<{
    document_id: string;
    message: string;
  } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [proj, reqs] = await Promise.all([
        api.get<Project>(`/api/projects/${id}`),
        api.get<RequirementDBItem[]>(`/api/projects/${id}/requirements`),
      ]);
      setProject(proj);
      setRequirements(reqs.filter((r) => r.status !== "ignored"));
    } catch {
      message.error("加载项目数据失败");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleConfirmAndGenerate = async () => {
    setGenerating(true);
    try {
      const result = await api.post<{ document_id: string; message: string }>(
        `/api/projects/${id}/workbench/confirm-and-generate`
      );
      setGenerateResult(result);
      message.success("生成流程已触发");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "生成失败";
      message.error(msg);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!project) {
    return <Result status="404" title="项目不存在" />;
  }

  if (generateResult) {
    return (
      <Result
        status="success"
        title="生成流程已触发"
        subTitle="AI 正在生成修订内容，请前往审阅工作台查看结果"
        extra={[
          <Button
            key="review"
            type="primary"
            onClick={() => router.push(`/projects/${id}/preview`)}
          >
            进入审阅工作台
          </Button>,
        ]}
      />
    );
  }

  const bothConfirmed = tab1Confirmed && tab2Confirmed;

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <Title level={4} style={{ margin: 0 }}>
          {project.name} — 项目工作台
        </Title>
        <Space>
          <Button
            type="primary"
            size="large"
            disabled={!bothConfirmed}
            loading={generating}
            onClick={handleConfirmAndGenerate}
          >
            {bothConfirmed ? "确认并生成" : "请确认全部 Tab 后再生成"}
          </Button>
        </Space>
      </div>

      <Tabs
        defaultActiveKey="requirements"
        items={[
          {
            key: "requirements",
            label: (
              <span>
                招标要求确认
                {tab1Confirmed ? null : (
                  <sup
                    style={{ color: "#faad14", fontSize: 12, marginLeft: 2 }}
                  >
                    ●
                  </sup>
                )}
              </span>
            ),
            children: (
              <RequirementConfirmationPanel
                requirements={requirements}
                onConfirmed={() => setTab1Confirmed(true)}
              />
            ),
          },
          {
            key: "structure",
            label: (
              <span>
                模板结构确认
                {tab2Confirmed ? null : (
                  <sup
                    style={{ color: "#faad14", fontSize: 12, marginLeft: 2 }}
                  >
                    ●
                  </sup>
                )}
              </span>
            ),
            children: (
              <Card
                title="模板结构确认"
                extra={
                  <Button
                    type="primary"
                    disabled={tab2Confirmed}
                    onClick={() => setTab2Confirmed(true)}
                  >
                    确认模板结构
                  </Button>
                }
              >
                <Typography.Paragraph type="secondary">
                  系统将自动识别你上传的投标模板中的章节结构、表格和填充位置。
                  请确认模板已正确上传，并在下方查看模板解析结果。
                </Typography.Paragraph>
                <Button
                  type="link"
                  onClick={() =>
                    router.push(`/projects/${id}/preview`)
                  }
                >
                  在预览中查看模板结构
                </Button>
              </Card>
            ),
          },
        ]}
      />
    </div>
  );
}
