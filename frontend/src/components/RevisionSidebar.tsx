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
} from "antd";
import {
  CheckOutlined,
  CloseOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
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
  // 排序：非"未分类"在前，同组按 section_path 字母序
  return Array.from(map.entries())
    .sort(([a], [b]) => {
      if (a === "未分类") return 1;
      if (b === "未分类") return -1;
      return a.localeCompare(b);
    })
    .map(([sectionPath, revisions]) => ({ sectionPath, revisions }));
}

export default function RevisionSidebar({ revisions, onStatusChange }: Props) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // 编辑 Modal 状态
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingRevision, setEditingRevision] = useState<AIRevision | null>(null);
  const [editContent, setEditContent] = useState("");

  const sectionGroups = useMemo(() => groupBySection(revisions), [revisions]);

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

  const renderActionButtons = (rev: AIRevision) => {
    const isActive = rev.status === "pending" || rev.status === "need_human_confirm";
    if (!isActive) return null;

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
    </>
  );
}
