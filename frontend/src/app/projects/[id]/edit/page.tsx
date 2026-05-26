"use client";

import { useEffect, useState } from "react";
import { Spin, Typography, message } from "antd";
import { useParams } from "next/navigation";
import ProjectForm from "@/components/ProjectForm";
import { api } from "@/lib/api";
import type { Project } from "@/lib/types/project";

export default function EditProjectPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api
      .get<Project>(`/api/projects/${id}`)
      .then((data) => {
        if (!cancelled) setProject(data);
      })
      .catch(() => {
        if (!cancelled) message.error("加载项目信息失败");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!project) {
    return (
      <Typography.Text type="secondary">项目不存在或已被删除</Typography.Text>
    );
  }

  return (
    <div>
      <Typography.Title level={4} style={{ marginBottom: 24 }}>
        编辑项目
      </Typography.Title>
      <ProjectForm project={project} />
    </div>
  );
}
