# 智能标书专员系统 PRD 与技术方案

## 1. 项目背景

企业在制作投标文件时，通常需要基于招标文件、公司资料、历史标书、资质文件、产品方案和投标模板进行大量人工整理、撰写、检查和修改。

传统人工标书流程存在以下问题：

- 招标要求多，容易漏项。
- 技术标、商务标、资质材料分散，人工匹配成本高。
- 标书内容重复度高，但每次仍需大量手工调整。
- 人工修改经验难以沉淀，新人无法复用老标书专员经验。
- AI 直接生成整本标书容易出现幻觉、漏项、格式不可控等问题。
- 历史中标案例、优秀章节和人工审改经验没有形成可复用资产。

因此，本项目目标是建设一个“像标书专员一样自动拆任务、检查、修改，并能从人工修改中持续学习”的智能标书生产系统。

---

# 第一部分：PRD

## 2. 产品定位

本系统定位为：

**面向企业投标场景的智能标书专员系统。**

它不是简单的 AI 写作工具，而是一个围绕招标文件解析、任务拆解、资料匹配、章节生成、合规检查、人工审改和经验沉淀的智能工作流系统。

系统应具备以下能力：

- 能理解招标文件。
- 能拆解标书制作任务。
- 能从公司知识库中匹配合适资料。
- 能自动理解用户上传的任意 Word 投标模板，而不是只支持占位符模板。
- 能识别 Word 模板中的章节、段落、表格、合并单元格、编号、样式、页眉页脚、目录和可填充位置。
- 能在正确章节、正确表格、正确单元格或正确段落位置生成 AIRevision。
- 能在前端以章节树、HTML 预览、高亮、差异对比和侧边栏方式展示 AI 编辑内容。
- 能支持用户逐条接受、拒绝、修改后接受或标记待确认。
- 能检查漏项、风险项和废标风险。
- 能记录无法自动填充、无法确认、缺少资料或能力不足的部分，并在前端明确展示给用户。
- 能记录人工修改 diff。
- 能从人工修改中提炼经验。
- 能在后续相似项目中复用历史经验。
- 能在低成本约束下运行，除 LLM 调用外不依赖必须付费的核心组件。

---

## 3. 核心目标

### 3.1 短期目标

建设一个可用的低成本半自动标书助手，实现：

- 上传招标文件。
- 上传公司资料。
- 上传任意 Word 投标模板。
- 基于开源 DOCX 解析能力自动识别模板结构、章节、段落、表格、样式、编号和可填充位置。
- 自动提取招标要求。
- 自动生成标书任务清单。
- 自动在投标模板中生成 AIRevision，而不是直接写入最终稿。
- 自动检查招标响应情况。
- 支持前端预览 AI 编辑内容，包括章节树、HTML 预览、高亮、差异对比、待确认标记和未完成项。
- 支持用户接受、拒绝或二次修改 AI 编辑内容。
- 保存人工修改记录。
- 记录未完成、未填充、待人工确认和无法处理的内容。

### 3.2 中期目标

建设一个可持续学习的标书工作流系统，实现：

- 保存 AI 原文与人工改文的 diff。
- 对人工修改进行自动分类和归因。
- 将高质量修改沉淀为经验库。
- 生成新标书时检索相似历史修改经验。
- 支持基于历史经验自动优化初稿。

### 3.3 长期目标

建设一个多智能体协同的智能标书专员系统，实现：

- 商务标智能体。
- 技术标智能体。
- 资质材料智能体。
- 合规审查智能体。
- 格式审查智能体。
- 总控调度智能体。
- 基于中标结果和人工反馈持续优化生成策略。

---

## 4. 目标用户

### 4.1 主要用户

- 标书专员
- 售前工程师
- 商务人员
- 项目经理
- 招投标负责人

### 4.2 次要用户

- 公司管理层
- 法务人员
- 技术负责人
- 行业方案专家
- 交付负责人

---

## 5. 核心业务流程

### 5.1 人工传统流程

1. 获取招标文件。
2. 阅读招标公告、招标要求、评分标准和废标项。
3. 整理投标模板。
4. 收集公司资料、资质、案例、人员、产品方案。
5. 编写技术标、商务标、服务方案等章节。
6. 人工检查是否响应所有要求。
7. 多轮修改。
8. 生成最终 Word/PDF 投标文件。
9. 项目结束后，人工复盘或不复盘。

### 5.2 系统目标流程

1. 用户上传招标文件、公司资料和任意 Word 投标模板。
2. 系统解析招标要求、评分标准、废标项、格式要求。
3. 系统解包 DOCX 并构建模板结构树。
4. 系统识别章节、段落、表格、样式、编号、页眉页脚和可填充位置。
5. 系统生成 TemplateSlot，并为每个位置计算置信度和证据。
6. 系统自动拆解标书制作任务，并匹配招标要求、公司资料和模板位置。
7. 系统生成 AIRevision 和 UnfinishedItem，不直接覆盖最终稿。
8. 前端展示章节树、HTML 预览、AI 修订列表、风险说明和未完成项。
9. 用户逐条接受、拒绝、修改后接受或标记待确认。
10. 系统根据采纳结果合成 Word 初稿。
11. 审查模块检查漏项、风险、格式和废标问题。
12. 系统记录最终采纳结果、人工修改 diff 和未完成原因。
13. 用户确认是否沉淀为经验。
14. 下次类似项目自动复用经验。

---

## 6. 核心功能模块

## 6.1 招标文件解析

### 功能说明

系统应支持上传招标文件，并自动解析其中的关键信息。

### 输入

- PDF 招标文件
- Word 招标文件
- Excel 附件
- 扫描件 OCR 文本

### 输出

- 项目名称
- 招标单位
- 招标范围
- 投标截止时间
- 商务要求
- 技术要求
- 评分标准
- 废标项
- 资质要求
- 交付要求
- 服务要求
- 格式要求
- 附件清单

### 关键能力

- 自动识别章节结构。
- 自动提取强制性要求。
- 自动标记废标风险。
- 自动生成招标要求清单。
- 自动生成响应矩阵。

---

## 6.2 标书任务拆解

### 功能说明

系统根据招标文件和投标模板，自动拆解标书制作任务。

### 任务类型

- 商务标任务
- 技术标任务
- 报价相关任务
- 资质材料任务
- 项目案例任务
- 人员材料任务
- 售后服务任务
- 偏离表任务
- 响应表任务
- 格式检查任务

### 输出示例

| 任务             | 负责人             | 来源要求        | 优先级 | 状态   |
| ---------------- | ------------------ | --------------- | ------ | ------ |
| 编写项目实施方案 | AI 初稿 + 人工确认 | 技术评分第 3 项 | 高     | 待生成 |
| 整理公司资质     | 人工确认           | 商务要求第 2 项 | 高     | 待补充 |
| 生成售后服务承诺 | AI 初稿            | 服务要求第 5 项 | 中     | 待审核 |

---

## 6.3 公司知识库

### 功能说明

将企业已有资料结构化沉淀为可检索知识库，为标书生成提供可信依据。

### 知识类型

- 公司介绍
- 企业资质
- 荣誉证书
- 产品资料
- 技术方案
- 历史案例
- 中标标书
- 人员简历
- 服务体系
- 交付方法论
- 行业解决方案
- 合同与验收材料
- 常用承诺文本

### 知识库要求

- 支持按行业检索。
- 支持按客户类型检索。
- 支持按章节类型检索。
- 支持按项目规模检索。
- 支持按投标结果检索。
- 支持来源追溯。
- 支持资料有效期管理。
- 支持权限隔离。

---

## 6.4 模板原位填充与章节生成

### 功能说明

系统根据用户上传的投标模板、招标要求和公司知识库，在投标模板的正确位置进行原位填充，并逐章生成标书内容。

### 生成原则

- 不一次性生成整本标书。
- 按章节逐步生成。
- 必须以用户上传的投标模板为母版，不得脱离模板另起文档。
- 必须识别模板中的标题层级、正文样式、表格结构、编号规则、页眉页脚、目录和占位符。
- 必须将内容填充到正确章节、正确表格、正确单元格或正确占位位置。
- 每章必须绑定招标要求。
- 每段关键表述必须尽量有资料来源。
- 对不确定内容进行标记，不能直接编造。
- 对涉及资质、案例、承诺的内容必须可追溯。
- 如果系统无法判断填充位置、无法保留格式、缺少资料或无法完成某类内容，必须生成未完成记录并展示给用户。

### 典型章节

- 项目理解
- 建设背景
- 技术方案
- 实施计划
- 项目管理方案
- 质量保障方案
- 售后服务方案
- 培训方案
- 风险控制方案
- 公司实力
- 同类案例
- 商务响应
- 技术响应表
- 偏离表

---

## 6.5 AI 编辑预览与采纳

### 功能说明

系统应在前端页面上快速预览 AI 基于投标模板完成的编辑内容，并允许用户像审阅 Word 修订一样逐条处理 AI 修改。

### 预览形式

- 高亮展示 AI 新增内容。
- 批注说明 AI 修改原因、引用来源和关联招标要求。
- 修订痕迹展示新增、删除和替换内容。
- 待确认标记展示资质、案例、承诺、报价、人员等敏感内容。
- 未完成标记展示无法填充或缺少资料的模板位置。

### 用户操作

- 接受单条 AI 修改。
- 拒绝单条 AI 修改。
- 批量接受低风险修改。
- 批量拒绝不适用修改。
- 在 AI 内容基础上人工编辑后接受。
- 将某条修改标记为待确认。
- 查看每条 AI 修改的来源依据、关联要求和风险说明。

### 采纳结果

每条 AI 修改都应形成明确状态：

- pending：待处理。
- accepted：已接受。
- rejected：已拒绝。
- edited_then_accepted：人工修改后接受。
- need_human_confirm：待人工确认。
- unable_to_fill：无法填充。

---

## 6.6 未完成项记录与展示

### 功能说明

如果系统不知道如何填充、没有足够资料填充、无法保持模板格式，或超出当前能力范围，必须记录原因并展示给用户，不能静默跳过。

### 未完成类型

- 缺少公司资料。
- 缺少资质证明。
- 缺少项目案例。
- 缺少人员信息。
- 招标要求不明确。
- 模板位置无法定位。
- 表格结构无法安全填充。
- 格式无法保证。
- 涉及报价或商务敏感信息，需要人工确认。
- 涉及承诺超出公司能力，需要人工确认。

### 展示方式

- 在模板预览中对未完成位置添加醒目标记。
- 在侧边栏展示未完成清单。
- 按风险等级、章节、任务类型和责任人筛选。
- 提供补充资料入口。
- 支持用户上传资料后重新生成。
- 支持用户手动填写并记录为经验。

---

## 6.7 审查与校验

### 功能说明

系统对 AI 生成内容进行自动审查，发现漏项、错项、风险项和格式问题。

### 检查类型

- 招标要求是否全部响应。
- 评分项是否逐条覆盖。
- 废标项是否满足。
- 资质要求是否具备。
- 技术参数是否遗漏。
- 商务承诺是否过度。
- 是否出现无法证明的表述。
- 是否编造案例或资质。
- 是否存在前后不一致。
- 是否符合模板格式要求。

### 输出形式

| 检查项       | 状态    | 风险等级 | 问题说明          | 建议             |
| ------------ | ------- | -------- | ----------------- | ---------------- |
| 技术参数响应 | FAIL    | 高       | 第 4.2 条未响应   | 补充对应技术方案 |
| 售后响应时间 | PASS    | 低       | 已明确 2 小时响应 | 无               |
| 资质证书     | WARNING | 中       | 未找到有效期证明  | 需人工上传证书   |

---

## 6.8 人工审改与 diff 记录

### 功能说明

系统支持用户对 AI 生成内容进行人工修改，并记录修改前后的差异。

### 记录内容

- AI 原始内容
- 人工修改后内容
- 修改位置
- 所属章节
- 关联招标要求
- 关联知识来源
- 修改时间
- 修改人
- 修改类型
- 修改原因
- 是否采纳
- 是否进入最终稿
- 项目最终结果

### 修改类型

- 润色
- 补充
- 删除
- 合规修正
- 格式调整
- 风险规避
- 客户定制化
- 资质修正
- 案例替换
- 技术增强
- 商务调整

---

## 6.9 经验沉淀

### 功能说明

系统应将人工修改 diff 转化为可复用经验，使系统越用越聪明。

### 经验类型

- 表达风格经验
- 章节写作经验
- 行业方案经验
- 客户偏好经验
- 合规风险经验
- 商务承诺经验
- 技术响应经验
- 格式模板经验

### 经验示例

原始内容：

> 我司拥有丰富项目经验。

人工修改后：

> 我司近三年已完成 27 个同类信息化建设项目，覆盖政企客户、园区平台及行业监管场景，具备成熟的项目实施与交付能力。

提炼经验：

> 公司能力描述不能空泛，应补充时间范围、项目数量、客户类型、应用场景和交付能力。

适用场景：

- 公司实力章节
- 项目经验章节
- 技术能力说明
- 政企类项目
- 信息化建设项目

---

## 6.10 经验复用

### 功能说明

生成新标书时，系统应自动检索相似历史经验，辅助生成更符合企业习惯的内容。

### 复用方式

- 检索相似历史项目。
- 检索相似章节。
- 检索相似招标要求。
- 检索相似人工修改记录。
- 检索中标项目优秀表述。
- 根据经验自动改写初稿。
- 将经验展示给用户确认。

### 示例

当系统生成“售后服务方案”时，自动检索：

- 历史售后服务章节。
- 被人工修改过的售后承诺。
- 中标项目的售后服务表达。
- 公司真实服务能力。
- 招标文件中的服务要求。

然后生成更完整的售后服务方案，包括：

- 服务团队
- 响应时间
- 故障分级
- 升级机制
- 处理流程
- 服务记录
- 验收方式
- 持续优化机制

---

## 7. 产品形态

## 7.1 MVP 版本

### 页面

- 项目列表
- 新建投标项目
- 文件上传页
- 招标解析结果页
- 模板结构识别页
- 任务清单页
- 模板原位填充页
- AI 编辑预览页
- 修改接受/拒绝页
- 未完成项清单页
- 审查结果页
- 人工审改页
- 经验确认页
- Word 导出页

### MVP 必须支持

- 上传招标文件。
- 上传公司资料。
- 上传投标模板。
- 解析招标要求。
- 识别投标模板结构和可填充位置。
- 生成任务清单。
- 在模板中生成章节初稿。
- 预览 AI 编辑内容。
- 支持用户接受、拒绝或二次修改 AI 内容。
- 检查响应情况。
- 记录未完成项和原因。
- 记录人工修改 diff。
- 导出 Word 初稿。

---

## 7.2 进阶版本

### 增强能力

- 多智能体协同。
- 自动生成响应表。
- 自动生成偏离表。
- 自动生成检查报告。
- 人工修改经验自动归因。
- 中标结果复盘。
- 相似项目推荐。
- 公司知识库权限管理。
- Word 高保真模板渲染。
- 多轮审查与自动改写。

---

## 8. 用户价值

### 8.1 对标书专员

- 减少重复写作。
- 降低漏项风险。
- 快速生成初稿。
- 保留个人修改经验。
- 提高标书一致性。

### 8.2 对企业

- 沉淀标书资产。
- 降低人员经验依赖。
- 提高中标材料质量。
- 缩短投标响应周期。
- 形成企业级投标知识库。

### 8.3 对管理层

- 可追踪每份标书制作进度。
- 可复盘投标质量。
- 可分析高频问题。
- 可沉淀中标经验。
- 可控制合规风险。

---

## 9. 成功指标

### 9.1 效率指标

- 标书初稿生成时间减少 50% 以上。
- 人工重复复制粘贴工作减少 60% 以上。
- 招标要求整理时间减少 70% 以上。

### 9.2 质量指标

- 招标要求响应覆盖率达到 95% 以上。
- 废标项漏检率低于 3%。
- 人工修改率逐步下降。
- 同类章节复用率逐步提升。

### 9.3 学习指标

- 每个项目可沉淀有效修改经验。
- 高频人工修改问题逐步减少。
- 中标项目优秀内容可被复用。
- 相似项目生成质量逐步提升。

---

# 第二部分：技术方案细节

## 10. 总体技术路线

推荐采用：

**开源 DOCX 任意模板理解引擎 + Supabase 数据底座 + FastAPI 独立后端 + RAG 知识库 + AIRevision 采纳机制 + diff 经验沉淀 + 规则引擎。**

核心约束：

- 任意 Word 模板自动理解是最高优先级，不以占位符模板作为主要路线。
- 除 LLM 调用外，不引入必须付费的核心组件。
- 不把 Aspose.Words、OnlyOffice、Temporal、OpenSearch、Kubernetes 作为 MVP 必需依赖。
- Cloudflare 优先用于前端托管、域名、CDN 和入口，不为了兼容 Cloudflare Workers 牺牲后端技术能力。
- 后端使用 FastAPI + Docker 独立运行，可本地、VPS、容器平台或未来 Cloudflare Containers 部署。
- 数据库、文件、认证和向量存储使用 Supabase。

---

## 11. 低成本生产架构

```text
前端层
  |
  |-- Next.js + React + TypeScript
  |-- Cloudflare Pages 托管
  |-- 章节树、HTML 预览、AIRevision 高亮、未完成项侧边栏
  |
后端层
  |
  |-- FastAPI + Docker 独立服务
  |-- 本地 / VPS / 容器平台运行，可尝试 Cloudflare Containers
  |-- 不使用 Cloudflare Workers 承载复杂 DOCX 解析和回写
  |
DOCX 模板理解层
  |
  |-- zipfile 解包 DOCX
  |-- lxml 解析 WordprocessingML
  |-- python-docx / docx2python 辅助读取与简单回写
  |-- mammoth 生成 HTML 预览
  |-- 自研章节识别、表格理解、TemplateSlot 生成和 XML 级回写
  |
AI 与知识层
  |
  |-- Model Gateway 统一接入 DeepSeek、通义、OpenAI 等 LLM
  |-- LLM 负责语义分类、内容生成、diff 归因和审查建议
  |-- LlamaIndex 或轻量 RAG 负责资料检索和引用追踪
  |-- 规则引擎负责硬约束、风险检查和导出阻断
  |
Supabase 数据层
  |
  |-- Supabase Auth 用户认证
  |-- Supabase Postgres 业务数据
  |-- Supabase pgvector 向量检索
  |-- Supabase Storage 文件存储
  |-- 数据库任务表承载早期异步任务和状态流转
```

---

## 12. 低成本 V1 最终技术选型

## 12.1 前端定稿

最终选择：

- Next.js + React + TypeScript。
- Ant Design Pro （shadcn/ui主题） 作为 UI 基座。
- Cloudflare Pages 托管前端。

核心要求：

- 不依赖 OnlyOffice 作为 MVP 必需能力。
- 前端负责项目管理、文件上传、章节树、HTML 预览、AIRevision 高亮、修订列表、未完成项、审查报告和经验确认。
- 接受/拒绝/修改后接受在应用内基于 AIRevision 状态实现。
- Word 原生修订、在线编辑器和高保真审阅体验不作考虑，（如果有开源方案的话可以考虑，主打是该功能不花钱），不影响 MVP 主线。

---

## 12.2 后端定稿

最终选择：

- Python FastAPI 作为独立后端服务。
- Docker 作为统一运行方式。
- 早期使用 Supabase 数据库任务表承载异步任务和状态流转。

选择原因：

- FastAPI 适合 AI、DOCX 解析、RAG 和 Python 文档生态集成。
- 后端不为了兼容 Cloudflare Workers 妥协技术能力。
- 后端可本地运行，也可部署到 VPS、容器平台或未来 Cloudflare Containers。
- Temporal 可作为后期复杂工作流增强，不作为 MVP 必需依赖。

---

## 12.3 文档解析定稿

最终选择：

- zipfile：解包 DOCX。
- lxml：解析 WordprocessingML XML。
- python-docx：辅助读取和简单段落/表格回写。
- docx2python：辅助提取正文、表格、页眉页脚等结构。
- mammoth：将 DOCX 转为 HTML 预览基础。
- pdfplumber / pypdf：解析 PDF 招标文件。
- PaddleOCR：作为扫描件 OCR 的本地可选能力。

解析目标：

- 提取正文、标题、段落、run、表格、合并单元格、编号、样式、页眉页脚和目录。
- 建立 node_id、location_path、section_path 与原始 DOCX XML 的映射。
- 支持任意 Word 模板理解，而不是只识别占位符。

---

## 12.4 Word 能力定稿

最终选择：

- 自研开源 DOCX 模板理解引擎作为核心能力。
- lxml + WordprocessingML 直接解析和必要时 XML 级回写。
- python-docx 处理简单段落追加、表格单元格填充和样式继承。
- mammoth 生成前端 HTML 预览。

选择原因：

- 任意 Word 模板理解是核心卖点，不能依赖付费 Word SDK。
- Aspose.Words 和 OnlyOffice 不作为 MVP 必需能力。
- 第一版不强求 Word 原生 Track Changes，而是在应用内维护 AIRevision、状态和 diff。
- 最终 DOCX 由后端根据 accepted 的 AIRevision 合成，确保 Word/WPS 可打开且主要格式不被破坏。

---

## 12.5 RAG 与任务流定稿

最终选择：

- 早期使用轻量 RAG 或 LlamaIndex。
- Supabase pgvector 存储向量。
- Supabase Postgres Full Text Search 作为早期关键词检索。
- 数据库任务表承载解析、生成、审查和导出任务状态。

选择原因：

- 先避免引入 OpenSearch、Temporal 等额外运维成本。
- RAG 重点保证来源可追溯、引用可展示、生成不编造。
- 智能体能力表现为可控的后端任务节点，不使用自由 Agent 作为主流程。

---

## 12.6 数据库与存储定稿

最终选择：

- Supabase Auth：用户认证。
- Supabase Postgres：业务数据、任务状态、审计日志、模型调用日志。
- Supabase pgvector：公司资料、历史标书、经验库的向量检索。
- Supabase Storage：招标文件、投标模板、解析结果、生成稿和导出稿。

选择原因：

- 数据存储方向固定使用 Supabase，降低部署和运维成本。
- 文件不直接进入数据库正文存储，数据库只保存元数据、解析结果、引用关系和审计记录。
- OpenSearch、Redis、S3/MinIO 可作为后期增强，不作为 MVP 必需依赖。

---

## 12.7 大模型定稿

最终选择：

- 自研轻量 Model Gateway 统一接入 DeepSeek、通义千问、OpenAI 等模型。
- Embedding 模型和生成模型通过 Model Gateway 管理。
- 只接受 LLM 调用费用，其他核心组件优先免费、开源或 Supabase 免费/低价额度。

模型使用场景：

- 招标要求抽取。
- 任意 Word 模板章节语义识别。
- 表格类型和可填充位置判断。
- 章节内容生成。
- AI 修订说明生成。
- diff 归因和经验总结。
- 合规审查建议。

生产要求：

- 所有模型调用必须记录模型名、版本、token、成本、耗时、调用场景和脱敏状态。
- LLM 只做语义判断、内容生成和解释，不直接操作 Word XML。
- 模型输出不得直接进入最终稿，必须形成 AIRevision 并经过采纳流程。

---

## 12.8 部署与观测定稿

最终选择：

- 前端部署到 Cloudflare Pages。
- 后端使用 FastAPI + Docker，本地运行优先，也可部署到 VPS、容器平台或未来 Cloudflare Containers。
- Cloudflare 只承担前端托管、域名、CDN、HTTPS 和入口代理，不承担复杂 DOCX 解析。
- 日志优先使用本地日志 + Supabase 日志表。

生产要求：

- 不为了兼容 Cloudflare Workers 牺牲技术方案。
- 支持任务失败记录、人工重试、模型成本统计和导出前完整性检查。
- 后期如用户规模扩大，再引入专业监控、队列和工作流系统。

---

## 13. 核心数据模型

## 13.1 Project 投标项目

字段建议：

- id
- project_name
- tender_company
- bid_company
- industry
- project_type
- deadline
- status
- created_by
- created_at
- updated_at

---

## 13.2 Document 文档

字段建议：

- id
- project_id
- document_type
- file_name
- file_path
- parsed_text
- structure_json
- status
- created_at

document_type 可包括：

- tender_file
- company_profile
- qualification
- historical_bid
- bid_template
- contract
- case_study

---

## 13.3 Requirement 招标要求

字段建议：

- id
- project_id
- source_document_id
- requirement_type
- requirement_text
- source_location
- priority
- risk_level
- is_mandatory
- response_status
- created_at

requirement_type 可包括：

- technical
- business
- qualification
- service
- format
- scoring
- disqualification

---

## 13.4 BidTask 标书任务

字段建议：

- id
- project_id
- task_name
- task_type
- related_requirement_ids
- assignee_type
- status
- priority
- generated_content_id
- created_at
- updated_at

assignee_type 可包括：

- ai
- human
- ai_then_human
- human_required

---

## 13.5 SectionContent 章节内容

字段建议：

- id
- project_id
- section_name
- section_type
- template_position
- ai_content
- final_content
- related_requirement_ids
- related_knowledge_ids
- status
- version
- created_at
- updated_at

---

## 13.6 EditDiff 人工修改记录

字段建议：

- id
- project_id
- section_content_id
- before_text
- after_text
- diff_text
- edit_type
- edit_reason
- related_requirement_ids
- editor_id
- accepted
- used_in_final
- created_at

edit_type 可包括：

- polish
- supplement
- delete
- compliance_fix
- format_fix
- risk_control
- customer_customization
- qualification_fix
- case_replacement
- technical_enhancement
- business_adjustment

---

## 13.7 Experience 经验库

字段建议：

- id
- title
- experience_type
- summary
- before_pattern
- after_pattern
- applicable_industry
- applicable_section_type
- applicable_customer_type
- related_diff_ids
- confidence
- approved_by_human
- created_at
- updated_at

experience_type 可包括：

- writing_style
- compliance_rule
- technical_response
- business_response
- service_commitment
- risk_control
- template_rule
- customer_preference

---

## 13.8 TemplateSlot 模板填充位置

字段建议：

| 字段                  | 说明                                                                       |
| --------------------- | -------------------------------------------------------------------------- |
| id                    | 模板填充位置唯一 ID。                                                      |
| project_id            | 所属投标项目 ID。                                                          |
| document_id           | 所属 Word 模板文档 ID。                                                    |
| node_id               | DOCX 结构树中的节点 ID，用于定位段落、表格或单元格。                       |
| slot_type             | 填充位置类型，例如段落、表格单元格、章节末尾、占位符。                     |
| section_name          | 该位置所属章节名称。                                                       |
| section_path          | 章节路径，例如 `技术标/实施方案/进度计划`。                                |
| location_path         | 原始 DOCX XML 位置路径，例如 `word/document.xml/body/tbl[3]/tr[2]/tc[4]`。 |
| expected_content_type | 预期内容类型，例如公司介绍、技术方案、商务响应、案例、资质。               |
| style_id              | 原 Word 样式 ID，用于回写时继承格式。                                      |
| table_position        | 表格位置描述，记录表格 ID、行列号、合并单元格信息。                        |
| confidence            | 系统判断该位置可填充的置信度，范围 0 到 1。                                |
| evidence              | 置信度依据，例如标题文本、表头、上下文、LLM 分类结果。                     |
| fill_strategy         | 填充策略，例如替换、追加、单元格填充、章节末尾追加。                       |
| fill_status           | 填充状态，例如待处理、已填充、待确认、无法填充。                           |
| created_at            | 创建时间。                                                                 |
| updated_at            | 更新时间。                                                                 |

slot_type 可包括：

- paragraph
- table_cell
- placeholder
- heading_section
- section_append
- annex
- signature_area

fill_status 可包括：

- pending
- filled
- partially_filled
- need_human_confirm
- unable_to_fill

---

## 13.9 AIRevision AI 修订记录

字段建议：

| 字段                   | 说明                                               |
| ---------------------- | -------------------------------------------------- |
| id                     | AI 修订唯一 ID。                                   |
| project_id             | 所属投标项目 ID。                                  |
| section_content_id     | 关联章节内容 ID，可为空。                          |
| template_slot_id       | 关联 TemplateSlot ID，表示修订写入哪个模板位置。   |
| revision_type          | 修订类型，例如插入、替换、删除、表格填充、批注。   |
| before_content         | 修改前内容，用于 diff 和拒绝回滚。                 |
| ai_content             | AI 生成的候选内容。                                |
| user_edited_content    | 用户基于 AI 内容二次修改后的内容。                 |
| final_content          | 最终采纳写入 DOCX 的内容。                         |
| comment                | AI 修订说明，解释为什么这样填。                    |
| source_requirement_ids | 关联招标要求 ID 列表。                             |
| source_knowledge_ids   | 关联公司资料、历史案例或经验 ID 列表。             |
| risk_level             | 风险等级，例如 low、medium、high。                 |
| confidence             | AI 修订可信度，综合模板位置、资料来源和模型判断。  |
| status                 | 用户采纳状态，例如待处理、接受、拒绝、修改后接受。 |
| created_at             | 创建时间。                                         |
| updated_at             | 更新时间。                                         |

revision_type 可包括：

- insert
- replace
- delete
- comment
- fill_blank
- table_fill
- format_adjustment

status 可包括：

- pending
- accepted
- rejected
- edited_then_accepted
- need_human_confirm
- unable_to_fill

---

## 13.10 UnfinishedItem 未完成项

字段建议：

| 字段                    | 说明                                                       |
| ----------------------- | ---------------------------------------------------------- |
| id                      | 未完成项唯一 ID。                                          |
| project_id              | 所属投标项目 ID。                                          |
| template_slot_id        | 关联模板位置 ID，可为空。                                  |
| related_requirement_ids | 关联招标要求 ID 列表。                                     |
| item_type               | 未完成类型，例如缺资料、无法定位、格式不支持、需商务确认。 |
| reason                  | 未完成原因，必须可读并展示给用户。                         |
| impact                  | 对标书质量或废标风险的影响说明。                           |
| risk_level              | 风险等级，例如 low、medium、high、blocking。               |
| suggested_action        | 建议用户采取的动作，例如上传资质、确认位置、手动填写。     |
| responsible_role        | 建议处理角色，例如标书专员、商务、技术、法务。             |
| status                  | 处理状态，例如待处理、已补充、已忽略、已解决。             |
| created_at              | 创建时间。                                                 |
| updated_at              | 更新时间。                                                 |

item_type 可包括：

- missing_material
- missing_qualification
- missing_case
- missing_personnel
- unclear_requirement
- cannot_locate_template_slot
- unsafe_table_fill
- format_not_supported
- need_business_confirm
- capability_gap

---

## 13.11 UserProfile 用户资料

字段建议：

| 字段             | 说明                                             |
| ---------------- | ------------------------------------------------ |
| id               | 业务用户资料唯一 ID。                            |
| auth_user_id     | Supabase Auth 用户 ID，用于关联认证账号。        |
| display_name     | 用户显示名称。                                   |
| role             | 用户角色，例如 owner、editor、reviewer。         |
| preferences_json | 用户偏好配置，例如默认模型、语言风格、审阅习惯。 |
| created_at       | 创建时间。                                       |
| updated_at       | 更新时间。                                       |

---

## 13.12 DocumentVersion 文档版本

字段建议：

| 字段         | 说明                                                        |
| ------------ | ----------------------------------------------------------- |
| id           | 文档版本唯一 ID。                                           |
| document_id  | 所属文档 ID。                                               |
| version_no   | 版本号，例如 1、2、3。                                      |
| version_type | 版本类型，例如原始模板、解析结构、AI 初稿、确认稿、导出稿。 |
| storage_path | Supabase Storage 文件路径。                                 |
| checksum     | 文件校验值，用于判断文件是否变化。                          |
| created_by   | 创建人 ID。                                                 |
| created_at   | 创建时间。                                                  |

---

## 13.13 DocumentNode DOCX 结构树节点

字段建议：

| 字段           | 说明                                                              |
| -------------- | ----------------------------------------------------------------- |
| id             | 节点记录唯一 ID。                                                 |
| document_id    | 所属文档 ID。                                                     |
| node_id        | 结构树稳定节点编号，用于关联 TemplateSlot 和 AIRevision。         |
| node_type      | 节点类型，例如 paragraph、run、table、row、cell、header、footer。 |
| text           | 节点提取出的文本内容。                                            |
| location_path  | DOCX XML 位置路径。                                               |
| style_json     | 样式信息，例如字体、字号、加粗、段落样式、编号样式。              |
| parent_node_id | 父节点 ID，用于还原文档树结构。                                   |
| created_at     | 创建时间。                                                        |

---

## 13.14 DocumentChunk 知识库切片

字段建议：

| 字段            | 说明                                             |
| --------------- | ------------------------------------------------ |
| id              | 切片唯一 ID。                                    |
| document_id     | 来源文档 ID。                                    |
| chunk_text      | 切片文本。                                       |
| chunk_type      | 切片类型，例如正文、表格、案例、资质、经验。     |
| source_location | 来源位置，例如章节路径、页码、node_id。          |
| embedding       | pgvector 向量字段。                              |
| metadata_json   | 检索元数据，例如行业、章节、项目类型、客户类型。 |
| created_at      | 创建时间。                                       |

---

## 13.15 Citation 证据引用

字段建议：

| 字段        | 说明                                                    |
| ----------- | ------------------------------------------------------- |
| id          | 引用记录唯一 ID。                                       |
| project_id  | 所属投标项目 ID。                                       |
| target_type | 引用目标类型，例如 AIRevision、SectionContent。         |
| target_id   | 引用目标 ID。                                           |
| source_type | 来源类型，例如 Requirement、DocumentChunk、Experience。 |
| source_id   | 来源记录 ID。                                           |
| quote_text  | 引用原文或证据片段。                                    |
| confidence  | 引用可信度，范围 0 到 1。                               |
| created_at  | 创建时间。                                              |

---

## 13.16 TaskRun 后台任务

字段建议：

| 字段          | 说明                                                                              |
| ------------- | --------------------------------------------------------------------------------- |
| id            | 任务唯一 ID。                                                                     |
| project_id    | 所属投标项目 ID。                                                                 |
| task_type     | 任务类型，例如 parse_docx、extract_requirements、generate_revision、export_docx。 |
| status        | 任务状态，例如 pending、running、succeeded、failed。                              |
| input_json    | 任务输入参数。                                                                    |
| output_json   | 任务输出结果。                                                                    |
| error_message | 失败原因。                                                                        |
| retry_count   | 重试次数。                                                                        |
| created_at    | 创建时间。                                                                        |
| updated_at    | 更新时间。                                                                        |

---

## 13.17 AuditLog 审计日志

字段建议：

| 字段        | 说明                                                           |
| ----------- | -------------------------------------------------------------- |
| id          | 审计日志唯一 ID。                                              |
| project_id  | 所属投标项目 ID，可为空。                                      |
| actor_id    | 操作者用户 ID。                                                |
| action      | 操作类型，例如 accept_revision、reject_revision、export_docx。 |
| target_type | 操作对象类型。                                                 |
| target_id   | 操作对象 ID。                                                  |
| before_json | 操作前快照。                                                   |
| after_json  | 操作后快照。                                                   |
| created_at  | 操作时间。                                                     |

---

## 13.18 ModelCallLog 模型调用日志

字段建议：

| 字段              | 说明                                          |
| ----------------- | --------------------------------------------- |
| id                | 模型调用记录唯一 ID。                         |
| project_id        | 所属投标项目 ID，可为空。                     |
| provider          | 模型厂商，例如 deepseek、openai、qwen。       |
| model_name        | 模型名称。                                    |
| scenario          | 调用场景，例如模板理解、内容生成、diff 归因。 |
| prompt_tokens     | 输入 token 数。                               |
| completion_tokens | 输出 token 数。                               |
| cost_estimate     | 预估调用成本。                                |
| latency_ms        | 调用耗时，单位毫秒。                          |
| status            | 调用状态，例如 succeeded、failed。            |
| created_at        | 创建时间。                                    |

---

## 13.19 ExportRecord 导出记录

字段建议：

| 字段                | 说明                                   |
| ------------------- | -------------------------------------- |
| id                  | 导出记录唯一 ID。                      |
| project_id          | 所属投标项目 ID。                      |
| document_version_id | 导出的文档版本 ID。                    |
| export_format       | 导出格式，例如 docx、pdf、html。       |
| storage_path        | 导出文件在 Supabase Storage 中的路径。 |
| check_result_json   | 导出前完整性检查结果。                 |
| created_by          | 导出人 ID。                            |
| created_at          | 导出时间。                             |

MVP 阶段可暂缓复杂 Tenant、RBAC、Temporal Workflow 等模型，但核心表建议统一预留 `owner_id`、`tenant_id`、`created_by`、`updated_by` 字段，方便后续企业化和权限隔离。

---

## 14. diff 学习机制

## 14.1 采集

每次人工修改后，系统记录：

- 修改前内容。
- 修改后内容。
- 修改位置。
- 关联章节。
- 关联招标要求。
- 关联知识来源。
- 修改人。
- 修改时间。
- 最终是否采纳。

---

## 14.2 分析

系统调用 LLM 对 diff 进行分析：

- 修改了什么。
- 为什么修改。
- 属于哪种修改类型。
- 是否具有通用性。
- 是否适合沉淀为经验。
- 适用于哪些场景。
- 是否可能只是单项目特殊要求。

---

## 14.3 人工确认

经验不能全部自动入库，建议增加人工确认流程：

- 是否保存为经验。
- 适用范围是什么。
- 是否仅当前客户适用。
- 是否为公司通用规则。
- 是否为行业通用写法。
- 是否需要加入审查规则。

---

## 14.4 复用

新项目生成时：

1. 根据行业、客户类型、章节类型、招标要求检索经验。
2. 将相关经验注入生成提示词。
3. 生成内容时主动规避历史问题。
4. 审查时检查是否再次出现类似问题。
5. 如用户继续修改，则再次记录新 diff。

---

## 15. 智能体设计

不建议使用一个全能 Agent 自由生成整本标书。

推荐采用多角色智能体 + 总控工作流。

## 15.1 总控调度智能体

职责：

- 理解项目状态。
- 拆解任务。
- 分配任务。
- 控制流程。
- 调用其他智能体。
- 汇总结果。
- 避免任务乱跑。

---

## 15.2 招标解析智能体

职责：

- 提取招标要求。
- 提取评分标准。
- 提取废标项。
- 提取格式要求。
- 生成要求清单。

---

## 15.3 技术标智能体

职责：

- 生成技术方案。
- 响应技术参数。
- 生成实施计划。
- 生成质量保障方案。
- 生成风险控制方案。

---

## 15.4 商务标智能体

职责：

- 生成公司介绍。
- 匹配资质。
- 匹配案例。
- 生成商务响应。
- 生成服务承诺。

---

## 15.5 合规审查智能体

职责：

- 检查废标项。
- 检查资质真实性。
- 检查响应完整性。
- 检查过度承诺。
- 标记人工确认项。

---

## 15.6 经验学习智能体

职责：

- 分析人工修改 diff。
- 归纳修改原因。
- 提炼可复用经验。
- 推荐入库。
- 检索相似历史经验。

---

## 16. 规则引擎

仅靠大模型不够，需要规则引擎处理硬约束。

## 16.1 规则类型

- 废标项规则
- 资质要求规则
- 格式要求规则
- 响应完整性规则
- 禁止编造规则
- 商务承诺规则
- 偏离表规则
- 时间节点规则
- 报价一致性规则

## 16.2 示例规则

- 若招标文件要求提供某资质，则必须在资质清单中找到对应证明。
- 若技术参数要求逐条响应，则必须生成技术响应表。
- 若内容出现“完全满足”，必须绑定证据来源。
- 若没有案例证明，不能写“拥有大量成功案例”。
- 若服务响应时间超过公司能力范围，必须标记人工确认。
- 若废标项未响应，必须阻断最终导出。

---

## 17. RAG 检索策略

## 17.1 检索对象

- 公司资料
- 历史标书
- 中标案例
- 人工修改经验
- 审查规则
- 行业方案
- 产品文档
- 服务承诺模板

## 17.2 检索方式

建议采用混合检索：

- 向量检索：找语义相似内容。
- 关键词检索：找明确资质、参数、客户名。
- 元数据过滤：按行业、章节、客户类型过滤。
- 规则过滤：过滤过期资质和不可用案例。
- rerank：对候选结果重新排序。

## 17.3 检索结果要求

每个生成内容应尽量携带：

- 来源文档
- 来源章节
- 来源段落
- 可信度
- 是否需要人工确认

---

## 18. 生产产品阶段规划

## 18.1 P0 技术验证：开源 DOCX 任意模板理解引擎

目标：

- 验证产品最核心、风险最高的任意 Word 模板自动理解能力。
- 不依赖 Aspose.Words、OnlyOffice 等付费或重型组件。

建议周期：

- 3 到 6 周。

核心交付：

- 上传 DOCX 投标模板。
- 使用 zipfile + lxml 解包并解析 WordprocessingML。
- 生成 DocumentNode 文档结构树。
- 识别章节、段落、表格、合并单元格、编号、样式、页眉页脚和目录。
- 自动判断章节类型和表格类型。
- 自动生成 TemplateSlot、confidence、evidence 和 fill_strategy。
- 对无法判断或无法安全填充的位置生成 UnfinishedItem。
- 能把简单 AI 内容写回原 DOCX，并保证 Word/WPS 可正常打开。

---

## 18.2 P1 生产 MVP：单项目闭环

目标：

- 跑通一个真实投标项目的端到端流程。
- 支持招标解析、模板填充、AI 修订、未完成项、人工采纳和导出。

建议周期：

- 6 到 10 周。

核心交付：

- 项目管理、文件上传、模板管理。
- 招标要求抽取和任务清单。
- 模板原位填充和 AIRevision 生成。
- 未完成项 UnfinishedItem 记录和展示。
- 用户接受、拒绝或二次修改 AI 内容。
- 基础响应性检查和导出前检查。
- Word/PDF 导出。

---

## 18.3 P2 知识库与经验增强

目标：

- 提升内容质量和复用能力。
- 建立公司资料、历史标书、案例、资质和人工 diff 经验库。

建议周期：

- 4 到 8 周。

核心交付：

- LlamaIndex 或轻量 RAG 文档索引。
- Supabase pgvector 向量检索。
- Postgres Full Text Search 关键词检索。
- Citation 证据引用。
- diff 分类、归因和经验入库。
- 相似案例和相似修改经验复用。

---

## 18.4 P3 审查与企业化

目标：

- 降低废标风险，并支撑企业级真实使用。

建议周期：

- 6 到 10 周。

核心交付：

- 响应矩阵、废标项检查、资质检查、格式检查。
- 导出前阻断策略。
- Tenant、RBAC、审计日志、文档版本、模型调用日志。
- 成本统计、任务重试、异常告警和私有化部署能力。

## 18.5 P4 智能体协作

目标：

- 在确定性工作流基础上加入多角色 AI 节点，提升自动化程度。

建议周期：

- 6 到 12 周。

核心交付：

- 招标解析节点。
- 技术标生成节点。
- 商务标生成节点。
- 合规审查节点。
- 经验学习节点。
- 多轮生成、审查、修订和复盘。

---

## 19. 风险与注意事项

## 19.1 幻觉风险

风险：

- 模型可能编造资质、案例、客户、技术能力。

应对：

- 所有资质、案例、承诺必须绑定来源。
- 无来源内容必须标记人工确认。
- 重要内容不得直接自动进入最终稿。

---

## 19.2 漏项风险

风险：

- 招标要求未完整提取或未完整响应。

应对：

- 建立招标要求清单。
- 建立响应矩阵。
- 强制每个要求绑定响应章节。
- 废标项未完成时禁止导出最终稿。

---

## 19.3 diff 学错风险

风险：

- 某些人工修改只适合单个项目，不能泛化。

应对：

- 经验入库需要人工确认。
- 经验必须设置适用范围。
- 区分公司通用经验、行业经验、客户特殊经验。
- 对未中标项目经验降低权重。

---

## 19.4 Word 模板理解与格式风险

风险：

- 任意 Word 模板质量参差不齐，可能没有标准 Heading 样式。
- 表格合并单元格、自动编号、页眉页脚、目录和复杂样式可能导致解析或回写失败。
- HTML 预览无法完全还原 Word 原貌。

应对：

- 直接解析 DOCX XML，建立 DocumentNode 与 location_path 映射。
- 每个 TemplateSlot 必须有 confidence、evidence 和 fill_strategy。
- 低置信度位置不得自动写入最终稿，必须进入待确认或未完成项。
- 回写前保留原始模板副本，导出后执行 Word/WPS 打开校验。
- 逐步积累模板解析规则库和用户修正经验。

---

## 19.5 数据安全风险

风险：

- 招标文件、公司资质、报价、客户信息属于敏感数据。

应对：

- 权限隔离。
- 项目级访问控制。
- 文件加密存储。
- 操作审计。
- 模型调用脱敏。
- 必要时使用私有化模型。

---

## 19.6 模板填充风险

风险：

- AI 内容填入了错误章节、错误表格或错误单元格。
- 系统破坏了用户上传模板的格式、编号、目录或页眉页脚。
- 系统无法判断某些模板位置应该填什么，但未提示用户。

应对：

- 建立 TemplateSlot 模板位置模型。
- 每次填充必须绑定模板位置、内容类型和置信度。
- 低置信度填充必须进入待确认状态。
- 无法填充时必须生成 UnfinishedItem。
- 导出前执行模板完整性检查。
- 保留原始模板副本，最终文档从原始模板合成。

---

## 20. 生产产品级规划要求

本项目应按生产产品规划，而不是一次性 Demo 工具规划。

### 产品原则

- 用户上传的任意 Word 投标模板是最终文档母版，系统必须围绕模板进行解析、理解、填充、预览和导出。
- AI 生成内容必须先形成 AIRevision，不得直接覆盖最终稿。
- 系统不能静默失败，所有未完成、无法填充和待确认内容必须展示给用户。
- 涉及资质、报价、案例、承诺和法律风险的内容必须默认进入人工确认流程。
- 所有用户操作、AI 修改、采纳结果和最终导出版本必须可审计。
- 除 LLM 调用外，不引入必须付费的核心组件。

### 生产能力要求

- 支持 Supabase Auth、Postgres、pgvector 和 Storage 作为低成本数据底座。
- 支持 FastAPI + Docker 独立后端，本地运行优先，后续可部署到 VPS 或容器平台。
- 支持 Cloudflare Pages 托管前端，Cloudflare 不承担复杂 DOCX 解析。
- 支持文档版本管理、任务失败记录、人工重试、模型调用日志和成本统计。
- 支持导出前完整性检查。
- 支持中标/未中标结果回填和复盘。

---

## 21. 最终推荐方案

最适合本项目的最终方案是：

**低成本智能标书专员 Web 产品 + 开源 DOCX 任意模板理解引擎 + Supabase 数据底座 + FastAPI 独立后端 + RAG 知识库 + AIRevision 采纳 + diff 经验沉淀 + 规则审查引擎。**

### 21.1 最终技术栈

- 前端：Next.js + React + TypeScript + Ant Design Pro。
- 前端部署：Cloudflare Pages。
- 后端：Python FastAPI + Docker。
- 后端部署：本地运行优先，可部署到 VPS、容器平台或未来 Cloudflare Containers。
- 数据库：Supabase Postgres。
- 认证：Supabase Auth。
- 向量检索：Supabase pgvector。
- 文件存储：Supabase Storage。
- DOCX 解析：zipfile + lxml + python-docx + docx2python。
- DOCX 预览：mammoth + 自研章节树/HTML 预览。
- DOCX 回写：python-docx 简单回写 + lxml XML 级回写。
- PDF 解析：pdfplumber + pypdf。
- OCR：PaddleOCR 本地可选。
- RAG：LlamaIndex 或轻量自研 RAG。
- 模型接入：自研轻量 Model Gateway。
- 任务流：Supabase 数据库任务表，后期按需升级。

### 21.2 核心产品原则

- 用户上传的任意 Word 投标模板是最终文档母版，系统必须围绕模板进行解析、理解、填充、预览和导出。
- 任意 Word 模板自动理解是核心卖点，标准占位符模板只作为加速路径。
- AI 不能直接产出最终稿，只能先生成 AIRevision，由用户接受、拒绝或人工修改后采纳。
- 所有 AI 内容必须绑定来源、招标要求、模板位置、风险等级和采纳状态。
- 无法填充、缺少资料、格式风险、资质风险和能力不足必须生成 UnfinishedItem，不能静默跳过。
- 涉及资质、报价、案例、承诺和法律风险的内容必须默认进入人工确认流程。
- 导出前必须执行响应完整性、废标项、资质、格式和未完成项检查。
- 除 LLM 调用外，核心能力不依赖必须付费的商业组件。

### 21.3 关键取舍

- 不把 Aspose.Words 作为核心必需能力，优先自研开源 DOCX 模板理解引擎。
- 不把 OnlyOffice 作为 MVP 必需能力，优先在应用内实现章节树、HTML 预览、AIRevision 高亮和接受/拒绝。
- 不使用自由 Agent 作为主流程，智能体能力必须作为后端受控任务节点。
- 不在早期引入 Temporal、OpenSearch、Kubernetes、Redis 等额外基础设施，除非用户规模和复杂度证明必要。
- 不在早期进行模型微调，优先通过 RAG、规则、Prompt、diff 经验库提升质量。
- 不为了兼容 Cloudflare Workers 牺牲技术能力，Cloudflare 主要承担前端托管和入口。
- 不绑定单一模型厂商，通过 Model Gateway 统一接入和切换模型。

### 21.4 建设顺序

1. P0 验证开源 DOCX 任意模板理解引擎。
2. P1 跑通模板原位填充 MVP，包括 AIRevision、UnfinishedItem、前端预览和 DOCX 导出。
3. P2 建设公司知识库、RAG、Citation 和 diff 经验沉淀。
4. P3 增强响应审查、废标检查、模板理解规则库和导出完整性检查。
5. P4 加入多角色 AI 任务节点和更完整的权限、审计、复盘能力。
6. 数据积累充足后，再评估模型微调、偏好训练或引入商业 Word 增强组件。

最终目标是让系统从“能生成标书内容”升级为“能自动理解任意 Word 投标模板、能定位填充位置、能解释依据、能暴露未完成项、能接受人工经验并持续变聪明”的低成本智能标书专员系统。
