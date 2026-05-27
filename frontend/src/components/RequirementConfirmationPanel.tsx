"use client";

import { useState } from "react";
import { Card, List, Tag, Space, Button, Collapse, Typography, Switch, message } from "antd";
import type { RequirementDBItem } from "@/lib/types/requirement";
import {
  REQUIREMENT_TYPE_LABELS,
  REQUIREMENT_TYPE_ORDER,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
  RISK_LEVEL_LABELS,
  RISK_LEVEL_COLORS,
} from "@/lib/types/requirement";

const { Text, Paragraph } = Typography;

interface Props {
  requirements: RequirementDBItem[];
  onConfirmed: () => void;
}

/** 招标要求确认面板 — 展示要求列表，用户逐条检查后点击确认。 */
export default function RequirementConfirmationPanel({
  requirements,
  onConfirmed,
}: Props) {
  const [confirmed, setConfirmed] = useState(false);

  const grouped: Record<string, RequirementDBItem[]> = {};
  for (const r of requirements) {
    if (!grouped[r.requirement_type]) grouped[r.requirement_type] = [];
    grouped[r.requirement_type].push(r);
  }

  return (
    <Card
      title="招标要求确认"
      extra={
        <Space>
          <Text type={confirmed ? "success" : "secondary"}>
            {confirmed ? "已确认" : "待确认"}
          </Text>
          <Button
            type="primary"
            disabled={confirmed}
            onClick={() => {
              setConfirmed(true);
              onConfirmed();
            }}
          >
            确认招标要求
          </Button>
        </Space>
      }
    >
      {requirements.length === 0 ? (
        <Text type="secondary">暂无招标要求，请先在文件管理中上传招标文件并解析</Text>
      ) : (
        <Collapse
          defaultActiveKey={REQUIREMENT_TYPE_ORDER.filter(
            (t) => grouped[t]?.length > 0
          )}
          items={REQUIREMENT_TYPE_ORDER.filter(
            (type) => grouped[type]?.length > 0
          ).map((type) => ({
            key: type,
            label: (
              <Space>
                <span>{REQUIREMENT_TYPE_LABELS[type] || type}</span>
                <Tag>{grouped[type].length} 条</Tag>
              </Space>
            ),
            children: (
              <List
                size="small"
                dataSource={grouped[type]}
                renderItem={(item) => (
                  <List.Item>
                    <List.Item.Meta
                      title={
                        <Space wrap>
                          <Text strong>{item.title}</Text>
                          <Tag color={PRIORITY_COLORS[item.priority]}>
                            {PRIORITY_LABELS[item.priority]}
                          </Tag>
                          {item.is_mandatory && <Tag color="red">强制</Tag>}
                          <Tag color={RISK_LEVEL_COLORS[item.risk_level]}>
                            {RISK_LEVEL_LABELS[item.risk_level]}风险
                          </Tag>
                        </Space>
                      }
                      description={
                        item.description ? (
                          <Paragraph ellipsis={{ rows: 2 }} style={{ marginBottom: 0 }}>
                            {item.description}
                          </Paragraph>
                        ) : undefined
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
}
