"use client";

import { useEffect, useState, useCallback } from "react";
import { Typography, Card, Button, Space, List, Tag, message, Empty, Spin, Result, Descriptions } from "antd";
import {
  ExportOutlined,
  DownloadOutlined,
  ReloadOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
} from "@ant-design/icons";
import { useParams } from "next/navigation";
import type { ExportRecordResponse } from "@/lib/types/export";
import type { Project } from "@/lib/types/project";
import { api } from "@/lib/api";
import dayjs from "dayjs";

const { Title, Text } = Typography;

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

/** 独立导出页面（PRD 第 8 页）— 范围选择、检查摘要、导出历史、下载。 */
export default function ExportPage() {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<Project | null>(null);
  const [history, setHistory] = useState<ExportRecordResponse[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [checkResult, setCheckResult] = useState<{
    blocking_count: number;
    warning_count: number;
    total_checks: number;
  } | null>(null);

  const loadProject = useCallback(async () => {
    try {
      const p = await api.get<Project>(`/api/projects/${id}`);
      setProject(p);
    } catch {
      message.error("加载项目信息失败");
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const data = await api.get<ExportRecordResponse[]>(
        `/api/projects/${id}/exports`
      );
      setHistory(data);
    } catch {
      // 静默
    } finally {
      setHistoryLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadProject();
    fetchHistory();
  }, [loadProject, fetchHistory]);

  const handleCheck = async () => {
    try {
      const result = await api.get<{
        blocking_count: number;
        warning_count: number;
        total_checks: number;
      }>(`/api/projects/${id}/review`);
      setCheckResult(result);
    } catch {
      message.error("执行检查失败");
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const result = await api.post<ExportRecordResponse>(
        `/api/projects/${id}/export`
      );
      message.success("导出成功");
      fetchHistory();
    } catch {
      message.error("导出失败");
    } finally {
      setExporting(false);
    }
  };

  const handleDownload = () => {
    const url = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/projects/${id}/export/download`;
    const a = document.createElement("a");
    a.href = url;
    a.download = "";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const hasBlocking = (checkResult?.blocking_count ?? 0) > 0;

  if (loading) {
    return <div style={{ textAlign: "center", padding: 80 }}><Spin size="large" /></div>;
  }

  if (!project) {
    return <Result status="404" title="项目不存在" />;
  }

  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>
        {project.name} — 文档导出
      </Title>

      {/* 导出操作区 */}
      <Card style={{ marginBottom: 24 }}>
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
          <Descriptions size="small" column={4}>
            <Descriptions.Item label="项目状态">{project.status}</Descriptions.Item>
            <Descriptions.Item label="截止时间">
              {project.deadline ? dayjs(project.deadline).format("YYYY-MM-DD") : "-"}
            </Descriptions.Item>
          </Descriptions>

          <Button type="primary" size="large" icon={<CheckCircleOutlined />} onClick={handleCheck}>
            执行导出前完整检查
          </Button>

          {checkResult && (
            <Card size="small" style={{ background: hasBlocking ? "#fff2f0" : "#f6ffed" }}>
              <Space size="middle">
                <Text>检查项: {checkResult.total_checks}</Text>
                <Text type="danger">
                  <CloseCircleOutlined /> 阻断: {checkResult.blocking_count}
                </Text>
                <Text type="warning">
                  <WarningOutlined /> 警告: {checkResult.warning_count}
                </Text>
                {hasBlocking && (
                  <Text type="danger">存在阻断项，导出前请先处理</Text>
                )}
              </Space>
            </Card>
          )}

          <Space size="middle">
            <Button
              type="primary"
              size="large"
              icon={<ExportOutlined />}
              onClick={handleExport}
              loading={exporting}
              disabled={hasBlocking}
            >
              导出 DOCX
            </Button>
            {history.length > 0 && (
              <Button
                size="large"
                icon={<DownloadOutlined />}
                onClick={handleDownload}
              >
                下载最新导出
              </Button>
            )}
          </Space>
        </Space>
      </Card>

      {/* 导出历史 */}
      <Card
        title="导出历史"
        extra={
          <Button
            size="small"
            icon={<ReloadOutlined />}
            onClick={fetchHistory}
            loading={historyLoading}
          >
            刷新
          </Button>
        }
      >
        {historyLoading && history.length === 0 ? (
          <Spin />
        ) : history.length === 0 ? (
          <Empty description="暂无导出记录" />
        ) : (
          <List
            dataSource={history}
            renderItem={(item) => (
              <List.Item
                actions={[
                  <Button
                    key="download"
                    type="link"
                    icon={<DownloadOutlined />}
                    onClick={handleDownload}
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
                      <Text type="secondary">修订数：{item.revision_count}</Text>
                      <Text type="secondary">文件大小：{formatSize(item.file_size)}</Text>
                    </Space>
                  }
                />
              </List.Item>
            )}
            bordered
          />
        )}
      </Card>
    </div>
  );
}
