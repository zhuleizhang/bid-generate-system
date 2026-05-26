"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Typography,
  Card,
  Tag,
  Table,
  Button,
  Space,
  Spin,
  Empty,
  Alert,
  Statistic,
  Row,
  Col,
} from "antd";
import {
  ArrowLeftOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
  FileTextOutlined,
  CheckOutlined,
} from "@ant-design/icons";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { ReviewCheckResult, ReviewCheckItem } from "@/lib/types/review";
import { REVIEW_STATUS_LABELS, REVIEW_STATUS_COLORS } from "@/lib/types/review";
import {
  REQUIREMENT_TYPE_LABELS,
  RISK_LEVEL_LABELS,
  RISK_LEVEL_COLORS,
} from "@/lib/types/requirement";

const { Title, Text } = Typography;

export default function ReviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<ReviewCheckResult | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const runCheck = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await api.post<ReviewCheckResult>(
          `/api/projects/${id}/review`
        );
        if (!cancelled) setResult(data);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "响应性检查执行失败，请确保项目已上传招标文件并完成 AIRevision 生成"
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    runCheck();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const runCheck = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.post<ReviewCheckResult>(
        `/api/projects/${id}/review`
      );
      setResult(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "响应性检查执行失败，请确保项目已上传招标文件并完成 AIRevision 生成"
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  // 构建统计卡片
  const statsCards = result ? [
    {
      title: "总要求数",
      value: result.total_requirements,
      icon: <FileTextOutlined />,
      color: "#1677ff",
    },
    {
      title: "已覆盖",
      value: result.pass_count,
      icon: <CheckCircleOutlined />,
      color: "#52c41a",
    },
    {
      title: "无响应",
      value: result.fail_count,
      icon: <CloseCircleOutlined />,
      color: "#ff4d4f",
    },
    {
      title: "待确认",
      value: result.warning_count,
      icon: <WarningOutlined />,
      color: "#faad14",
    },
    {
      title: "覆盖率",
      value: `${(result.coverage_rate * 100).toFixed(1)}%`,
      icon: <CheckOutlined />,
      color: result.coverage_rate >= 0.8 ? "#52c41a" : "#ff4d4f",
    },
  ] : [];

  // 表格列定义
  const columns = [
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 100,
      render: (status: string) => (
        <Tag color={REVIEW_STATUS_COLORS[status]} style={{ fontSize: 13, padding: "2px 10px" }}>
          {REVIEW_STATUS_LABELS[status]}
        </Tag>
      ),
    },
    {
      title: "类型",
      dataIndex: "requirement_type",
      key: "requirement_type",
      width: 120,
      render: (type: string) => (
        <Tag>{REQUIREMENT_TYPE_LABELS[type] || type}</Tag>
      ),
    },
    {
      title: "标题",
      dataIndex: "title",
      key: "title",
      render: (title: string, record: ReviewCheckItem) => (
        <Space>
          <Text strong>{title}</Text>
          {record.is_mandatory && (
            <Tag color="red" style={{ fontSize: 11 }}>强制</Tag>
          )}
          <Tag color={RISK_LEVEL_COLORS[record.risk_level]} style={{ fontSize: 11 }}>
            {RISK_LEVEL_LABELS[record.risk_level]}
          </Tag>
        </Space>
      ),
    },
  ];

  const expandedRowRender = (record: ReviewCheckItem) => (
    <div style={{ padding: "8px 16px" }}>
      {record.description && (
        <p style={{ marginBottom: 8 }}>
          <Text type="secondary">描述：</Text>
          <Text>{record.description}</Text>
        </p>
      )}
      <p style={{ marginBottom: 8 }}>
        <Text type="secondary">检查结果：</Text>
        <Text>{record.message}</Text>
      </p>
      {record.suggested_action && (
        <p style={{ marginBottom: 8 }}>
          <Text type="secondary">建议动作：</Text>
          <Text>{record.suggested_action}</Text>
        </p>
      )}
      {record.matched_revision_ids.length > 0 && (
        <p style={{ marginBottom: 0 }}>
          <Text type="secondary">
            关联修订：{record.matched_revision_ids.length} 条
          </Text>
        </p>
      )}
    </div>
  );

  // 加载态
  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 80 }}>
        <Spin size="large" tip="正在执行响应性检查..." />
      </div>
    );
  }

  // 错误态
  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => router.back()}
          style={{ marginBottom: 24 }}
        >
          返回
        </Button>
        <Empty description={error}>
          <Button type="primary" onClick={runCheck}>
            重试
          </Button>
        </Empty>
      </div>
    );
  }

  // 无要求状态
  if (!result || result.total_requirements === 0) {
    return (
      <div style={{ padding: 24 }}>
        <Space style={{ marginBottom: 24 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => router.back()}>
            返回
          </Button>
          <Button icon={<ReloadOutlined />} onClick={runCheck}>
            重新检查
          </Button>
        </Space>
        <Empty description="暂无招标要求，请先上传招标文件并完成解析提取" />
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      {/* 顶栏 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 24,
        }}
      >
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => router.back()}>
            返回
          </Button>
          <Title level={4} style={{ margin: 0 }}>
            响应性检查
          </Title>
        </Space>
        <Button
          type="primary"
          icon={<ReloadOutlined />}
          onClick={runCheck}
          loading={loading}
        >
          重新检查
        </Button>
      </div>

      {/* 全局警告横幅 */}
      {result.has_blocking_issues && (
        <Alert
          message="存在未响应的强制要求，建议处理后再导出"
          description="以下招标要求（含废标项）尚未被任何已接受的 AIRevision 覆盖，导出前请确保处理后标记为已覆盖。"
          type="error"
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        {statsCards.map((card) => (
          <Col key={card.title} xs={24} sm={12} md={Math.floor(24 / statsCards.length)} lg={Math.floor(24 / statsCards.length)}>
            <Card size="small">
              <Statistic
                title={card.title}
                value={card.value}
                valueStyle={{ color: card.color, fontSize: 24 }}
                prefix={card.icon}
              />
            </Card>
          </Col>
        ))}
      </Row>

      {/* 响应矩阵表格 */}
      <Card title="响应矩阵">
        <Table
          dataSource={result.items}
          columns={columns}
          rowKey="requirement_id"
          expandable={{
            expandedRowRender,
            rowExpandable: (record) =>
              record.status !== "PASS" || !!record.description,
            defaultExpandAllRows: result.fail_count > 0,
          }}
          pagination={
            result.items.length > 20
              ? { pageSize: 20, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }
              : false
          }
          locale={{ emptyText: "暂无检查数据" }}
        />
      </Card>
    </div>
  );
}
