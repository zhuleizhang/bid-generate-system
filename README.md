# 智能标书系统

## 项目结构

```
bid-generate-system/
├── backend/     # Python FastAPI 后端
├── frontend/    # Next.js + React + TypeScript 前端
├── supabase/    # 数据库迁移脚本
├── plan.md      # PRD 产品需求文档
└── README.md    # 本文件
```

## 环境要求

- Python 3.12+
- Node.js 20+
- Supabase 账号（数据库 + Storage）

## 快速安装

### 后端

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env   # 然后编辑 .env 填写 Supabase 和 Model Gateway 配置
```

### 前端

```bash
cd frontend
npm install
cp .env.example .env   # 然后编辑 .env 填写 API 地址和 Supabase 配置
```

## 启动开发服务

### 后端（端口 8000）

```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

### 前端（端口 3000）

```bash
cd frontend
npm run dev
```

## 测试

### 测试策略

**原则：测业务逻辑，不测胶水代码。**

mock 测试覆盖的是"代码对不对"（状态机、JSON 解析、关键词匹配）。Gateway 封装层和 LLM 调用管道不变测试，它们需要真实服务才能验证"系统通不通"。

### 后端

```bash
cd backend
pytest tests/ -v              # 运行所有测试（无需 Supabase）
pytest tests/ --cov=app       # 运行 + 覆盖率报告
```

| 模块 | 覆盖率 | 说明 |
|------|--------|------|
| `api/` | 88% | mock SupabaseGateway 测 API 契约和状态机 |
| `services/` 核心逻辑 | 91% | 纯函数：标题识别、JSON 解析、占位符检测 |
| `services/` LLM 管道 | ~15% | 需要真实 LLM 调用来验证 prompt 质量 |
| `services/` DOCX 解析 | 46% | 纯函数已覆盖，完整解析需要真实 .docx fixture |
| `gateway/` | 27% | Supabase SDK 封装，mock 无意义 |
| **总体** | **41%（133 个测试）** | 框架：pytest + pytest-asyncio |

### 前端

```bash
cd frontend
npm test                       # 运行所有测试
npx vitest run --coverage      # 运行 + 覆盖率报告
```

| 模块 | 覆盖率 | 说明 |
|------|--------|------|
| `lib/types` | 100% | 常量映射完整性验证 |
| `lib/api.ts` | 65% | HTTP 客户端，6 个方法全路径覆盖 |
| `app/` 页面 | ~90% | dashboard、项目列表、项目详情、导出页渲染 |
| `components/` | ~15% | 简单组件可测，含 Ant Design Table 的组件 jsdom 渲染失败 |
| **总体** | **35%（51 个测试）** | 框架：vitest + @testing-library/react |

**jsdom 限制**：Ant Design Table 依赖 `getComputedStyle`（CSS 布局），jsdom 不实现。含 `<Table>` 的页面（任务看板、审查结果详情）无法在 vitest 中渲染。剩余的 65% 代码是 Ant Design 组件样板（Table/Modal/Form/Upload），mock 测试无意义，需要 Playwright 在真实浏览器中测试。

### TypeScript 类型检查

```bash
cd frontend
npx tsc --noEmit
```

### ESLint

```bash
cd frontend
npm run lint
```
