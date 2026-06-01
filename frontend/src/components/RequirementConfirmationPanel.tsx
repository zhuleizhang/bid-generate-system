"use client";

import { useState } from "react";
import {
  Card,
  List,
  Tag,
  Space,
  Button,
  Collapse,
  Typography,
  message,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  Popconfirm,
} from "antd";
import {
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import type { RequirementDBItem, RequirementCreate, RequirementUpdate } from "@/lib/types/requirement";
import {
  REQUIREMENT_TYPE_LABELS,
  REQUIREMENT_TYPE_ORDER,
  REQUIREMENT_TYPE_OPTIONS,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
  RISK_LEVEL_LABELS,
  RISK_LEVEL_COLORS,
} from "@/lib/types/requirement";
import { api } from "@/lib/api";

const { Text, Paragraph } = Typography;

interface Props {
  requirements: RequirementDBItem[];
  projectId: string;
  onConfirmed: () => void;
  onRequirementsChanged: () => void;
}

/** 招标要求确认面板 — 展示、编辑、添加、删除招标要求。 */
export default function RequirementConfirmationPanel({
  requirements,
  projectId,
  onConfirmed,
  onRequirementsChanged,
}: Props) {
  const [confirmed, setConfirmed] = useState(false);

  // 编辑 Modal
  const [editOpen, setEditOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<RequirementDBItem | null>(null);
  const [editForm] = Form.useForm();

  // 添加 Modal
  const [addOpen, setAddOpen] = useState(false);
  const [addForm] = Form.useForm();

  const grouped: Record<string, RequirementDBItem[]> = {};
  for (const r of requirements) {
    if (!grouped[r.requirement_type]) grouped[r.requirement_type] = [];
    grouped[r.requirement_type].push(r);
  }

  // 判断是否是废标项
  const isDisqualification = (r: RequirementDBItem): boolean =>
    r.requirement_type === "disqualification" || r.risk_level === "blocking";

  // 打开编辑弹窗
  const handleEditOpen = (item: RequirementDBItem) => {
    setEditingItem(item);
    editForm.setFieldsValue({
      requirement_type: item.requirement_type,
      title: item.title,
      description: item.description || "",
      source_text: item.source_text || "",
      priority: item.priority,
      risk_level: item.risk_level,
      is_mandatory: item.is_mandatory,
    });
    setEditOpen(true);
  };

  // 保存编辑
  const handleEditSave = async () => {
    try {
      const values: RequirementUpdate = await editForm.validateFields();
      if (!editingItem) return;
      await api.put(
        `/api/projects/${projectId}/requirements/${editingItem.id}`,
        values,
      );
      message.success("更新成功");
      setEditOpen(false);
      setEditingItem(null);
      onRequirementsChanged();
    } catch (err) {
      if (err && typeof err === "object" && "errorFields" in err) return;
      message.error("更新失败");
    }
  };

  // 删除
  const handleDelete = async (reqId: string) => {
    try {
      await api.patch(
        `/api/projects/${projectId}/requirements/${reqId}/status?status=ignored`,
      );
      message.success("已删除");
      onRequirementsChanged();
    } catch {
      message.error("删除失败");
    }
  };

  // 添加
  const handleAddSave = async () => {
    try {
      const values: RequirementCreate = await addForm.validateFields();
      await api.post(`/api/projects/${projectId}/requirements`, values);
      message.success("添加成功");
      setAddOpen(false);
      addForm.resetFields();
      onRequirementsChanged();
    } catch (err) {
      if (err && typeof err === "object" && "errorFields" in err) return;
      message.error("添加失败");
    }
  };

  return (
    <>
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
        <div style={{ marginBottom: 12 }}>
          <Button
            type="dashed"
            size="small"
            icon={<PlusOutlined />}
            onClick={() => {
              addForm.resetFields();
              setAddOpen(true);
            }}
          >
            手动添加要求
          </Button>
        </div>

        {requirements.length === 0 ? (
          <Text type="secondary">
            暂无招标要求，请先在文件管理中上传招标文件并解析，或手动添加
          </Text>
        ) : (
          <Collapse
            defaultActiveKey={REQUIREMENT_TYPE_ORDER.filter(
              (t) => grouped[t]?.length > 0,
            )}
            items={REQUIREMENT_TYPE_ORDER.filter(
              (type) => grouped[type]?.length > 0,
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
                    <List.Item
                      style={
                        isDisqualification(item)
                          ? { background: "#fff1f0", borderLeft: "3px solid #ff4d4f", paddingLeft: 8 }
                          : {}
                      }
                      actions={[
                        <Button
                          key="edit"
                          type="link"
                          size="small"
                          icon={<EditOutlined />}
                          onClick={() => handleEditOpen(item)}
                        />,
                        <Popconfirm
                          key="delete"
                          title="确认删除该要求？"
                          description="删除后可在重新解析时恢复"
                          onConfirm={() => handleDelete(item.id)}
                          okText="确认"
                          cancelText="取消"
                        >
                          <Button
                            type="link"
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                          />
                        </Popconfirm>,
                      ]}
                    >
                      <List.Item.Meta
                        title={
                          <Space wrap size={4}>
                            <Text strong>{item.title}</Text>
                            <Tag color={PRIORITY_COLORS[item.priority]}>
                              {PRIORITY_LABELS[item.priority]}
                            </Tag>
                            {item.is_mandatory && (
                              <Tag color="red">强制</Tag>
                            )}
                            {isDisqualification(item) && (
                              <Tag color="#ff0000">废标项</Tag>
                            )}
                            <Tag color={RISK_LEVEL_COLORS[item.risk_level]}>
                              {RISK_LEVEL_LABELS[item.risk_level]}风险
                            </Tag>
                          </Space>
                        }
                        description={
                          item.description ? (
                            <Paragraph
                              ellipsis={{ rows: 2 }}
                              style={{ marginBottom: 0 }}
                            >
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

      {/* 编辑 Modal */}
      <Modal
        title="编辑招标要求"
        open={editOpen}
        onOk={handleEditSave}
        onCancel={() => {
          setEditOpen(false);
          setEditingItem(null);
        }}
        okText="保存"
        cancelText="取消"
        width={640}
        destroyOnHidden
      >
        <Form form={editForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="requirement_type" label="类型">
            <Select options={REQUIREMENT_TYPE_OPTIONS} />
          </Form.Item>
          <Form.Item
            name="title"
            label="标题"
            rules={[{ required: true, message: "请输入标题" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="source_text" label="原文摘录">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Space size="large">
            <Form.Item
              name="priority"
              label="优先级"
              style={{ marginBottom: 0 }}
            >
              <Select
                style={{ width: 100 }}
                options={[
                  { value: "high", label: "高" },
                  { value: "medium", label: "中" },
                  { value: "low", label: "低" },
                ]}
              />
            </Form.Item>
            <Form.Item
              name="risk_level"
              label="风险等级"
              style={{ marginBottom: 0 }}
            >
              <Select
                style={{ width: 100 }}
                options={[
                  { value: "blocking", label: "废标" },
                  { value: "high", label: "高" },
                  { value: "medium", label: "中" },
                  { value: "low", label: "低" },
                ]}
              />
            </Form.Item>
            <Form.Item
              name="is_mandatory"
              label="是否强制"
              valuePropName="checked"
              style={{ marginBottom: 0 }}
            >
              <Switch />
            </Form.Item>
          </Space>
        </Form>
      </Modal>

      {/* 添加 Modal */}
      <Modal
        title="手动添加招标要求"
        open={addOpen}
        onOk={handleAddSave}
        onCancel={() => setAddOpen(false)}
        okText="添加"
        cancelText="取消"
        width={640}
        destroyOnHidden
      >
        <Form
          form={addForm}
          layout="vertical"
          style={{ marginTop: 16 }}
          initialValues={{
            requirement_type: "business_requirement",
            priority: "medium",
            risk_level: "medium",
            is_mandatory: false,
          }}
        >
          <Form.Item
            name="requirement_type"
            label="类型"
            rules={[{ required: true, message: "请选择类型" }]}
          >
            <Select options={REQUIREMENT_TYPE_OPTIONS} />
          </Form.Item>
          <Form.Item
            name="title"
            label="标题"
            rules={[{ required: true, message: "请输入标题" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="source_text" label="原文摘录">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Space size="large">
            <Form.Item
              name="priority"
              label="优先级"
              style={{ marginBottom: 0 }}
            >
              <Select
                style={{ width: 100 }}
                options={[
                  { value: "high", label: "高" },
                  { value: "medium", label: "中" },
                  { value: "low", label: "低" },
                ]}
              />
            </Form.Item>
            <Form.Item
              name="risk_level"
              label="风险等级"
              style={{ marginBottom: 0 }}
            >
              <Select
                style={{ width: 100 }}
                options={[
                  { value: "blocking", label: "废标" },
                  { value: "high", label: "高" },
                  { value: "medium", label: "中" },
                  { value: "low", label: "低" },
                ]}
              />
            </Form.Item>
            <Form.Item
              name="is_mandatory"
              label="是否强制"
              valuePropName="checked"
              style={{ marginBottom: 0 }}
            >
              <Switch />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </>
  );
}
