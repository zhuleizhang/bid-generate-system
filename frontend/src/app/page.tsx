"use client";

import { useEffect, useState } from "react";
import { Card, Row, Col, Statistic } from "antd";
import {
  ProjectOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
} from "@ant-design/icons";
import { api } from "@/lib/api";
import type { ProjectListResponse } from "@/lib/types/project";

export default function Home() {
  const [activeProjects, setActiveProjects] = useState(0);
  const [pendingTasks, setPendingTasks] = useState(0);
  const [completedBids, setCompletedBids] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      try {
        const active = await api.get<ProjectListResponse>(
          "/api/projects?status=in_review&page_size=1"
        );
        if (!cancelled) setActiveProjects(active.total);
      } catch { /* 静默 */ }

      try {
        const completed = await api.get<ProjectListResponse>(
          "/api/projects?status=completed&page_size=1"
        );
        if (!cancelled) setCompletedBids(completed.total);
      } catch { /* 静默 */ }

      try {
        const unfinished = await api.get<{ total: number }>("/api/unfinished/count");
        if (!cancelled) setPendingTasks(unfinished.total);
      } catch { /* 静默 */ }
    };

    fetchData();
    return () => { cancelled = true; };
  }, []);

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>工作台</h2>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="审阅中项目"
              value={activeProjects}
              prefix={<ProjectOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="待处理任务"
              value={pendingTasks}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="已完成标书"
              value={completedBids}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="知识库文档"
              value={0}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
