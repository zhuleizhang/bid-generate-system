"use client";

import { useState } from "react";
import { Modal, Radio, Space, Typography, message as antMsg } from "antd";
import type { RadioChangeEvent } from "antd";

const { Text, Paragraph } = Typography;

export type ExperienceScope =
  | "company"
  | "industry"
  | "customer"
  | "review_rule";

const SCOPE_LABELS: Record<ExperienceScope, string> = {
  company: "公司通用",
  industry: "行业通用",
  customer: "仅当前客户",
  review_rule: "加入审查规则",
};

interface Props {
  open: boolean;
  aiContent: string;
  userEditedContent: string;
  onSave: (scope: ExperienceScope) => void;
  onSkip: () => void;
  onClose: () => void;
}

/** 内联经验捕获弹窗 — 用户"修改后接受"时自动弹出，询问是否沉淀经验。 */
export default function ExperienceCaptureModal({
  open,
  aiContent,
  userEditedContent,
  onSave,
  onSkip,
  onClose,
}: Props) {
  const [scope, setScope] = useState<ExperienceScope>("company");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(scope);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="保存为写作经验？"
      open={open}
      onOk={handleSave}
      onCancel={onClose}
      okText="保存为经验"
      cancelText="关 闭"
      confirmLoading={saving}
      footer={(_, { OkBtn, CancelBtn }) => (
        <Space style={{ width: "100%", justifyContent: "flex-end" }}>
          <CancelBtn />
          <OkBtn />
          <button
            type="button"
            className="ant-btn ant-btn-default"
            onClick={() => {
              onSkip();
            }}
          >
            仅本次有效
          </button>
        </Space>
      )}
      width={560}
    >
      <Paragraph type="secondary" style={{ marginBottom: 12 }}>
        你的修改与 AI 原文有显著差异，是否保存为写作经验以便后续复用？
      </Paragraph>

      <div
        style={{
          background: "#fafafa",
          borderRadius: 8,
          padding: 12,
          marginBottom: 16,
          maxHeight: 200,
          overflow: "auto",
        }}
      >
        <div style={{ marginBottom: 8 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            AI 原文：
          </Text>
          <div
            style={{
              padding: 8,
              background: "#fff1f0",
              borderRadius: 4,
              fontSize: 13,
            }}
          >
            {aiContent || "(空)"}
          </div>
        </div>
        <div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            你的修改：
          </Text>
          <div
            style={{
              padding: 8,
              background: "#f6ffed",
              borderRadius: 4,
              fontSize: 13,
            }}
          >
            {userEditedContent || "(空)"}
          </div>
        </div>
      </div>

      <div>
        <Text strong style={{ display: "block", marginBottom: 8 }}>
          适用范围：
        </Text>
        <Radio.Group
          value={scope}
          onChange={(e: RadioChangeEvent) => setScope(e.target.value)}
        >
          <Space direction="vertical">
            {(Object.entries(SCOPE_LABELS) as [ExperienceScope, string][]).map(
              ([key, label]) => (
                <Radio key={key} value={key}>
                  {label}
                </Radio>
              )
            )}
          </Space>
        </Radio.Group>
      </div>
    </Modal>
  );
}
