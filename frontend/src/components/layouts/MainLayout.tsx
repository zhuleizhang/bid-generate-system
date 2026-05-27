"use client";

import { useState } from "react";
import { Layout, Menu, theme } from "antd";
import {
  ProjectOutlined,
  FolderOpenOutlined,
  FileTextOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { useRouter, usePathname } from "next/navigation";
import UnfinishedBadge from "@/components/UnfinishedBadge";

const { Header, Sider, Content } = Layout;

const menuItems = [
  {
    key: "/projects",
    icon: <ProjectOutlined />,
    label: "投标项目",
  },
  {
    key: "/knowledge",
    icon: <FolderOpenOutlined />,
    label: "知识库",
  },
  {
    key: "/experiences",
    icon: <FileTextOutlined />,
    label: "经验管理",
  },
  {
    key: "/settings",
    icon: <SettingOutlined />,
    label: "系统设置",
  },
];

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const selectedKey = "/" + (pathname.split("/")[1] || "");

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        theme="dark"
      >
        <div
          style={{
            height: 64,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontSize: collapsed ? 16 : 18,
            fontWeight: 700,
            overflow: "hidden",
            whiteSpace: "nowrap",
          }}
        >
          {collapsed ? "标书" : "智能标书系统"}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => router.push(key)}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            padding: "0 24px",
            background: colorBgContainer,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid #f0f0f0",
          }}
        >
          <span style={{ fontSize: 16, fontWeight: 500 }}>智能标书系统</span>
          <UnfinishedBadge />
        </Header>
        <Content
          style={{
            margin: 24,
            padding: 24,
            background: colorBgContainer,
            borderRadius: borderRadiusLG,
            minHeight: 280,
          }}
        >
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}
