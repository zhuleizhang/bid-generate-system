"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Typography,
  Card,
  Tag,
  Button,
  Space,
  Spin,
  Empty,
  List,
  message,
  Modal,
  Checkbox,
  Divider,
} from "antd";
import {
  ArrowLeftOutlined,
  CheckOutlined,
  DeleteOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import { useParams, useRouter } from "next/navigation";

const { Title, Text, Paragraph } = Typography;

interface PendingExperience {
  id: string;
  aiContent: string;
  userEditedContent: string;
  revisionId: string;
  sectionPath: string;
  scope: string;
  capturedAt: string;
}

/** 经验确认页 — 项目复盘时统一确认"稍后再说"的修改经验。 */
export default function ExperienceConfirmPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<PendingExperience[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // 从 localStorage 加载待确认的经验
    const load = async () => {
      try {
        const stored = localStorage.getItem(`pending_experiences_${id}`);
        if (stored) {
          setItems(JSON.parse(stored));
        }
      } catch {
        // ignore
      }
      setLoading(false);
    };
    load();
  }, [id]);

  const handleSave = useCallback(
    async (item: PendingExperience) => {
      message.success(`已保存为${item.scope === "company" ? "公司通用" : item.scope === "industry" ? "行业通用" : item.scope === "customer" ? "客户" : "审查"}经验`);
      removeItems([item.id]);
    },
    [id],
  );

  const handleDiscard = useCallback(
    (itemId: string) => {
      removeItems([itemId]);
    },
    [id],
  );

  const removeItems = (ids: string[]) => {
    const remaining = items.filter((item) => !ids.includes(item.id));
    setItems(remaining);
    setSelectedIds(new Set());
    localStorage.setItem(`pending_experiences_${id}`, JSON.stringify(remaining));
  };

  const handleBatchSave = async () => {
    setSaving(true);
    const selected = items.filter((item) => selectedIds.has(item.id));
    for (const item of selected) {
      message.success(`已保存经验：${item.sectionPath || "未分类"}`);
    }
    removeItems(selected.map((i) => i.id));
    setSaving(false);
  };

  const handleBatchDiscard = () => {
    removeItems(Array.from(selectedIds));
  };

  const toggleSelect = (itemId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 24,
        }}
      >
        <Space>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => router.push("/projects")}
          >
            返回项目列表
          </Button>
          <Title level={4} style={{ margin: 0 }}>
            经验确认
          </Title>
          {items.length > 0 && (
            <Tag color="processing">{items.length} 条待确认</Tag>
          )}
        </Space>
        {items.length > 0 && selectedIds.size > 0 && (
          <Space>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={saving}
              onClick={handleBatchSave}
            >
              批量保存 ({selectedIds.size})
            </Button>
            <Button
              danger
              icon={<DeleteOutlined />}
              onClick={handleBatchDiscard}
            >
              批量放弃
            </Button>
          </Space>
        )}
      </div>

      {items.length === 0 ? (
        <Card>
          <Empty
            description={
              <div>
                <Paragraph type="secondary">
                  暂无待确认的写作经验
                </Paragraph>
                <Paragraph type="secondary" style={{ fontSize: 12 }}>
                  在审阅工作台中"修改后接受"时选择"稍后再说"的经验会出现在这里，
                  供项目复盘时统一确认
                </Paragraph>
              </div>
            }
          >
            <Button
              type="primary"
              onClick={() => router.push(`/projects/${id}/preview`)}
            >
              前往审阅工作台
            </Button>
          </Empty>
        </Card>
      ) : (
        <List
          dataSource={items}
          renderItem={(item) => (
            <Card
              size="small"
              style={{ marginBottom: 12 }}
              styles={{ body: { padding: 16 } }}
            >
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <Checkbox
                  checked={selectedIds.has(item.id)}
                  onChange={() => toggleSelect(item.id)}
                  style={{ marginTop: 4 }}
                />
                <div style={{ flex: 1 }}>
                  {item.sectionPath && (
                    <Tag color="blue" style={{ marginBottom: 8 }}>
                      {item.sectionPath}
                    </Tag>
                  )}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 12,
                      marginBottom: 12,
                    }}
                  >
                    <div>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        AI 原文：
                      </Text>
                      <div
                        style={{
                          background: "#fff1f0",
                          borderRadius: 4,
                          padding: 8,
                          fontSize: 13,
                          maxHeight: 100,
                          overflow: "auto",
                        }}
                      >
                        {item.aiContent || "(空)"}
                      </div>
                    </div>
                    <div>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        人工修改后：
                      </Text>
                      <div
                        style={{
                          background: "#f6ffed",
                          borderRadius: 4,
                          padding: 8,
                          fontSize: 13,
                          maxHeight: 100,
                          overflow: "auto",
                        }}
                      >
                        {item.userEditedContent || "(空)"}
                      </div>
                    </div>
                  </div>
                  <Divider style={{ margin: "8px 0" }} />
                  <Space>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {item.capturedAt
                        ? new Date(item.capturedAt).toLocaleString("zh-CN")
                        : ""}
                    </Text>
                    <Button
                      size="small"
                      type="primary"
                      icon={<CheckOutlined />}
                      onClick={() => handleSave(item)}
                    >
                      保存
                    </Button>
                    <Button
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={() => handleDiscard(item.id)}
                    >
                      放弃
                    </Button>
                  </Space>
                </div>
              </div>
            </Card>
          )}
        />
      )}
    </div>
  );
}
