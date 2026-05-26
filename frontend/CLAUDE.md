# 智能标书系统 — 前端

## 技术栈

- Next.js 16 (App Router) + TypeScript strict 模式
- Ant Design 5 + @ant-design/pro-components
- @ant-design/nextjs-registry（App Router 适配）
- Tailwind CSS 4（由 create-next-app 默认安装，可按需使用）

## 项目约定

- 所有使用 Ant Design 或浏览器 API 的组件需标记 `'use client'`
- 服务端组件默认为 Server Components，无需声明
- API 调用通过 `@/lib/api.ts` 的 `api` 对象，所有后端地址通过 `NEXT_PUBLIC_API_URL` 环境变量配置
- Supabase 客户端通过 `@/lib/supabase.ts` 的单例 `supabase` 导出

## 目录结构

```
src/
  app/          # Next.js App Router 页面和布局
  components/   # 可复用组件
  lib/          # 工具函数和配置（api.ts, supabase.ts）
```

## 质量检查

- TypeScript: `npx tsc --noEmit`
- Lint: `npx eslint`

## 路由约定

- 列表页：`/prefix` → `src/app/prefix/page.tsx`（如 `/projects` → `src/app/projects/page.tsx`）
- 新建页：`/prefix/new` → `src/app/prefix/new/page.tsx`
- 编辑页：`/prefix/[id]/edit` → `src/app/prefix/[id]/edit/page.tsx`，路由参数通过 `useParams<{ id: string }>()` 获取
- CRUD 表单编辑/新建共用 `ProjectForm` 组件，通过 `project` prop 区分模式（有值为编辑，无值为新建）

## 类型定义

- 共享 TypeScript 类型放在 `src/lib/types/` 目录（如 `project.ts`）
- 后端 API 响应类型与 Pydantic model 字段一一对应（camelCase ↔ snake_case 通过 JSON key 自动映射）

## 注意事项

- 需要 Node >= 20.9.0，使用 `nvm use v20.19.5` 切换
- .env.example 的例外规则已加到 .gitignore，可直接提交
- dayjs 作为 antd 传递依赖已可用，可直接 `import dayjs from "dayjs"`，无需添加到 package.json
