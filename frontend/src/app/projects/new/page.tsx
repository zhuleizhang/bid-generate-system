"use client";

import { Typography } from "antd";
import ProjectForm from "@/components/ProjectForm";

export default function NewProjectPage() {
  return (
    <div>
      <Typography.Title level={4} style={{ marginBottom: 24 }}>
        新建项目
      </Typography.Title>
      <ProjectForm />
    </div>
  );
}
