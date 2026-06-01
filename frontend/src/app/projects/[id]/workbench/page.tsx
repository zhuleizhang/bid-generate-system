"use client";

import { useEffect, useState, useCallback } from "react";
import { Typography, Card, Tabs, Button, Space, Spin, message, Result, Table, Tag, Empty } from "antd";
import { useParams, useRouter } from "next/navigation";
import type { RequirementDBItem } from "@/lib/types/requirement";
import { api } from "@/lib/api";
import type { Project } from "@/lib/types/project";
import type { ProjectFileItem } from "@/lib/types/project_file";
import type { TemplateSlot, SectionContent } from "@/lib/types/template_slot";
import RequirementConfirmationPanel from "@/components/RequirementConfirmationPanel";

const { Title } = Typography;

/** 状态 → 页面路由映射 */
const STATUS_ROUTE: Record<string, string> = {
  in_review: "preview",
  review_completed: "review",
  exported: "export",
  completed: "experience",
};

/** 项目工作台 — 2 个 Tab 确认招标要求和模板结构，然后触发全量生成。 */
export default function WorkbenchPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<Project | null>(null);
  const [requirements, setRequirements] = useState<RequirementDBItem[]>([]);
  const [slots, setSlots] = useState<TemplateSlot[]>([]);
  const [sections, setSections] = useState<SectionContent[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
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
      const [proj, reqs, fileData] = await Promise.all([
        api.get<Project>(`/api/projects/${id}`),
        api.get<RequirementDBItem[]>(`/api/projects/${id}/requirements`),
        api.get<{ files: ProjectFileItem[] }>(`/api/projects/${id}/files`),
      ]);
      setProject(proj);
      setRequirements(reqs.filter((r) => r.status !== "ignored"));

      // 找到投标模板并加载 slots 和 sections
      const template = fileData.files.find((f) => f.document_type === "bid_template");
      if (template) {
        setSlotsLoading(true);
        try {
          const [slotsData, sectionsData] = await Promise.all([
            api.get<TemplateSlot[]>(`/api/documents/${template.id}/slots`),
            api.get<SectionContent[]>(`/api/documents/${template.id}/sections`),
          ]);
          setSlots(slotsData);
          setSections(sectionsData);
        } catch {
          // slots 可能尚未生成，静默处理
        } finally {
          setSlotsLoading(false);
        }
      }
    } catch {
      message.error("加载项目数据失败");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 如果项目已进入 in_review 或后续状态，重定向到对应页面
  useEffect(() => {
    if (project && project.status !== "draft" && project.status !== "pending_confirmation") {
      const route = STATUS_ROUTE[project.status];
      if (route) {
        router.replace(`/projects/${id}/${route}`);
      }
    }
  }, [project, id, router]);

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
                projectId={id}
                onConfirmed={() => setTab1Confirmed(true)}
                onRequirementsChanged={loadData}
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
              <div>
                {slotsLoading ? (
                  <div style={{ textAlign: "center", padding: 60 }}>
                    <Spin tip="加载模板结构数据..." />
                  </div>
                ) : (
                  <>
                    {/* 章节结构 */}
                    {sections.length > 0 && (
                      <Card title="章节结构" size="small" style={{ marginBottom: 16 }}>
                        <div style={{ maxHeight: 300, overflow: "auto" }}>
                          {sections.map((s) => (
                            <div
                              key={s.id}
                              style={{
                                paddingLeft: (s.level - 1) * 24,
                                padding: "4px 0",
                                fontSize: s.level === 1 ? 15 : 13,
                                fontWeight: s.level <= 2 ? 600 : 400,
                                color: s.level <= 2 ? "#1a1a1a" : "#666",
                              }}
                            >
                              {s.title}
                            </div>
                          ))}
                        </div>
                      </Card>
                    )}

                    {/* TemplateSlot 列表 */}
                    <Card
                      title={
                        <Space>
                          <span>填充位置识别结果</span>
                          {slots.length > 0 && <Tag color="blue">{slots.length} 个位置</Tag>}
                        </Space>
                      }
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
                      {slots.length === 0 ? (
                        <Empty description="暂无可填充位置数据，请确认投标模板已正确上传并解析" />
                      ) : (
                        <Table<TemplateSlot>
                          dataSource={slots}
                          rowKey="id"
                          size="small"
                          pagination={{ pageSize: 10, showSizeChanger: true }}
                          columns={[
                            {
                              title: "章节",
                              dataIndex: "section_path",
                              key: "section_path",
                              width: 200,
                              ellipsis: true,
                              render: (v: string | null) => v || "-",
                            },
                            {
                              title: "位置类型",
                              dataIndex: "slot_type",
                              key: "slot_type",
                              width: 110,
                              render: (v: string) => {
                                const labels: Record<string, string> = {
                                  paragraph: "段落",
                                  table_cell: "表格单元格",
                                  placeholder: "占位符",
                                  heading_section: "标题章节",
                                  section_append: "章节末尾追加",
                                };
                                return <Tag>{labels[v] || v}</Tag>;
                              },
                            },
                            {
                              title: "预期内容",
                              dataIndex: "expected_content_type",
                              key: "expected_content_type",
                              width: 130,
                              ellipsis: true,
                              render: (v: string | null) => v || "-",
                            },
                            {
                              title: "填充策略",
                              dataIndex: "fill_strategy",
                              key: "fill_strategy",
                              width: 100,
                              render: (v: string) => {
                                const labels: Record<string, string> = {
                                  replace: "替换",
                                  append: "追加",
                                  cell_fill: "单元格填充",
                                  section_append: "章节末尾追加",
                                };
                                return labels[v] || v;
                              },
                            },
                            {
                              title: "置信度",
                              dataIndex: "confidence",
                              key: "confidence",
                              width: 90,
                              render: (v: number) => {
                                const pct = Math.round(v * 100);
                                const color = v >= 0.8 ? "green" : v >= 0.5 ? "orange" : "red";
                                return <Tag color={color}>{pct}%</Tag>;
                              },
                            },
                            {
                              title: "依据",
                              dataIndex: "evidence",
                              key: "evidence",
                              ellipsis: true,
                              width: 200,
                              render: (v: string | null) => v || "-",
                            },
                          ]}
                        />
                      )}
                    </Card>
                  </>
                )}
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
