"use client";

import { useState, useMemo, useCallback } from "react";
import {
  Collapse,
  Tag,
  Button,
  Space,
  Modal,
  Input,
  message,
  Popconfirm,
  Tooltip,
  Empty,
  Typography,
  Checkbox,
} from "antd";
import {
  CheckOutlined,
  CloseOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import { api } from "@/lib/api";
import type { AIRevision } from "@/lib/types/ai_revision";
import {
  REVISION_TYPE_LABELS,
  REVISION_TYPE_COLORS,
  RISK_LEVEL_LABELS,
  RISK_LEVEL_COLORS,
  STATUS_LABELS,
  STATUS_COLORS,
} from "@/lib/types/ai_revision";

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

interface Props {
  revisions: AIRevision[];
  onStatusChange: () => void;
}

interface SectionGroup {
  sectionPath: string;
  revisions: AIRevision[];
}

/** 从 metadata 中提取 section_path，降级为 "未分类" */
function getSectionPath(rev: AIRevision): string {
  const sp = rev.metadata?.section_path;
  return typeof sp === "string" && sp.trim() ? sp.trim() : "未分类";
}

/** 按 section_path 分组 */
function groupBySection(revisions: AIRevision[]): SectionGroup[] {
  const map = new Map<string, AIRevision[]>();
  for (const rev of revisions) {
    const path = getSectionPath(rev);
    const group = map.get(path);
    if (group) {
      group.push(rev);
    } else {
      map.set(path, [rev]);
    }
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => {
      if (a === "未分类") return 1;
      if (b === "未分类") return -1;
      return a.localeCompare(b);
    })
    .map(([sectionPath, revisions]) => ({ sectionPath, revisions }));
}

/** 可批量操作的修订状态 */
function isActionable(rev: AIRevision): boolean {
  return rev.status === "pending" || rev.status === "need_human_confirm";
}

export default function RevisionSidebar({ revisions, onStatusChange }: Props) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // 编辑 Modal 状态
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingRevision, setEditingRevision] = useState<AIRevision | null>(null);
  const [editContent, setEditContent] = useState("");

  // 批量操作状态
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchConfirmOpen, setBatchConfirmOpen] = useState(false);
  const [batchConfirmAction, setBatchConfirmAction] = useState<"" | "accept_low_risk" | "reject_selected">("");

  const sectionGroups = useMemo(() => groupBySection(revisions), [revisions]);

  const actionableRevisions = useMemo(
    () => revisions.filter(isActionable),
    [revisions],
  );

  const lowRiskPendingRevisions = useMemo(
    () => revisions.filter((r) => r.risk_level !== "high" && r.status === "pending"),
    [revisions],
  );

  const handleStatusChange = useCallback(
    async (revisionId: string, status: string, aiContent?: string) => {
      setActionLoading(revisionId);
      try {
        await api.patch(`/api/revisions/${revisionId}/status`, {
          status,
          ai_content: aiContent ?? null,
        });
        message.success(
          status === "accepted"
            ? "已接受修订"
            : status === "rejected"
              ? "已拒绝修订"
              : status === "edited_then_accepted"
                ? "已保存编辑"
                : "已标记为待确认",
        );
        onStatusChange();
      } catch {
        message.error("操作失败，请重试");
      } finally {
        setActionLoading(null);
      }
    },
    [onStatusChange],
  );

  const handleEditOpen = useCallback((rev: AIRevision) => {
    setEditingRevision(rev);
    setEditContent(rev.ai_content || "");
    setEditModalOpen(true);
  }, []);

  const handleEditSave = useCallback(() => {
    if (!editingRevision) return;
    handleStatusChange(editingRevision.id, "edited_then_accepted", editContent);
    setEditModalOpen(false);
    setEditingRevision(null);
  }, [editingRevision, editContent, handleStatusChange]);

  // ── 批量选择 ──────────────────────────────────────────────

  const handleSelectAll = useCallback(() => {
    setSelectedIds(new Set(actionableRevisions.map((r) => r.id)));
  }, [actionableRevisions]);

  const handleDeselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleToggleSelect = useCallback((revId: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(revId);
      } else {
        next.delete(revId);
      }
      return next;
    });
  }, []);

  // ── 批量操作触发 ──────────────────────────────────────────

  const handleBatchAcceptLowRisk = useCallback(() => {
    setBatchConfirmAction("accept_low_risk");
    setBatchConfirmOpen(true);
  }, []);

  const handleBatchReject = useCallback(() => {
    if (selectedIds.size === 0) return;
    setBatchConfirmAction("reject_selected");
    setBatchConfirmOpen(true);
  }, [selectedIds]);

  const executeBatchOperation = useCallback(
    async (ids: string[], status: string, label: string) => {
      setBatchLoading(true);
      try {
        const result = await api.post<{
          success_count: number;
          fail_count: number;
          failures: { revision_id: string; error: string }[];
        }>("/api/revisions/batch-status", {
          revision_ids: ids,
          status,
        });
        if (result.fail_count === 0) {
          message.success(`${label}完成：${result.success_count} 条`);
        } else {
          message.warning(
            `${label}完成：${result.success_count} 条成功，${result.fail_count} 条失败`,
          );
        }
        setSelectedIds(new Set());
        onStatusChange();
      } catch {
        message.error(`${label}失败，请重试`);
      } finally {
        setBatchLoading(false);
        setBatchConfirmOpen(false);
      }
    },
    [onStatusChange],
  );

  const handleBatchConfirm = useCallback(() => {
    if (batchConfirmAction === "accept_low_risk") {
      const ids = lowRiskPendingRevisions.map((r) => r.id);
      executeBatchOperation(ids, "accepted", "批量接受");
    } else if (batchConfirmAction === "reject_selected") {
      const ids = Array.from(selectedIds);
      executeBatchOperation(ids, "rejected", "批量拒绝");
    }
  }, [batchConfirmAction, lowRiskPendingRevisions, selectedIds, executeBatchOperation]);

  // ── 子渲染函数 ────────────────────────────────────────────

  const renderCheckbox = (rev: AIRevision) => {
    if (!isActionable(rev)) return null;
    return (
      <Checkbox
        checked={selectedIds.has(rev.id)}
        onChange={(e) => handleToggleSelect(rev.id, e.target.checked)}
      />
    );
  };

  const renderBatchToolbar = () => {
    const allSelected = actionableRevisions.length > 0 && selectedIds.size === actionableRevisions.length;
    const someSelected = selectedIds.size > 0;

    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
          padding: "4px 0 8px 0",
          borderBottom: "1px solid #f0f0f0",
          marginBottom: 4,
        }}
      >
        <Checkbox
          checked={allSelected}
          indeterminate={someSelected && !allSelected}
          onChange={(e) => (e.target.checked ? handleSelectAll() : handleDeselectAll())}
          disabled={actionableRevisions.length === 0}
        >
          <Text style={{ fontSize: 12 }}>
            全选{actionableRevisions.length > 0 ? ` (${selectedIds.size}/${actionableRevisions.length})` : ""}
          </Text>
        </Checkbox>
        <Space size={4} wrap style={{ marginLeft: "auto" }}>
          <Tooltip title="接受所有低风险待处理修订（风险等级≠高 且 状态=待审阅）">
            <Button
              size="small"
              type="primary"
              ghost
              icon={<ThunderboltOutlined />}
              loading={batchLoading}
              disabled={lowRiskPendingRevisions.length === 0}
              onClick={handleBatchAcceptLowRisk}
              style={{ fontSize: 12 }}
            >
              批量接受低风险
            </Button>
          </Tooltip>
          <Tooltip title="拒绝已勾选的修订">
            <Button
              size="small"
              danger
              icon={<CloseOutlined />}
              loading={batchLoading}
              disabled={selectedIds.size === 0}
              onClick={handleBatchReject}
              style={{ fontSize: 12 }}
            >
              批量拒绝
            </Button>
          </Tooltip>
        </Space>
      </div>
    );
  };

  const renderBatchConfirmModal = () => {
    const isAccept = batchConfirmAction === "accept_low_risk";
    const title = isAccept ? "批量接受低风险修订" : "批量拒绝修订";
    const count = isAccept ? lowRiskPendingRevisions.length : selectedIds.size;
    const actionLabel = isAccept ? "接受" : "拒绝";

    return (
      <Modal
        title={title}
        open={batchConfirmOpen}
        onOk={handleBatchConfirm}
        onCancel={() => setBatchConfirmOpen(false)}
        okText={`确认${actionLabel}（${count} 条）`}
        cancelText="取消"
        confirmLoading={batchLoading}
        okButtonProps={{ danger: !isAccept }}
      >
        <div style={{ padding: "12px 0" }}>
          <Paragraph>
            即将{actionLabel} <Text strong>{count}</Text> 条修订：
          </Paragraph>
          {isAccept ? (
            <Paragraph type="secondary" style={{ fontSize: 12 }}>
              仅包含风险等级为&ldquo;低风险&rdquo;或&ldquo;中风险&rdquo;且状态为&ldquo;待审阅&rdquo;的修订。高风险和已确认的修订不会被处理。
            </Paragraph>
          ) : (
            <Paragraph type="secondary" style={{ fontSize: 12 }}>
              仅处理您手动勾选的修订。
            </Paragraph>
          )}
        </div>
      </Modal>
    );
  };

  const renderActionButtons = (rev: AIRevision) => {
    if (!isActionable(rev)) return null;

    return (
      <Space size={2} wrap>
        <Tooltip title="接受">
          <Button
            size="small"
            type="text"
            icon={<CheckOutlined />}
            style={{ color: "#52c41a" }}
            loading={actionLoading === rev.id}
            onClick={() => handleStatusChange(rev.id, "accepted")}
          />
        </Tooltip>
        <Tooltip title="拒绝">
          <Popconfirm
            title="确定拒绝此修订？"
            onConfirm={() => handleStatusChange(rev.id, "rejected")}
            okText="确定"
            cancelText="取消"
          >
            <Button
              size="small"
              type="text"
              icon={<CloseOutlined />}
              style={{ color: "#ff4d4f" }}
              loading={actionLoading === rev.id}
            />
          </Popconfirm>
        </Tooltip>
        <Tooltip title="编辑">
          <Button
            size="small"
            type="text"
            icon={<EditOutlined />}
            style={{ color: "#1677ff" }}
            onClick={() => handleEditOpen(rev)}
          />
        </Tooltip>
        <Tooltip title="标记待确认">
          <Button
            size="small"
            type="text"
            icon={<ExclamationCircleOutlined />}
            style={{ color: "#fa8c16" }}
            loading={actionLoading === rev.id}
            onClick={() => handleStatusChange(rev.id, "need_human_confirm")}
          />
        </Tooltip>
      </Space>
    );
  };

  if (revisions.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: 40 }}>
        <Empty
          description="暂无 AI 修订"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </div>
    );
  }

  return (
    <>
      {/* 批量操作工具栏 */}
      {renderBatchToolbar()}

      <Collapse
        defaultActiveKey={sectionGroups.map((g) => g.sectionPath)}
        size="small"
        ghost
        style={{ background: "transparent" }}
        items={sectionGroups.map((group) => ({
          key: group.sectionPath,
          label: (
            <Space size={4}>
              <Text strong style={{ fontSize: 13 }}>
                {group.sectionPath}
              </Text>
              <Tag style={{ fontSize: 11 }}>{group.revisions.length}</Tag>
            </Space>
          ),
          children: (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {group.revisions.map((rev) => (
                <div
                  key={rev.id}
                  style={{
                    padding: "8px 10px",
                    background: "#fafafa",
                    borderRadius: 6,
                    border: "1px solid #f0f0f0",
                    transition: "background 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "#f0f5ff";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "#fafafa";
                  }}
                >
                  {/* 标签行 */}
                  <div style={{ marginBottom: 6, display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                    {renderCheckbox(rev)}
                    <Tag
                      color={REVISION_TYPE_COLORS[rev.revision_type]}
                      style={{ fontSize: 11, lineHeight: "18px" }}
                    >
                      {REVISION_TYPE_LABELS[rev.revision_type] || rev.revision_type}
                    </Tag>
                    <Tag
                      color={STATUS_COLORS[rev.status]}
                      style={{ fontSize: 11, lineHeight: "18px" }}
                    >
                      {STATUS_LABELS[rev.status] || rev.status}
                    </Tag>
                    <Tag
                      color={RISK_LEVEL_COLORS[rev.risk_level]}
                      style={{ fontSize: 11, lineHeight: "18px" }}
                    >
                      {RISK_LEVEL_LABELS[rev.risk_level] || rev.risk_level}
                    </Tag>
                    <Text type="secondary" style={{ fontSize: 11, marginLeft: "auto" }}>
                      {Math.round(rev.confidence * 100)}%
                    </Text>
                  </div>

                  {/* 内容摘要 */}
                  <Paragraph
                    ellipsis={{ rows: 2 }}
                    style={{ margin: 0, marginBottom: 6, fontSize: 12, color: "#555" }}
                  >
                    {rev.ai_content || rev.before_content || "（无内容）"}
                  </Paragraph>

                  {/* 操作按钮 */}
                  <div style={{ display: "flex", justifyContent: "flex-start" }}>
                    {renderActionButtons(rev)}
                  </div>
                </div>
              ))}
            </div>
          ),
        }))}
      />

      {/* 编辑 Modal */}
      <Modal
        title="编辑 AI 修订内容"
        open={editModalOpen}
        onOk={handleEditSave}
        onCancel={() => {
          setEditModalOpen(false);
          setEditingRevision(null);
        }}
        okText="保存（编辑后接受）"
        cancelText="取消"
        width={640}
        destroyOnClose
      >
        {editingRevision && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                AI 原始内容
              </Text>
              <div
                style={{
                  background: "#f6ffed",
                  border: "1px solid #b7eb8f",
                  borderRadius: 4,
                  padding: 8,
                  marginTop: 4,
                  fontSize: 13,
                  whiteSpace: "pre-wrap",
                  maxHeight: 160,
                  overflow: "auto",
                }}
              >
                {editingRevision.ai_content || "（无内容）"}
              </div>
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                编辑内容
              </Text>
              <TextArea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={6}
                placeholder="在此编辑修订内容..."
                style={{ marginTop: 4 }}
              />
            </div>
          </div>
        )}
      </Modal>

      {/* 批量操作确认弹窗 */}
      {renderBatchConfirmModal()}
    </>
  );
}
