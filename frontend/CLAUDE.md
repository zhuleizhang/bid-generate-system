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

## 注意事项

- 需要 Node >= 20.9.0，使用 `nvm use v20.19.5` 切换
- .env.example 的例外规则已加到 .gitignore，可直接提交
