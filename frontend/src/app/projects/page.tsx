"use client";

import { useEffect, useState } from "react";
import { Button, Input, Select, Space, Table, Tag, message } from "antd";
import { PlusOutlined, EditOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";
import type { ColumnsType } from "antd/es/table";
import { api } from "@/lib/api";
import type { Project, ProjectListResponse } from "@/lib/types/project";

const STATUS_LABELS: Record<string, string> = {
  draft: "草稿",
  pending_confirmation: "待确认",
  in_review: "审阅中",
  review_completed: "审阅完成",
  exported: "已导出",
  completed: "已完成",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "default",
  pending_confirmation: "processing",
  in_review: "processing",
  review_completed: "success",
  exported: "success",
  completed: "success",
};

/** PRD 状态 → 页面路由映射 */
const STATUS_ROUTE: Record<string, string> = {
  draft: "edit",
  pending_confirmation: "workbench",
  in_review: "preview",
  review_completed: "review",
  exported: "export",
  completed: "export",
};

/** 按状态估算进度百分比 */
function progressPercent(status: string): number {
  const idx = ["draft", "pending_confirmation", "in_review", "review_completed", "exported", "completed"].indexOf(status);
  return idx >= 0 ? Math.round((idx / 5) * 100) : 0;
}

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    const fetchProjects = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("page_size", String(pageSize));
        if (statusFilter) params.set("status", statusFilter);
        if (search.trim()) params.set("search", search.trim());

        const data = await api.get<ProjectListResponse>(
          `/api/projects?${params.toString()}`
        );
        if (!cancelled) {
          setProjects(data.items);
          setTotal(data.total);
        }
      } catch {
        if (!cancelled) message.error("加载项目列表失败");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchProjects();
    return () => {
      cancelled = true;
    };
  }, [page, pageSize, statusFilter, search]);

  const columns: ColumnsType<Project> = [
    {
      title: "项目名称",
      dataIndex: "name",
      key: "name",
      ellipsis: true,
      render: (name: string, r) => (
        <a onClick={() => {
          const sub = STATUS_ROUTE[r.status] || "edit";
          router.push(`/projects/${r.id}/${sub}`);
        }}>{name}</a>
      ),
    },
    {
      title: "招标单位",
      dataIndex: "tender_org",
      key: "tender_org",
      ellipsis: true,
      render: (v) => v || "-",
    },
    {
      title: "截止时间",
      dataIndex: "deadline",
      key: "deadline",
      width: 120,
      render: (v) => (v ? new Date(v).toLocaleDateString("zh-CN") : "-"),
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 100,
      render: (s) => <Tag color={STATUS_COLORS[s]}>{STATUS_LABELS[s] || s}</Tag>,
    },
    {
      title: "进度",
      key: "progress",
      width: 80,
      render: (_, r) => `${progressPercent(r.status)}%`,
    },
    {
      title: "操作",
      key: "actions",
      width: 80,
      render: (_, r) => (
        <Button
          type="link"
          size="small"
          icon={<EditOutlined />}
          onClick={() => router.push(`/projects/${r.id}/edit`)}
        >
          编辑
        </Button>
      ),
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16, width: "100%", justifyContent: "space-between" }}>
        <Space>
          <Select
            allowClear
            placeholder="状态筛选"
            style={{ width: 130 }}
            value={statusFilter}
            onChange={(v) => {
              setStatusFilter(v);
              setPage(1);
            }}
            options={[
              { label: "全部", value: undefined },
              { label: "进行中", value: "in_progress" },
              { label: "已完成", value: "completed" },
              { label: "已归档", value: "archived" },
            ]}
          />
          <Input.Search
            placeholder="搜索项目名称"
            style={{ width: 240 }}
            allowClear
            onSearch={(v) => {
              setSearch(v);
              setPage(1);
            }}
          />
        </Space>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => router.push("/projects/new")}
        >
          新建项目
        </Button>
      </Space>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={projects}
        loading={loading}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showTotal: (t) => `共 ${t} 个项目`,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          },
        }}
      />
    </div>
  );
}
