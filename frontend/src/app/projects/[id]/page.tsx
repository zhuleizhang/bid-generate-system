"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Upload,
  Typography,
  Card,
  Tag,
  List,
  Button,
  Space,
  message,
  Spin,
  Descriptions,
  Empty,
  Tabs,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  Tooltip,
  Popconfirm,
  Collapse,
} from "antd";
import {
  InboxOutlined,
  FileOutlined,
  ReloadOutlined,
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  FileTextOutlined,
  ProjectOutlined,
  SafetyCertificateOutlined,
  ExportOutlined,
  DownloadOutlined,
} from "@ant-design/icons";
import type { UploadFile, RcFile } from "antd/es/upload/interface";
import { useParams, useRouter } from "next/navigation";
import dayjs from "dayjs";
import { api } from "@/lib/api";
import type { Project } from "@/lib/types/project";
import type {
  ProjectFileItem,
  FilesUploadResponse,
} from "@/lib/types/project_file";
import {
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_TYPE_COLORS,
} from "@/lib/types/project_file";
import type {
  RequirementDBItem,
  RequirementCreate,
  RequirementUpdate,
} from "@/lib/types/requirement";
import {
  REQUIREMENT_TYPE_LABELS,
  REQUIREMENT_TYPE_ORDER,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
  RISK_LEVEL_LABELS,
  RISK_LEVEL_COLORS,
  REQUIREMENT_TYPE_OPTIONS,
} from "@/lib/types/requirement";
import type { ExportRecordResponse } from "@/lib/types/export";
import ExportModal from "@/components/ExportModal";

const { Dragger } = Upload;
const { Title, Text, Paragraph } = Typography;

const ALLOWED_EXTENSIONS = [".docx", ".pdf", ".doc"];
const ALLOWED_EXTENSIONS_DISPLAY = ALLOWED_EXTENSIONS.join(", ");

const DEFAULT_TYPE_MAP: Record<string, string> = {
  ".docx": "bid_template",
  ".pdf": "tender_doc",
  ".doc": "company_material",
};

function getDefaultDocType(filename: string): string {
  const ext = "." + (filename.split(".").pop()?.toLowerCase() || "");
  return DEFAULT_TYPE_MAP[ext] || "company_material";
}

function isAllowedFile(filename: string): boolean {
  const ext = "." + (filename.split(".").pop()?.toLowerCase() || "");
  return ALLOWED_EXTENSIONS.includes(ext);
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0);
  return `${size} ${units[i]}`;
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [pageLoading, setPageLoading] = useState(true);

  // 文件相关状态
  const [files, setFiles] = useState<ProjectFileItem[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadFileList, setUploadFileList] = useState<UploadFile[]>([]);

  // 招标要求相关状态
  const [requirements, setRequirements] = useState<RequirementDBItem[]>([]);
  const [reqLoading, setReqLoading] = useState(false);

  // 编辑/添加 Modal 状态
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingReq, setEditingReq] = useState<RequirementDBItem | null>(null);
  const [editForm] = Form.useForm();

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addForm] = Form.useForm();

  // 导出相关状态
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportHistory, setExportHistory] = useState<ExportRecordResponse[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // 加载项目详情、文件列表和招标要求
  useEffect(() => {
    let cancelled = false;
    const loadAll = async () => {
      try {
        const data = await api.get<Project>(`/api/projects/${id}`);
        if (!cancelled) setProject(data);
      } catch {
        if (!cancelled) message.error("加载项目信息失败");
      }

      // 加载文件列表
      if (!cancelled) setFilesLoading(true);
      try {
        const fileData = await api.get<{ files: ProjectFileItem[] }>(
          `/api/projects/${id}/files`
        );
        if (!cancelled) setFiles(fileData.files);
      } catch {
        // 静默失败
      } finally {
        if (!cancelled) setFilesLoading(false);
      }

      // 加载招标要求
      if (!cancelled) setReqLoading(true);
      try {
        const reqData = await api.get<RequirementDBItem[]>(
          `/api/projects/${id}/requirements`
        );
        if (!cancelled) setRequirements(reqData.filter((r) => r.status !== "ignored"));
      } catch {
        // 静默失败
      } finally {
        if (!cancelled) {
          setReqLoading(false);
          setPageLoading(false);
        }
      }
    };
    loadAll();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // 手动刷新文件列表
  const fetchFiles = useCallback(async () => {
    setFilesLoading(true);
    try {
      const data = await api.get<{ files: ProjectFileItem[] }>(
        `/api/projects/${id}/files`
      );
      setFiles(data.files);
    } catch {
      message.error("加载文件列表失败");
    } finally {
      setFilesLoading(false);
    }
  }, [id]);

  // 手动刷新招标要求列表
  const fetchRequirements = useCallback(async () => {
    setReqLoading(true);
    try {
      const data = await api.get<RequirementDBItem[]>(
        `/api/projects/${id}/requirements`
      );
      setRequirements(data.filter((r) => r.status !== "ignored"));
    } catch {
      message.error("加载招标要求失败");
    } finally {
      setReqLoading(false);
    }
  }, [id]);

  // 导出历史
  const fetchExportHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const data = await api.get<ExportRecordResponse[]>(
        `/api/projects/${id}/exports`
      );
      setExportHistory(data);
    } catch {
      // 静默失败
    } finally {
      setHistoryLoading(false);
    }
  }, [id]);

  // ── 文件上传逻辑 ──────────────────────────────────────────────

  const handleBeforeUpload = (file: RcFile) => {
    if (!isAllowedFile(file.name)) {
      message.error(
        `不支持的文件类型 "${file.name.split(".").pop()}"，仅支持 ${ALLOWED_EXTENSIONS_DISPLAY}`
      );
      return Upload.LIST_IGNORE;
    }
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      message.error(`文件 "${file.name}" 超过 50MB 限制`);
      return Upload.LIST_IGNORE;
    }
    return true;
  };

  const handleCustomRequest = async (options: {
    file: string | Blob | RcFile;
    filename?: string;
    onProgress?: (event: { percent: number }) => void;
    onSuccess?: (body: unknown) => void;
    onError?: (event: Error) => void;
  }) => {
    const { file, filename, onProgress, onSuccess, onError } = options;
    const rcFile = file as RcFile;

    const formData = new FormData();
    formData.append("files", rcFile, filename || rcFile.name);
    formData.append("document_type", getDefaultDocType(rcFile.name));

    setUploading(true);
    try {
      const url = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/projects/${id}/files/upload`;
      const xhr = new XMLHttpRequest();
      xhr.open("POST", url);

      xhr.upload.onprogress = (e: ProgressEvent) => {
        if (e.lengthComputable && onProgress) {
          onProgress({ percent: Math.round((e.loaded / e.total) * 100) });
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const result: FilesUploadResponse = JSON.parse(xhr.responseText);
          const successCount = result.success_count;
          const failedCount = result.failed_count;

          if (failedCount > 0) {
            const errMsg = result.results.find((r) => r.error)?.error;
            message.warning(
              `上传完成：成功 ${successCount} 个，失败 ${failedCount} 个。${errMsg ? ` 原因：${errMsg}` : ""}`
            );
          } else {
            message.success(`文件上传成功（${successCount} 个）`);
          }

          onSuccess?.(result);
          fetchFiles();
        } else {
          const detail =
            (() => {
              try {
                return JSON.parse(xhr.responseText)?.detail;
              } catch {
                return xhr.statusText;
              }
            })() || xhr.statusText;
          onError?.(new Error(detail));
          message.error(`上传失败：${detail}`);
        }
        setUploading(false);
      };

      xhr.onerror = () => {
        onError?.(new Error("网络错误"));
        message.error("上传失败：网络错误");
        setUploading(false);
      };

      xhr.send(formData);
    } catch (err) {
      setUploading(false);
      onError?.(err instanceof Error ? err : new Error(String(err)));
      message.error(`上传失败：${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleUploadChange = (info: { file: UploadFile; fileList: UploadFile[] }) => {
    setUploadFileList(info.fileList);
  };

  // ── 招标要求 CRUD ─────────────────────────────────────────────

  const openEditModal = (req: RequirementDBItem) => {
    setEditingReq(req);
    editForm.setFieldsValue(req);
    setEditModalOpen(true);
  };

  const handleEditSave = async () => {
    try {
      const values: RequirementUpdate = await editForm.validateFields();
      if (!editingReq) return;
      await api.put<RequirementDBItem>(
        `/api/projects/${id}/requirements/${editingReq.id}`,
        values
      );
      message.success("更新成功");
      setEditModalOpen(false);
      setEditingReq(null);
      fetchRequirements();
    } catch (err) {
      if (err && typeof err === "object" && "errorFields" in err) return; // 表单校验失败
      message.error("更新失败");
    }
  };

  const handleDelete = async (reqId: string) => {
    try {
      await api.patch(`/api/projects/${id}/requirements/${reqId}/status?status=ignored`);
      message.success("已删除");
      fetchRequirements();
    } catch {
      message.error("删除失败");
    }
  };

  const openAddModal = () => {
    addForm.resetFields();
    setAddModalOpen(true);
  };

  const handleAddSave = async () => {
    try {
      const values: RequirementCreate = await addForm.validateFields();
      await api.post<RequirementDBItem>(
        `/api/projects/${id}/requirements`,
        values
      );
      message.success("添加成功");
      setAddModalOpen(false);
      fetchRequirements();
    } catch (err) {
      if (err && typeof err === "object" && "errorFields" in err) return;
      message.error("添加失败");
    }
  };

  // ── 文件按类型分组 ───────────────────────────────────────────

  const groupedFiles: Record<string, ProjectFileItem[]> = {
    bid_template: [],
    tender_doc: [],
    company_material: [],
  };
  for (const f of files) {
    if (groupedFiles[f.document_type]) {
      groupedFiles[f.document_type].push(f);
    } else {
      groupedFiles["company_material"].push(f);
    }
  }

  // ── 招标要求按类型分组 ───────────────────────────────────────

  const groupedRequirements: Record<string, RequirementDBItem[]> = {};
  for (const r of requirements) {
    if (!groupedRequirements[r.requirement_type]) {
      groupedRequirements[r.requirement_type] = [];
    }
    groupedRequirements[r.requirement_type].push(r);
  }

  // ── 页面状态 ──────────────────────────────────────────────────

  if (pageLoading) {
    return (
      <div style={{ textAlign: "center", padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!project) {
    return <Text type="secondary">项目不存在或已被删除</Text>;
  }

  // ── 文件管理 Tab ──────────────────────────────────────────────

  const filesTab = (
    <div>
      <Card style={{ marginBottom: 24 }}>
        <Title level={4} style={{ marginBottom: 16 }}>
          {project.name}
        </Title>
        <Descriptions size="small" column={{ xs: 1, sm: 2, md: 3 }}>
          <Descriptions.Item label="招标单位">
            {project.tender_org || "-"}
          </Descriptions.Item>
          <Descriptions.Item label="行业">
            {project.industry || "-"}
          </Descriptions.Item>
          <Descriptions.Item label="项目类型">
            {project.project_type || "-"}
          </Descriptions.Item>
          <Descriptions.Item label="截止时间">
            {project.deadline
              ? dayjs(project.deadline).format("YYYY-MM-DD")
              : "-"}
          </Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag>{project.status}</Tag>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="文件上传" style={{ marginBottom: 24 }}>
        <Dragger
          name="files"
          multiple
          fileList={uploadFileList}
          beforeUpload={handleBeforeUpload}
          customRequest={handleCustomRequest}
          onChange={handleUploadChange}
          showUploadList={{
            showPreviewIcon: false,
            showDownloadIcon: false,
          }}
          disabled={uploading}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
          <p className="ant-upload-hint">
            支持 {ALLOWED_EXTENSIONS_DISPLAY} 格式，单文件最大 50MB
          </p>
        </Dragger>
      </Card>

      <Card
        title={
          <Space>
            <span>已上传文件</span>
            <Button
              size="small"
              icon={<ReloadOutlined />}
              onClick={fetchFiles}
              loading={filesLoading}
            >
              刷新
            </Button>
          </Space>
        }
      >
        {filesLoading && files.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40 }}>
            <Spin />
          </div>
        ) : files.length === 0 ? (
          <Empty description="暂无上传文件" />
        ) : (
          <>
            {(["bid_template", "tender_doc", "company_material"] as const)
              .filter((type) => groupedFiles[type].length > 0)
              .map((type) => (
                <div key={type} style={{ marginBottom: 16 }}>
                  <Title level={5} style={{ marginBottom: 8 }}>
                    {DOCUMENT_TYPE_LABELS[type]}
                    <Tag
                      color={DOCUMENT_TYPE_COLORS[type]}
                      style={{ marginLeft: 8 }}
                    >
                      {groupedFiles[type].length}
                    </Tag>
                  </Title>
                  <List
                    size="small"
                    dataSource={groupedFiles[type]}
                    renderItem={(item) => (
                      <List.Item
                        actions={[
                          <Text
                            key="size"
                            type="secondary"
                            style={{ fontSize: 12 }}
                          >
                            {formatFileSize(item.file_size)}
                          </Text>,
                          <Text
                            key="time"
                            type="secondary"
                            style={{ fontSize: 12, marginLeft: 16 }}
                          >
                            {dayjs(item.created_at).format("YYYY-MM-DD HH:mm")}
                          </Text>,
                        ]}
                      >
                        <FileOutlined style={{ marginRight: 8 }} />
                        {item.name}
                      </List.Item>
                    )}
                    bordered
                  />
                </div>
              ))}
          </>
        )}
      </Card>
    </div>
  );

  // ── 招标要求 Tab ──────────────────────────────────────────────

  const requirementsTab = (
    <Card
      title="招标要求"
      extra={
        <Space>
          <Button
            size="small"
            icon={<ReloadOutlined />}
            onClick={fetchRequirements}
            loading={reqLoading}
          >
            刷新
          </Button>
          <Button
            size="small"
            type="primary"
            icon={<PlusOutlined />}
            onClick={openAddModal}
          >
            添加要求
          </Button>
        </Space>
      }
    >
      {reqLoading && requirements.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40 }}>
          <Spin />
        </div>
      ) : requirements.length === 0 ? (
        <Empty description="暂无招标要求，请先上传招标文件并解析提取">
          <Button type="primary" onClick={openAddModal}>
            手动添加要求
          </Button>
        </Empty>
      ) : (
        <Collapse
          defaultActiveKey={REQUIREMENT_TYPE_ORDER.filter(
            (t) => groupedRequirements[t]?.length > 0
          )}
          items={REQUIREMENT_TYPE_ORDER.filter(
            (type) => groupedRequirements[type]?.length > 0
          ).map((type) => ({
            key: type,
            label: (
              <Space>
                <span>{REQUIREMENT_TYPE_LABELS[type] || type}</span>
                <Tag>{groupedRequirements[type].length}</Tag>
              </Space>
            ),
            children: (
              <List
                dataSource={groupedRequirements[type]}
                renderItem={(item) => (
                  <List.Item
                    actions={[
                      <Button
                        key="edit"
                        type="link"
                        size="small"
                        icon={<EditOutlined />}
                        onClick={() => openEditModal(item)}
                      />,
                      <Popconfirm
                        key="delete"
                        title="确认删除该要求？"
                        description="删除后可在重新解析时恢复"
                        onConfirm={() => handleDelete(item.id)}
                        okText="确认"
                        cancelText="取消"
                      >
                        <Button
                          type="link"
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                        />
                      </Popconfirm>,
                    ]}
                  >
                    <List.Item.Meta
                      title={
                        <Space wrap>
                          <Text strong>{item.title}</Text>
                          <Tag color={PRIORITY_COLORS[item.priority]}>
                            {PRIORITY_LABELS[item.priority]}
                          </Tag>
                          {item.is_mandatory && (
                            <Tag color="red">强制</Tag>
                          )}
                          <Tag color={RISK_LEVEL_COLORS[item.risk_level]}>
                            {RISK_LEVEL_LABELS[item.risk_level]}风险
                          </Tag>
                        </Space>
                      }
                      description={
                        <>
                          <Paragraph
                            ellipsis={{ rows: 2, expandable: true, symbol: "展开" }}
                            style={{ marginBottom: 4 }}
                          >
                            {item.description || "暂无描述"}
                          </Paragraph>
                          {item.source_text && (
                            <Tooltip title={item.source_text}>
                              <Text
                                type="secondary"
                                style={{ fontSize: 12 }}
                                ellipsis
                              >
                                原文：{item.source_text}
                              </Text>
                            </Tooltip>
                          )}
                        </>
                      }
                    />
                  </List.Item>
                )}
              />
            ),
          }))}
        />
      )}
    </Card>
  );

  // ── 导出记录 Tab ──────────────────────────────────────────────

  const exportsTab = (
    <Card
      title="导出记录"
      extra={
        <Button
          size="small"
          icon={<ReloadOutlined />}
          onClick={fetchExportHistory}
          loading={historyLoading}
        >
          刷新
        </Button>
      }
    >
      {historyLoading && exportHistory.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40 }}>
          <Spin />
        </div>
      ) : exportHistory.length === 0 ? (
        <Empty description="暂无导出记录">
          <Button
            type="primary"
            icon={<ExportOutlined />}
            onClick={() => setExportModalOpen(true)}
          >
            立即导出
          </Button>
        </Empty>
      ) : (
        <List
          dataSource={exportHistory}
          renderItem={(item) => (
            <List.Item
              actions={[
                <Button
                  key="download"
                  type="link"
                  icon={<DownloadOutlined />}
                  onClick={() => {
                    const downloadUrl = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/projects/${id}/export/download`;
                    const a = document.createElement("a");
                    a.href = downloadUrl;
                    a.download = "";
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                  }}
                >
                  下载
                </Button>,
              ]}
            >
              <List.Item.Meta
                avatar={<FileTextOutlined style={{ fontSize: 24 }} />}
                title={
                  <Space>
                    <Text strong>
                      {item.created_at
                        ? dayjs(item.created_at).format("YYYY-MM-DD HH:mm")
                        : "-"}
                    </Text>
                    <Tag color="green">已完成</Tag>
                  </Space>
                }
                description={
                  <Space>
                    <Text type="secondary">
                      修订数：{item.revision_count}
                    </Text>
                    <Text type="secondary">
                      文件大小：{formatFileSize(item.file_size)}
                    </Text>
                  </Space>
                }
              />
            </List.Item>
          )}
          bordered
        />
      )}
    </Card>
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          {project.name}
        </Title>
        <Space>
          <Button
            icon={<FileTextOutlined />}
            onClick={() => router.push(`/projects/${id}/preview`)}
          >
            文档预览
          </Button>
          <Button
            icon={<ProjectOutlined />}
            onClick={() => router.push(`/projects/${id}/tasks`)}
          >
            任务看板
          </Button>
          <Button
            icon={<SafetyCertificateOutlined />}
            onClick={() => router.push(`/projects/${id}/review`)}
          >
            响应检查
          </Button>
          <Button
            type="primary"
            icon={<ExportOutlined />}
            onClick={() => {
              fetchExportHistory();
              setExportModalOpen(true);
            }}
          >
            导出
          </Button>
        </Space>
      </div>
      <Tabs
        defaultActiveKey="files"
        onChange={(key) => {
          if (key === "exports") fetchExportHistory();
        }}
        items={[
          { key: "files", label: "文件管理", children: filesTab },
          { key: "requirements", label: "招标要求", children: requirementsTab },
          { key: "exports", label: "导出记录", children: exportsTab },
        ]}
      />

      {/* 编辑 Modal */}
      <Modal
        title="编辑招标要求"
        open={editModalOpen}
        onOk={handleEditSave}
        onCancel={() => {
          setEditModalOpen(false);
          setEditingReq(null);
        }}
        okText="保存"
        cancelText="取消"
        width={640}
        destroyOnClose
      >
        <Form form={editForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="requirement_type" label="类型">
            <Select options={REQUIREMENT_TYPE_OPTIONS} />
          </Form.Item>
          <Form.Item
            name="title"
            label="标题"
            rules={[{ required: true, message: "请输入标题" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="source_text" label="原文摘录">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Space size="large">
            <Form.Item name="priority" label="优先级" style={{ marginBottom: 0 }}>
              <Select
                style={{ width: 100 }}
                options={[
                  { value: "high", label: "高" },
                  { value: "medium", label: "中" },
                  { value: "low", label: "低" },
                ]}
              />
            </Form.Item>
            <Form.Item name="risk_level" label="风险等级" style={{ marginBottom: 0 }}>
              <Select
                style={{ width: 100 }}
                options={[
                  { value: "blocking", label: "废标" },
                  { value: "high", label: "高" },
                  { value: "medium", label: "中" },
                  { value: "low", label: "低" },
                ]}
              />
            </Form.Item>
            <Form.Item
              name="is_mandatory"
              label="是否强制"
              valuePropName="checked"
              style={{ marginBottom: 0 }}
            >
              <Switch />
            </Form.Item>
          </Space>
        </Form>
      </Modal>

      {/* 导出 Modal */}
      <ExportModal
        open={exportModalOpen}
        projectId={id}
        bidTemplates={files.filter((f) => f.document_type === "bid_template")}
        onClose={() => setExportModalOpen(false)}
        onSuccess={fetchExportHistory}
      />

      {/* 添加 Modal */}
      <Modal
        title="添加招标要求"
        open={addModalOpen}
        onOk={handleAddSave}
        onCancel={() => setAddModalOpen(false)}
        okText="添加"
        cancelText="取消"
        width={640}
        destroyOnClose
      >
        <Form
          form={addForm}
          layout="vertical"
          style={{ marginTop: 16 }}
          initialValues={{
            requirement_type: "business_requirement",
            priority: "medium",
            risk_level: "medium",
            is_mandatory: false,
          }}
        >
          <Form.Item
            name="requirement_type"
            label="类型"
            rules={[{ required: true, message: "请选择类型" }]}
          >
            <Select options={REQUIREMENT_TYPE_OPTIONS} />
          </Form.Item>
          <Form.Item
            name="title"
            label="标题"
            rules={[{ required: true, message: "请输入标题" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="source_text" label="原文摘录">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Space size="large">
            <Form.Item name="priority" label="优先级" style={{ marginBottom: 0 }}>
              <Select
                style={{ width: 100 }}
                options={[
                  { value: "high", label: "高" },
                  { value: "medium", label: "中" },
                  { value: "low", label: "低" },
                ]}
              />
            </Form.Item>
            <Form.Item name="risk_level" label="风险等级" style={{ marginBottom: 0 }}>
              <Select
                style={{ width: 100 }}
                options={[
                  { value: "blocking", label: "废标" },
                  { value: "high", label: "高" },
                  { value: "medium", label: "中" },
                  { value: "low", label: "低" },
                ]}
              />
            </Form.Item>
            <Form.Item
              name="is_mandatory"
              label="是否强制"
              valuePropName="checked"
              style={{ marginBottom: 0 }}
            >
              <Switch />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </div>
  );
}
