"use client";

import { useState, useMemo, useCallback } from "react";
import {
  Collapse,
  Tag,
  Button,
  Space,
  Modal,
  Input,
  Upload,
  message,
  Tooltip,
  Empty,
  Typography,
  Select,
} from "antd";
import {
  CheckOutlined,
  StopOutlined,
  EditOutlined,
  UploadOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { api } from "@/lib/api";
import type { UnfinishedItem } from "@/lib/types/unfinished_item";
import {
  UNFINISHED_RISK_LABELS,
  UNFINISHED_RISK_COLORS,
  UNFINISHED_STATUS_LABELS,
  UNFINISHED_STATUS_COLORS,
  UNFINISHED_TYPE_LABELS,
} from "@/lib/types/unfinished_item";

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

interface Props {
  items: UnfinishedItem[];
  onStatusChange: () => void;
  onItemLocate: (item: UnfinishedItem) => void;
}

interface RiskGroup {
  riskLevel: string;
  items: UnfinishedItem[];
}

/** 按 risk_level 分组，blocking > high > medium > low */
function groupByRisk(items: UnfinishedItem[]): RiskGroup[] {
  const order: Record<string, number> = { blocking: 0, high: 1, medium: 2, low: 3 };
  const map = new Map<string, UnfinishedItem[]>();
  for (const item of items) {
    const level = item.risk_level;
    const group = map.get(level);
    if (group) {
      group.push(item);
    } else {
      map.set(level, [item]);
    }
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => (order[a] || 99) - (order[b] || 99))
    .map(([riskLevel, items]) => ({ riskLevel, items }));
}

/** 是否是活跃状态（可操作） */
function isOpen(item: UnfinishedItem): boolean {
  return item.status === "open";
}

export default function UnfinishedPanel({ items, onStatusChange, onItemLocate }: Props) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // 筛选
  const [filterRisk, setFilterRisk] = useState<string[]>([]);
  const [filterType, setFilterType] = useState<string[]>([]);

  // 手动填写 Modal
  const [fillModalOpen, setFillModalOpen] = useState(false);
  const [fillItem, setFillItem] = useState<UnfinishedItem | null>(null);
  const [fillContent, setFillContent] = useState("");

  // 补充资料 Modal
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadItem, setUploadItem] = useState<UnfinishedItem | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);

  // 忽略原因 Modal
  const [ignoreModalOpen, setIgnoreModalOpen] = useState(false);
  const [ignoreItem, setIgnoreItem] = useState<UnfinishedItem | null>(null);
  const [ignoreReason, setIgnoreReason] = useState("");

  // 筛选后的分组
  const filteredItems = useMemo(() => {
    let filtered = items;
    if (filterRisk.length > 0) {
      filtered = filtered.filter((i) => filterRisk.includes(i.risk_level));
    }
    if (filterType.length > 0) {
      filtered = filtered.filter((i) => filterType.includes(i.item_type));
    }
    return filtered;
  }, [items, filterRisk, filterType]);

  const riskGroups = useMemo(() => groupByRisk(filteredItems), [filteredItems]);

  // 可用的筛选选项（从全部数据中提取）
  const riskOptions = useMemo(
    () =>
      Array.from(new Set(items.map((i) => i.risk_level))).map((v) => ({
        value: v,
        label: UNFINISHED_RISK_LABELS[v] || v,
      })),
    [items],
  );

  const typeOptions = useMemo(
    () =>
      Array.from(new Set(items.map((i) => i.item_type))).map((v) => ({
        value: v,
        label: UNFINISHED_TYPE_LABELS[v] || v,
      })),
    [items],
  );

  const openItems = useMemo(() => items.filter(isOpen), [items]);

  // ── 单条操作 ────────────────────────────────────────────────

  const handleMarkResolved = useCallback(
    async (itemId: string) => {
      setActionLoading(itemId);
      try {
        await api.patch(`/api/unfinished/${itemId}/status`, { status: "resolved" });
        message.success("已标记为已解决");
        onStatusChange();
      } catch {
        message.error("操作失败，请重试");
      } finally {
        setActionLoading(null);
      }
    },
    [onStatusChange],
  );

  const handleIgnore = useCallback(async () => {
    if (!ignoreItem || !ignoreReason.trim()) return;
    setActionLoading(ignoreItem.id);
    try {
      await api.patch(`/api/unfinished/${ignoreItem.id}/status`, {
        status: "ignored",
        ignore_reason: ignoreReason.trim(),
      });
      message.success("已忽略该未完成项");
      setIgnoreModalOpen(false);
      setIgnoreItem(null);
      setIgnoreReason("");
      onStatusChange();
    } catch {
      message.error("操作失败，请重试");
    } finally {
      setActionLoading(null);
    }
  }, [ignoreItem, ignoreReason, onStatusChange]);

  const handleOpenIgnoreModal = useCallback((item: UnfinishedItem) => {
    setIgnoreItem(item);
    setIgnoreReason("");
    setIgnoreModalOpen(true);
  }, []);

  // ── 手动填写 ────────────────────────────────────────────────

  const handleOpenFillModal = useCallback((item: UnfinishedItem) => {
    setFillItem(item);
    setFillContent("");
    setFillModalOpen(true);
  }, []);

  const handleFillSubmit = useCallback(async () => {
    if (!fillItem || !fillContent.trim()) return;
    setActionLoading(fillItem.id);
    try {
      await api.post(`/api/unfinished/${fillItem.id}/manual-fill`, {
        content: fillContent.trim(),
      });
      message.success("手动填写完成，已创建修订记录");
      setFillModalOpen(false);
      setFillItem(null);
      setFillContent("");
      onStatusChange();
    } catch {
      message.error("操作失败，请重试");
    } finally {
      setActionLoading(null);
    }
  }, [fillItem, fillContent, onStatusChange]);

  // ── 补充资料后重新生成 ──────────────────────────────────────

  const handleOpenUploadModal = useCallback((item: UnfinishedItem) => {
    setUploadItem(item);
    setUploadFile(null);
    setUploadModalOpen(true);
  }, []);

  const handleUploadSubmit = useCallback(async () => {
    if (!uploadItem || !uploadFile) return;
    setUploadLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      const result = await api.upload<{
        status: string;
        ai_revision: unknown;
      }>(`/api/unfinished/${uploadItem.id}/regenerate`, formData);
      if (result.ai_revision) {
        message.success("补充资料后重新生成完成，请查看 AI 修订列表");
      } else {
        message.success("已重新生成");
      }
      setUploadModalOpen(false);
      setUploadItem(null);
      setUploadFile(null);
      onStatusChange();
    } catch {
      message.error("重新生成失败，请重试");
    } finally {
      setUploadLoading(false);
    }
  }, [uploadItem, uploadFile, onStatusChange]);

  // ── 渲染函数 ────────────────────────────────────────────────

  const renderActionButtons = (item: UnfinishedItem) => {
    if (!isOpen(item)) return null;

    return (
      <Space size={2} wrap>
        <Tooltip title="标记为已解决">
          <Button
            size="small"
            type="text"
            icon={<CheckOutlined />}
            style={{ color: "#52c41a" }}
            loading={actionLoading === item.id}
            onClick={() => handleMarkResolved(item.id)}
          />
        </Tooltip>
        <Tooltip title="手动填写内容">
          <Button
            size="small"
            type="text"
            icon={<EditOutlined />}
            style={{ color: "#1677ff" }}
            onClick={() => handleOpenFillModal(item)}
          />
        </Tooltip>
        <Tooltip title="补充资料后重新生成">
          <Button
            size="small"
            type="text"
            icon={<UploadOutlined />}
            style={{ color: "#722ed1" }}
            onClick={() => handleOpenUploadModal(item)}
          />
        </Tooltip>
        <Tooltip title="忽略">
          <Button
            size="small"
            type="text"
            icon={<StopOutlined />}
            style={{ color: "#8c8c8c" }}
            onClick={() => handleOpenIgnoreModal(item)}
          />
        </Tooltip>
      </Space>
    );
  };

  // ── 空态 ────────────────────────────────────────────────────

  if (items.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: 40 }}>
        <Empty
          description="暂无未完成项"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
        <Text type="secondary" style={{ fontSize: 12, marginTop: 8, display: "block" }}>
          未完成项在模板解析后自动生成，包含系统无法自动处理的位置。
        </Text>
      </div>
    );
  }

  return (
    <>
      {/* 统计和筛选栏 */}
      <div style={{ padding: "0 0 8px 0", borderBottom: "1px solid #f0f0f0", marginBottom: 8 }}>
        <div style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
          <WarningOutlined style={{ color: "#ff4d4f" }} />
          <Text strong style={{ fontSize: 13 }}>
            未完成项 ({openItems.length}/{items.length})
          </Text>
        </div>
        <Space size={8} style={{ width: "100%" }}>
          <Select
            mode="multiple"
            placeholder="风险等级"
            size="small"
            style={{ minWidth: 120 }}
            options={riskOptions}
            value={filterRisk}
            onChange={setFilterRisk}
            allowClear
            maxTagCount={1}
          />
          <Select
            mode="multiple"
            placeholder="类型"
            size="small"
            style={{ minWidth: 120 }}
            options={typeOptions}
            value={filterType}
            onChange={setFilterType}
            allowClear
            maxTagCount={1}
          />
        </Space>
      </div>

      {/* 按风险等级分组 */}
      {riskGroups.length === 0 ? (
        <Empty description="无匹配的未完成项" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <Collapse
          defaultActiveKey={riskGroups.map((g) => g.riskLevel)}
          size="small"
          ghost
          style={{ background: "transparent" }}
          items={riskGroups.map((group) => ({
            key: group.riskLevel,
            label: (
              <Space size={4}>
                <Tag color={UNFINISHED_RISK_COLORS[group.riskLevel]}>
                  {UNFINISHED_RISK_LABELS[group.riskLevel] || group.riskLevel}
                </Tag>
                <Text style={{ fontSize: 12 }}>{group.items.length} 项</Text>
              </Space>
            ),
            children: (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {group.items.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      padding: "8px 10px",
                      background: "#fafafa",
                      borderRadius: 6,
                      border: "1px solid #f0f0f0",
                      cursor: "pointer",
                      transition: "background 0.2s",
                      borderLeft: `3px solid ${UNFINISHED_RISK_COLORS[item.risk_level] || "#d9d9d9"}`,
                    }}
                    onClick={() => onItemLocate(item)}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background = "#fff1f0";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = "#fafafa";
                    }}
                  >
                    {/* 顶部标签行 */}
                    <div
                      style={{
                        marginBottom: 6,
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        flexWrap: "wrap",
                      }}
                    >
                      <Tag
                        color={UNFINISHED_RISK_COLORS[item.risk_level]}
                        style={{ fontSize: 11, lineHeight: "18px" }}
                      >
                        {UNFINISHED_RISK_LABELS[item.risk_level] || item.risk_level}
                      </Tag>
                      <Tag
                        color={UNFINISHED_STATUS_COLORS[item.status]}
                        style={{ fontSize: 11, lineHeight: "18px" }}
                      >
                        {UNFINISHED_STATUS_LABELS[item.status] || item.status}
                      </Tag>
                      {item.status === "ignored" && item.metadata?.ignore_reason ? (
                        <Tooltip title={String(item.metadata.ignore_reason)}>
                          <Tag color="default" style={{ fontSize: 10, lineHeight: "18px", maxWidth: 100 }}>
                            <Text ellipsis style={{ fontSize: 10 }}>
                              {String(item.metadata.ignore_reason)}
                            </Text>
                          </Tag>
                        </Tooltip>
                      ) : null}
                    </div>

                    {/* 章节路径 */}
                    {item.section_path && (
                      <Text style={{ fontSize: 11, color: "#8c8c8c", display: "block", marginBottom: 4 }}>
                        {item.section_path}
                      </Text>
                    )}

                    {/* 原因 */}
                    {item.reason && (
                      <Paragraph
                        ellipsis={{ rows: 2 }}
                        style={{ margin: 0, marginBottom: 4, fontSize: 12, color: "#555" }}
                      >
                        {item.reason}
                      </Paragraph>
                    )}

                    {/* 影响 */}
                    {item.impact && (
                      <Text type="secondary" style={{ fontSize: 11, display: "block", marginBottom: 4 }}>
                        {item.impact}
                      </Text>
                    )}

                    {/* 建议动作 */}
                    {item.suggested_action && (
                      <Text
                        style={{
                          fontSize: 11,
                          color: "#1677ff",
                          display: "block",
                          marginBottom: 6,
                          fontStyle: "italic",
                        }}
                      >
                        {item.suggested_action}
                      </Text>
                    )}

                    {/* 操作按钮 */}
                    {renderActionButtons(item)}
                  </div>
                ))}
              </div>
            ),
          }))}
        />
      )}

      {/* 手动填写 Modal */}
      <Modal
        title="手动填写内容"
        open={fillModalOpen}
        onOk={handleFillSubmit}
        onCancel={() => {
          setFillModalOpen(false);
          setFillItem(null);
        }}
        okText="提交（创建 AI 修订记录）"
        cancelText="取消"
        width={600}
        destroyOnClose
        confirmLoading={!!(fillItem && actionLoading === fillItem.id)}
      >
        {fillItem && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                位置：{fillItem.section_path || "未知"}
              </Text>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>
                原因：{fillItem.reason || "未知"}
              </Text>
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                填写内容
              </Text>
              <TextArea
                value={fillContent}
                onChange={(e) => setFillContent(e.target.value)}
                rows={8}
                placeholder="在此填写该位置的内容，提交后将创建一条 AI 修订记录..."
                style={{ marginTop: 4 }}
              />
            </div>
          </div>
        )}
      </Modal>

      {/* 补充资料后重新生成 Modal */}
      <Modal
        title="补充资料后重新生成"
        open={uploadModalOpen}
        onOk={handleUploadSubmit}
        onCancel={() => {
          setUploadModalOpen(false);
          setUploadItem(null);
          setUploadFile(null);
        }}
        okText="上传并生成"
        cancelText="取消"
        confirmLoading={uploadLoading}
        okButtonProps={{ disabled: !uploadFile }}
        destroyOnClose
      >
        {uploadItem && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                位置：{uploadItem.section_path || "未知"}
              </Text>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>
                建议动作：{uploadItem.suggested_action || "请提供相关补充资料"}
              </Text>
            </div>
            <Upload.Dragger
              accept=".docx,.pdf,.doc,.txt"
              maxCount={1}
              beforeUpload={(file) => {
                setUploadFile(file);
                return false; // 阻止自动上传
              }}
              onRemove={() => setUploadFile(null)}
              fileList={uploadFile ? [{ uid: "-1", name: uploadFile.name, status: "done" } as never] : []}
              style={{ padding: "12px 0" }}
            >
              <Space direction="vertical" size={4}>
                <UploadOutlined style={{ fontSize: 24, color: "#1677ff" }} />
                <Text style={{ fontSize: 12 }}>
                  拖拽或点击上传补充资料（Word/PDF/文本）
                </Text>
              </Space>
            </Upload.Dragger>
          </div>
        )}
      </Modal>

      {/* 忽略原因 Modal */}
      <Modal
        title="忽略未完成项"
        open={ignoreModalOpen}
        onOk={handleIgnore}
        onCancel={() => {
          setIgnoreModalOpen(false);
          setIgnoreItem(null);
        }}
        okText="确认忽略"
        cancelText="取消"
        confirmLoading={!!(ignoreItem && actionLoading === ignoreItem.id)}
        okButtonProps={{ danger: true }}
        destroyOnClose
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            请填写忽略原因（必填）：
          </Text>
          <TextArea
            value={ignoreReason}
            onChange={(e) => setIgnoreReason(e.target.value)}
            rows={3}
            placeholder="例如：该位置经人工确认无需填写..."
          />
        </div>
      </Modal>
    </>
  );
}
