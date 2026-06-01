"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
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
  Tabs,
} from "antd";
import {
  ArrowLeftOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
  FileTextOutlined,
  CheckOutlined,
  AimOutlined,
  SafetyCertificateOutlined,
  FormatPainterOutlined,
  TrophyOutlined,
  SolutionOutlined,
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

/** 按检查类型分组的 Tab 定义 */
interface CheckTab {
  key: string;
  label: string;
  icon: React.ReactNode;
  filter: (item: ReviewCheckItem) => boolean;
  emptyText: string;
}

export default function ReviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<ReviewCheckResult | null>(null);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("matrix");

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
            err instanceof Error ? err.message : "响应性检查执行失败"
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
        err instanceof Error ? err.message : "响应性检查执行失败"
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  const handleLocate = useCallback(
    (item: ReviewCheckItem) => {
      router.push(`/projects/${id}/preview`);
    },
    [id, router],
  );

  // 检查 Tab 定义
  const checkTabs: CheckTab[] = useMemo(
    () => [
      {
        key: "matrix",
        label: "响应矩阵",
        icon: <SolutionOutlined />,
        filter: (_item: ReviewCheckItem) => true,
        emptyText: "暂无检查数据",
      },
      {
        key: "disqualification",
        label: "废标项检查",
        icon: <SafetyCertificateOutlined />,
        filter: (item: ReviewCheckItem) =>
          item.risk_level === "blocking" || item.is_mandatory,
        emptyText: "未检测到废标项",
      },
      {
        key: "qualification",
        label: "资质核对",
        icon: <CheckCircleOutlined />,
        filter: (item: ReviewCheckItem) => item.requirement_type === "qualification",
        emptyText: "暂无需核对的资质要求",
      },
      {
        key: "scoring",
        label: "评分项覆盖",
        icon: <TrophyOutlined />,
        filter: (item: ReviewCheckItem) => item.requirement_type === "scoring",
        emptyText: "暂未提取到评分项，请确认招标文件中是否包含评分标准",
      },
      {
        key: "format",
        label: "格式问题",
        icon: <FormatPainterOutlined />,
        filter: (item: ReviewCheckItem) => item.requirement_type === "format",
        emptyText: "未检测到格式问题",
      },
    ],
    [],
  );

  // 统计卡片
  const statsCards = result
    ? [
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
        {
          title: "废标风险",
          value: result.has_blocking_issues ? "有" : "无",
          icon: <SafetyCertificateOutlined />,
          color: result.has_blocking_issues ? "#ff4d4f" : "#52c41a",
        },
      ]
    : [];

  // 当前 Tab 的过滤数据
  const currentTab = checkTabs.find((t) => t.key === activeTab) || checkTabs[0];
  const filteredItems = useMemo(
    () => (result?.items ?? []).filter(currentTab.filter),
    [result, currentTab],
  );

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
          {record.risk_level === "blocking" && (
            <Tag color="#ff0000" style={{ fontSize: 11 }}>废标</Tag>
          )}
          <Tag color={RISK_LEVEL_COLORS[record.risk_level]} style={{ fontSize: 11 }}>
            {RISK_LEVEL_LABELS[record.risk_level]}
          </Tag>
        </Space>
      ),
    },
    {
      title: "操作",
      key: "action",
      width: 100,
      render: (_: unknown, record: ReviewCheckItem) => (
        <Button
          size="small"
          type="link"
          icon={<AimOutlined />}
          onClick={() => handleLocate(record)}
        >
          定位
        </Button>
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

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 80 }}>
        <Spin size="large" tip="正在执行响应性检查..." />
      </div>
    );
  }

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

  const renderTable = (items: ReviewCheckItem[]) =>
    items.length === 0 ? (
      <Empty
        description={currentTab.emptyText}
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
    ) : (
      <Table
        dataSource={items}
        columns={columns}
        rowKey="requirement_id"
        expandable={{
          expandedRowRender,
          rowExpandable: (record) =>
            record.status !== "PASS" || !!record.description,
          defaultExpandAllRows: activeTab !== "matrix",
        }}
        pagination={
          items.length > 20
            ? {
                pageSize: 20,
                showSizeChanger: true,
                showTotal: (t) => `共 ${t} 条`,
              }
            : false
        }
        locale={{ emptyText: "暂无检查数据" }}
      />
    );

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
        <Space>
          <Button onClick={() => router.push(`/projects/${id}/preview`)}>
            返回审阅工作台
          </Button>
          <Button
            type="primary"
            icon={<ReloadOutlined />}
            onClick={runCheck}
            loading={loading}
          >
            重新检查
          </Button>
        </Space>
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
          <Col key={card.title} xs={12} sm={8} md={Math.floor(24 / statsCards.length)} lg={Math.floor(24 / statsCards.length)}>
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

      {/* 分类 Tab 检查结果 */}
      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={checkTabs.map((tab) => ({
            key: tab.key,
            label: (
              <Space size={4}>
                {tab.icon}
                <span>{tab.label}</span>
                <Tag>
                  {(result.items ?? []).filter(tab.filter).length}
                </Tag>
              </Space>
            ),
            children: renderTable(filteredItems),
          }))}
        />
      </Card>
    </div>
  );
}
