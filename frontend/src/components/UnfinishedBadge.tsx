"use client";

import { useEffect, useState } from "react";
import { Badge, Tooltip, Space, Tag } from "antd";
import { WarningOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

interface UnfinishedCounts {
  total: number;
  blocking: number;
  high: number;
  medium: number;
  low: number;
}

const RISK_COLORS: Record<string, string> = {
  blocking: "red",
  high: "orange",
  medium: "gold",
  low: "default",
};

/** 未完成项计数器 — 顶栏常驻 Badge，按风险等级分色。 */
export default function UnfinishedBadge() {
  const [counts, setCounts] = useState<UnfinishedCounts | null>(null);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    const fetchCount = async () => {
      try {
        const data = await api.get<UnfinishedCounts>("/api/unfinished/count");
        if (!cancelled) setCounts(data);
      } catch {
        // 静默失败，不显示错误
      }
    };
    fetchCount();

    // 每 30 秒自动刷新
    const id = setInterval(fetchCount, 30000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (!counts || counts.total === 0) return null;

  const tooltipContent = (
    <Space direction="vertical" size={2}>
      <span>未完成项: {counts.total} 个</span>
      {counts.blocking > 0 && (
        <span>
          <Tag color="red" style={{ marginRight: 4 }}>阻断</Tag>
          {counts.blocking}
        </span>
      )}
      {counts.high > 0 && (
        <span>
          <Tag color="orange" style={{ marginRight: 4 }}>高</Tag>
          {counts.high}
        </span>
      )}
      {counts.medium > 0 && (
        <span>
          <Tag color="gold" style={{ marginRight: 4 }}>中</Tag>
          {counts.medium}
        </span>
      )}
      {counts.low > 0 && (
        <span>
          <Tag style={{ marginRight: 4 }}>低</Tag>
          {counts.low}
        </span>
      )}
    </Space>
  );

  return (
    <Tooltip title={tooltipContent}>
      <Badge count={counts.total} size="small" offset={[4, -2]}
        onClick={() => router.push("/projects")}
        style={{ cursor: "pointer" }}
      >
        <WarningOutlined style={{ fontSize: 16, cursor: "pointer" }} />
      </Badge>
    </Tooltip>
  );
}
