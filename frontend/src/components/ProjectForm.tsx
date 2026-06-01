"use client";

import { useEffect, useState } from "react";
import { Button, DatePicker, Form, Input, Select, Space, message } from "antd";
import { useRouter } from "next/navigation";
import dayjs from "dayjs";
import { api } from "@/lib/api";
import type { Project, ProjectCreate, ProjectUpdate } from "@/lib/types/project";

const INDUSTRY_OPTIONS = [
  "建筑",
  "IT",
  "制造",
  "医疗",
  "教育",
  "其他",
];

const PROJECT_TYPE_OPTIONS = ["工程类", "货物类", "服务类"];

interface Props {
  project?: Project;
}

export default function ProjectForm({ project }: Props) {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const isEdit = !!project;

  useEffect(() => {
    if (project) {
      form.setFieldsValue({
        name: project.name,
        tender_org: project.tender_org,
        industry: project.industry,
        project_type: project.project_type,
        deadline: project.deadline ? dayjs(project.deadline) : null,
      });
    }
  }, [project, form]);

  const handleSubmit = async (values: Record<string, unknown>) => {
    setSubmitting(true);
    try {
      const body: ProjectCreate | ProjectUpdate = {
        name: values.name as string,
        tender_org: (values.tender_org as string) || undefined,
        industry: (values.industry as string) || undefined,
        project_type: (values.project_type as string) || undefined,
        deadline: values.deadline
          ? (values.deadline as dayjs.Dayjs).format("YYYY-MM-DD")
          : undefined,
      };

      if (isEdit) {
        await api.put(`/api/projects/${project!.id}`, body);
        message.success("项目更新成功");
      } else {
        const newProject = await api.post<Project>("/api/projects", body);
        message.success("项目创建成功");
        router.push(`/projects/${newProject.id}`);
        return;
      }
      router.push("/projects");
    } catch {
      message.error(isEdit ? "更新项目失败" : "创建项目失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Form
      form={form}
      layout="vertical"
      style={{ maxWidth: 520 }}
      onFinish={handleSubmit}
      initialValues={{
        name: "",
        tender_org: "",
        industry: undefined,
        project_type: undefined,
        deadline: null,
      }}
    >
      <Form.Item
        name="name"
        label="项目名称"
        rules={[{ required: true, message: "请输入项目名称" }]}
      >
        <Input placeholder="请输入项目名称" />
      </Form.Item>

      <Form.Item name="tender_org" label="招标单位">
        <Input placeholder="请输入招标单位" />
      </Form.Item>

      <Form.Item name="industry" label="行业">
        <Select
          allowClear
          placeholder="请选择行业"
          options={INDUSTRY_OPTIONS.map((v) => ({ label: v, value: v }))}
        />
      </Form.Item>

      <Form.Item name="project_type" label="项目类型">
        <Select
          allowClear
          placeholder="请选择项目类型"
          options={PROJECT_TYPE_OPTIONS.map((v) => ({ label: v, value: v }))}
        />
      </Form.Item>

      <Form.Item name="deadline" label="截止时间">
        <DatePicker style={{ width: "100%" }} placeholder="请选择截止时间" />
      </Form.Item>

      <Form.Item>
        <Space>
          <Button type="primary" htmlType="submit" loading={submitting}>
            {isEdit ? "保存" : "创建"}
          </Button>
          <Button onClick={() => router.push("/projects")}>取消</Button>
        </Space>
      </Form.Item>
    </Form>
  );
}
