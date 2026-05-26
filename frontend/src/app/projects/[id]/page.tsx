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
} from "antd";
import {
  InboxOutlined,
  FileOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import type { UploadFile, RcFile } from "antd/es/upload/interface";
import { useParams } from "next/navigation";
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

const { Dragger } = Upload;
const { Title, Text } = Typography;

// 允许的文件扩展名
const ALLOWED_EXTENSIONS = [".docx", ".pdf", ".doc"];
const ALLOWED_EXTENSIONS_DISPLAY = ALLOWED_EXTENSIONS.join(", ");

// 扩展名 → document_type 默认映射
const DEFAULT_TYPE_MAP: Record<string, string> = {
  ".docx": "bid_template",
  ".pdf": "tender_doc",
  ".doc": "company_material",
};

/** 从扩展名推断 document_type */
function getDefaultDocType(filename: string): string {
  const ext = "." + (filename.split(".").pop()?.toLowerCase() || "");
  return DEFAULT_TYPE_MAP[ext] || "company_material";
}

/** 检查文件扩展名是否允许 */
function isAllowedFile(filename: string): boolean {
  const ext = "." + (filename.split(".").pop()?.toLowerCase() || "");
  return ALLOWED_EXTENSIONS.includes(ext);
}

/** 格式化文件大小为可读字符串 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0);
  return `${size} ${units[i]}`;
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [files, setFiles] = useState<ProjectFileItem[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadFileList, setUploadFileList] = useState<UploadFile[]>([]);

  // 加载项目详情
  useEffect(() => {
    let cancelled = false;
    const loadProject = async () => {
      try {
        const data = await api.get<Project>(`/api/projects/${id}`);
        if (!cancelled) {
          setProject(data);
          // 项目加载成功后拉取文件列表
          const fileData = await api.get<{ files: ProjectFileItem[] }>(
            `/api/projects/${id}/files`
          );
          if (!cancelled) setFiles(fileData.files);
        }
      } catch {
        if (!cancelled) message.error("加载项目信息失败");
      } finally {
        if (!cancelled) setPageLoading(false);
      }
    };
    loadProject();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // 刷新文件列表
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

  // 上传前校验文件类型
  const handleBeforeUpload = (file: RcFile) => {
    if (!isAllowedFile(file.name)) {
      message.error(
        `不支持的文件类型 "${file.name.split(".").pop()}"，仅支持 ${ALLOWED_EXTENSIONS_DISPLAY}`
      );
      return Upload.LIST_IGNORE;
    }
    // 50MB 大小限制
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      message.error(`文件 "${file.name}" 超过 50MB 限制`);
      return Upload.LIST_IGNORE;
    }
    return true;
  };

  // 自定义上传逻辑
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

    // 在文件对象上挂载 document_type，供后续使用
    const docType = getDefaultDocType(rcFile.name);
    formData.append("document_type", docType);

    setUploading(true);
    try {
      // 手动 fetch 以支持上传进度
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

  // 处理上传状态变化
  const handleUploadChange = (info: { file: UploadFile; fileList: UploadFile[] }) => {
    setUploadFileList(info.fileList);
  };

  // 按类型分组文件
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

  return (
    <div>
      {/* 项目基本信息 */}
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

      {/* 文件上传区域 */}
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

      {/* 已上传文件列表 */}
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
}
