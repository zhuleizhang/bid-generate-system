"use client";

import { useState, useMemo, useCallback } from "react";
import { Tree, Input, Button, Space, Empty, Spin } from "antd";
import {
  SearchOutlined,
  ExpandAltOutlined,
  ShrinkOutlined,
} from "@ant-design/icons";
import type { DataNode, EventDataNode } from "antd/es/tree";

export interface SectionItem {
  id: string;
  section_id: string;
  title: string;
  level: number;
  section_path: string;
  parent_section_id: string | null;
}

interface Props {
  sections: SectionItem[];
  onSelect: (sectionId: string) => void;
  selectedSectionId: string | null;
  loading?: boolean;
}

function buildSectionTree(sections: SectionItem[]): DataNode[] {
  const map = new Map<string, DataNode>();
  const roots: DataNode[] = [];

  for (const s of sections) {
    map.set(s.section_id, {
      key: s.section_id,
      title: s.title,
      children: [],
    });
  }

  for (const s of sections) {
    const node = map.get(s.section_id)!;
    if (s.parent_section_id && map.has(s.parent_section_id)) {
      map.get(s.parent_section_id)!.children!.push(node);
    } else {
      roots.push(node);
    }
  }

  const cleanChildren = (nodes: DataNode[]) => {
    for (const node of nodes) {
      if (node.children && node.children.length === 0) {
        delete node.children;
      } else if (node.children) {
        cleanChildren(node.children);
      }
    }
  };
  cleanChildren(roots);

  return roots;
}

/** 递归过滤树节点：保留标题匹配的节点及其所有祖先路径 */
function filterTree(
  nodes: DataNode[],
  keyword: string,
): DataNode[] {
  const lower = keyword.toLowerCase();

  const filter = (list: DataNode[]): DataNode[] => {
    return list.reduce<DataNode[]>((acc, node) => {
      const titleStr = String(
        typeof node.title === "string" ? node.title : node.key,
      );
      const selfMatch = titleStr.toLowerCase().includes(lower);

      let filteredChildren: DataNode[] = [];
      if (node.children) {
        filteredChildren = filter(node.children);
      }

      if (selfMatch || filteredChildren.length > 0) {
        acc.push({
          ...node,
          children:
            filteredChildren.length > 0
              ? filteredChildren
              : node.children,
        });
      }
      return acc;
    }, []);
  };

  return filter(nodes);
}

/** 递归收集所有节点的 key */
function collectAllKeys(nodes: DataNode[]): React.Key[] {
  const keys: React.Key[] = [];
  const walk = (list: DataNode[]) => {
    for (const node of list) {
      keys.push(node.key);
      if (node.children) walk(node.children);
    }
  };
  walk(nodes);
  return keys;
}

export default function ChapterTree({
  sections,
  onSelect,
  selectedSectionId,
  loading = false,
}: Props) {
  const [searchText, setSearchText] = useState("");
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);

  const treeData = useMemo(
    () => (sections.length > 0 ? buildSectionTree(sections) : []),
    [sections],
  );

  const displayTree = useMemo(() => {
    if (!searchText.trim()) return treeData;
    return filterTree(treeData, searchText.trim());
  }, [treeData, searchText]);

  const allKeys = useMemo(() => collectAllKeys(treeData), [treeData]);

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchText(value);
      if (!value.trim()) return;
      // 搜索时自动展开所有匹配路径上的节点
      const filtered = filterTree(treeData, value.trim());
      const filteredKeys = new Set(collectAllKeys(filtered));
      const toExpand: React.Key[] = [];
      const walk = (list: DataNode[]) => {
        for (const node of list) {
          if (filteredKeys.has(node.key)) {
            if (node.children && node.children.length > 0) {
              toExpand.push(node.key);
            }
            if (node.children) walk(node.children);
          }
        }
      };
      walk(treeData);
      if (toExpand.length > 0) {
        setExpandedKeys(toExpand);
      }
    },
    [treeData],
  );

  const handleExpandAll = useCallback(() => {
    setExpandedKeys(allKeys);
  }, [allKeys]);

  const handleCollapseAll = useCallback(() => {
    setExpandedKeys([]);
  }, []);

  const handleSelect = useCallback(
    (_selectedKeys: React.Key[], info: { node: EventDataNode<DataNode> }) => {
      const sectionId = String(info.node.key);
      onSelect(sectionId);
    },
    [onSelect],
  );

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 40 }}>
        <Spin />
      </div>
    );
  }

  if (treeData.length === 0) {
    return (
      <Empty
        description="暂无章节数据"
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ marginBottom: 8 }}>
        <Input
          placeholder="搜索章节标题..."
          prefix={<SearchOutlined />}
          allowClear
          size="small"
          value={searchText}
          onChange={(e) => handleSearchChange(e.target.value)}
        />
      </div>

      <Space
        size={4}
        style={{ marginBottom: 8, justifyContent: "flex-end", width: "100%" }}
      >
        <Button
          size="small"
          type="text"
          icon={<ExpandAltOutlined />}
          onClick={handleExpandAll}
          title="全部展开"
        />
        <Button
          size="small"
          type="text"
          icon={<ShrinkOutlined />}
          onClick={handleCollapseAll}
          title="全部折叠"
        />
      </Space>

      <div style={{ flex: 1, overflow: "auto" }}>
        <Tree
          treeData={displayTree}
          expandedKeys={expandedKeys}
          onExpand={(keys) => setExpandedKeys(keys)}
          selectedKeys={
            selectedSectionId ? [selectedSectionId] : []
          }
          onSelect={handleSelect}
          showLine={{ showLeafIcon: false }}
          style={{ maxHeight: "100%" }}
        />
      </div>
    </div>
  );
}
