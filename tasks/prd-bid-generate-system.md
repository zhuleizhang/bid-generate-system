# PRD: 智能标书专员系统

## 概述

面向企业投标场景的智能标书专员系统。围绕招标文件解析、任务拆解、资料匹配、章节生成、合规检查、人工审改和经验沉淀的智能工作流系统。

它不是简单的 AI 写作工具，核心卖点是**开源 DOCX 任意模板理解引擎**——自动理解用户上传的任意 Word 投标模板，识别章节、表格、可填充位置，并在正确位置生成 AI 修订内容。

### 核心产品原则

1. **模板为尊**：用户上传的任意 Word 投标模板是最终文档母版，系统围绕模板进行解析、理解、填充、预览和导出
2. **AI 不直接写最终稿**：AI 只生成 AIRevision（修订记录），用户接受/拒绝/修改后，才合成最终稿
3. **必须可追溯**：所有 AI 内容绑定来源、招标要求、模板位置、风险等级和采纳状态
4. **不静默失败**：无法填充、缺资料、格式风险等必须生成 UnfinishedItem 展示给用户
5. **敏感内容默认人工确认**：资质、报价、案例、承诺、法律风险相关的内容必须进入人工确认流程
6. **低成本约束**：除 LLM 调用外，不引入必须付费的核心组件

### Epic 总览

| Epic   | 阶段 | 目标                       | 建议周期 | 依赖 |
| ------ | ---- | -------------------------- | -------- | ---- |
| **E0** | P0   | 开源 DOCX 任意模板理解引擎 | 3-6 周   | 无   |
| **E1** | P1   | 单项目闭环 MVP             | 6-10 周  | E0   |
| **E2** | P2   | 知识库与经验增强           | 4-8 周   | E1   |

### 目标用户

| 角色                 | 类型     | 核心诉求                                 |
| -------------------- | -------- | ---------------------------------------- |
| 标书专员、售前工程师 | 主要用户 | 减少重复写作、降低漏项风险、快速生成初稿 |
| 商务人员、项目经理   | 主要用户 | 管理投标进度、追踪标书质量               |
| 管理层               | 次要用户 | 追踪进度、复盘投标质量、控制合规风险     |
| 法务、技术负责人     | 次要用户 | 审查合规性、确认技术方案                 |

---

## Epic 0: P0 — 开源 DOCX 任意模板理解引擎

### E0 目标

建设不依赖付费组件的 DOCX 模板理解引擎。自动解包用户上传的任意 Word 投标模板，构建文档结构树，识别章节、表格、合并单元格、样式、编号、页眉页脚和可填充位置，生成 TemplateSlot，支持简单回写。

这是整个系统最核心、风险最高的技术验证模块。其他所有功能（AI 填充、预览、审查、导出）都建立在正确理解模板结构的基础上。

### E0 用户故事

#### US-E0-001: 上传并解包 DOCX 文件

**描述：** 作为用户，我想上传任意 Word 投标模板（.docx），系统自动解包并提取 WordprocessingML 文档主体，以便后续解析和分析。

**验收标准：**

- [ ] 支持通过 API 上传 .docx 文件，存储到 Supabase Storage
- [ ] 使用 zipfile 解包 DOCX，提取 `word/document.xml`、styles.xml、numbering.xml、页眉页脚等部件
- [ ] 解包失败时返回明确错误信息（非 DOCX 格式、文件损坏等）
- [ ] 在 Document 表中创建记录，document_type = bid_template
- [ ] Typecheck 通过

#### US-E0-002: 构建文档结构树

**描述：** 作为开发者，我需要将 DOCX XML 解析为结构化的 DocumentNode 树，每个节点包含位置路径、文本内容和样式信息，以便上层功能定位和填充。

**验收标准：**

- [ ] 使用 lxml 解析 WordprocessingML，遍历 body 下所有元素
- [ ] 每个节点记录：node_id、node_type（paragraph/table/row/cell/header/footer）、text、location_path、style_json、parent_node_id
- [ ] 正确还原父子关系，支持从根到叶的完整路径
- [ ] style_json 包含字体、字号、加粗、段落样式、编号样式等关键格式信息
- [ ] 页眉页脚作为独立分支纳入结构树
- [ ] Typecheck 通过

#### US-E0-003: 识别章节与标题层级

**描述：** 作为用户，我希望系统自动识别投标模板中的章节结构和标题层级，即使模板没有使用标准 Heading 样式。

**验收标准：**

- [ ] 识别使用标准 Heading 1-6 样式的段落，提取标题文本和层级
- [ ] 对非标准样式的标题，通过字体大小、加粗、编号模式推断层级
- [ ] 输出章节树：章节名称、层级、起始 node_id、子章节列表
- [ ] 生成 section_path（如 `技术标/实施方案/进度计划`）
- [ ] 识别到的章节与 DocumentNode 建立关联
- [ ] Typecheck 通过

#### US-E0-004: 识别表格结构与合并单元格

**描述：** 作为用户，我希望系统识别投标模板中所有表格的结构，包括合并单元格、表头和数据区域。

**验收标准：**

- [ ] 识别所有 `<w:tbl>` 元素，解析行列结构
- [ ] 检测水平合并单元格（`w:gridSpan`）和垂直合并单元格（`w:vMerge`）
- [ ] 对合并单元格记录合并范围和跨越的行列号
- [ ] 识别表头行（根据样式、加粗、首行位置判断）
- [ ] 输出 table_position：表格 ID、行列号、合并单元格信息
- [ ] 表格中每个单元格作为独立 DocumentNode 记录
- [ ] Typecheck 通过

#### US-E0-005: 生成 TemplateSlot 可填充位置

**描述：** 作为系统，我需要自动判断模板中哪些位置需要填充内容，为每个位置生成 TemplateSlot 并标注置信度、依据和策略。

**验收标准：**

- [ ] 识别 slot_type：paragraph、table_cell、placeholder、heading_section、section_append
- [ ] 每个 TemplateSlot 绑定：node_id、location_path、section_path、expected_content_type、style_id、confidence、evidence、fill_strategy
- [ ] 置信度计算：占位符文本 > 0.9；空段落 > 0.7；LLM 语义判断 > 0.5；无法判断 = 0
- [ ] evidence 记录置信度依据（如 `检测到占位符文本'[公司介绍]'`）
- [ ] fill_strategy 明确：replace、append、cell_fill、section_append
- [ ] confidence < 0.5 的位置自动标记为 need_human_confirm
- [ ] Typecheck 通过

#### US-E0-006: LLM 辅助判断章节和表格语义类型

**描述：** 作为系统，我需要通过 LLM 辅助判断每个章节和表格的语义类型，以便后续匹配合适的生成策略。

**验收标准：**

- [ ] 调用 LLM 对章节语义分类：公司介绍、技术方案、实施计划、售后服务、项目案例等
- [ ] 调用 LLM 对表格语义分类：响应表、偏离表、报价表、人员表、案例表等
- [ ] 分类结果写入 TemplateSlot.expected_content_type
- [ ] LLM 分类失败时降级为关键词规则匹配
- [ ] 模型调用记录写入 ModelCallLog
- [ ] Typecheck 通过

#### US-E0-007: 生成未完成项

**描述：** 作为系统，当模板中存在无法判断或无法安全填充的位置时，必须生成 UnfinishedItem，不能静默跳过。

**验收标准：**

- [ ] 触发条件：confidence < 0.3、无法解析的表格结构、嵌套表格、格式不支持
- [ ] 记录 item_type、reason、impact、risk_level、suggested_action
- [ ] 低置信度 TemplateSlot 自动关联 UnfinishedItem
- [ ] UnfinishedItem 按风险等级排序（blocking > high > medium > low）
- [ ] Typecheck 通过

#### US-E0-008: 内容回写与 Word/WPS 兼容验证

**描述：** 作为系统，我需要将内容回写到原始 DOCX 的正确位置，保证生成的文件能正常打开。

**验收标准：**

- [ ] 支持 replace 策略：替换占位符文本，保留原样式
- [ ] 支持 append 策略：段落末尾追加内容，继承段落样式
- [ ] 支持 cell_fill 策略：填充表格单元格文本
- [ ] 回写前自动保存原始模板副本
- [ ] 回写后自动验证：文件可解包、document.xml 结构完整
- [ ] 支持下载回写后的 DOCX 文件
- [ ] Typecheck 通过

### E0 功能需求

**文档解析：**

- **FR-E0-01:** 系统必须支持上传 .docx 格式的投标模板文件
- **FR-E0-02:** 使用 zipfile 解包 DOCX，提取 document.xml、styles.xml、numbering.xml、页眉页脚等
- **FR-E0-03:** 使用 lxml 解析 WordprocessingML，遍历所有段落、表格、run 元素
- **FR-E0-04:** 输出 node_id、node_type、location_path、text、style_json、parent_node_id 的结构化数据

**结构树与章节：**

- **FR-E0-05:** 将 DOCX 内容还原为树形结构（document → body → sections → paragraphs/tables → rows → cells）
- **FR-E0-06:** 每个节点有稳定的 node_id，用于 TemplateSlot 和 AIRevision 的关联定位
- **FR-E0-07:** location_path 必须能反向定位到原始 XML 元素
- **FR-E0-08:** 识别 Heading 1-6 样式标题和非标准样式标题
- **FR-E0-09:** 输出完整的 section_path

**表格与 TemplateSlot：**

- **FR-E0-10:** 识别所有表格元素、行列结构、合并单元格
- **FR-E0-11:** 为每个可填充位置生成 TemplateSlot（slot_type、confidence、evidence、fill_strategy）
- **FR-E0-12:** 占位符文本检测优先级最高，confidence ≥ 0.9
- **FR-E0-13:** confidence < 0.5 的位置标记为 need_human_confirm
- **FR-E0-14:** 无法判断的位置生成 UnfinishedItem，不能跳过

**LLM 与回写：**

- **FR-E0-15:** 可调用 LLM 判断章节类型和表格类型，有规则降级方案
- **FR-E0-16:** 所有 LLM 调用记录到 ModelCallLog
- **FR-E0-17:** 支持 replace、append、cell_fill 三种基础填充策略
- **FR-E0-18:** 回写保留目标位置的原始样式
- **FR-E0-19:** 回写后文件必须能通过 Word/WPS 基本打开校验
- **FR-E0-20:** 回写前自动备份原始模板

### E0 非目标

- 不处理 .doc 格式（旧版 Word 二进制）
- 不支持 PDF 模板解析（E1 招标解析模块负责）
- 不实现 Word 原生 Track Changes（应用层 AIRevision 管理）
- 不实现 HTML 预览（E1 前端负责）
- 不实现 AI 内容生成（E1 章节生成负责）
- 不处理目录（TOC）自动更新
- 不支持加密 DOCX、嵌入对象、图片内容识别
- 不引入 Aspose.Words、OnlyOffice 等付费组件

### E0 成功指标

- 解析完整性：95% 以上的段落和表格被正确识别并纳入结构树
- 章节识别准确率 ≥ 85%（含非标准样式标题）
- 合并单元格检测准确率 ≥ 90%
- 回写后 DOCX 在 Word/WPS 打开成功率 100%
- 解析 100 页内模板耗时 < 30 秒

### E0 未决问题

- 目录（TOC）回写后更新依赖 Word 客户端，作为已知限制记录
- 编号列表（`w:numPr`）的回写继承策略需验证
- 页眉页脚 P0 只做识别还是也做填充？
- LLM 章节分类：P0 先用规则还是直接上 LLM？

---

## Epic 1: P1 — 单项目闭环 MVP

### E1 目标

跑通一个真实投标项目的端到端流程。支持项目管理、招标文件解析、模板原位填充、AIRevision 生成与采纳、未完成项展示、基础审查和 DOCX 导出。

### E1 用户故事

#### US-E1-001: 项目创建与文件管理

**描述：** 作为用户，我想创建投标项目并上传招标文件、公司资料和投标模板，以便系统基于这些材料工作。

**验收标准：**

- [ ] 项目列表页：展示项目名称、招标单位、截止时间、状态、进度
- [ ] 新建项目表单：项目名称、招标单位、行业、项目类型、截止时间
- [ ] 文件上传区：支持上传招标文件（PDF/Word）、公司资料（PDF/Word）、投标模板（.docx）
- [ ] 文件上传后自动创建 Document 记录，关联到项目
- [ ] 上传进度和失败重试
- [ ] Typecheck 通过
- [ ] **[UI]** 在浏览器中验证项目创建和文件上传流程

#### US-E1-002: 招标文件解析

**描述：** 作为用户，我希望系统自动解析上传的招标文件，提取关键要求、评分标准和废标项。

**验收标准：**

- [ ] 支持 PDF 招标文件解析（pdfplumber + pypdf，扫描件可选 PaddleOCR）
- [ ] 支持 Word 招标文件解析
- [ ] 提取输出：项目名称、招标单位、招标范围、截止时间
- [ ] 提取输出：商务要求、技术要求、评分标准、废标项、资质要求
- [ ] 提取输出：交付要求、服务要求、格式要求、附件清单
- [ ] 自动标记强制性要求和废标风险
- [ ] 生成 Requirement 记录，含 requirement_type、priority、risk_level、is_mandatory
- [ ] 解析结果在前端展示，支持人工修正和补充
- [ ] Typecheck 通过
- [ ] **[UI]** 在浏览器中验证招标解析结果展示和人工编辑

#### US-E1-003: 标书任务拆解

**描述：** 作为用户，我希望系统根据招标要求和投标模板自动拆解标书制作任务清单。

**验收标准：**

- [ ] 自动生成任务清单，任务类型覆盖：商务标、技术标、报价、资质材料、项目案例、人员材料、售后服务、偏离表、响应表、格式检查
- [ ] 每个任务绑定关联招标要求（related_requirement_ids）
- [ ] 每个任务标注负责人类型（ai / human / ai_then_human / human_required）
- [ ] 任务含优先级（高/中/低）和状态
- [ ] 敏感任务（报价、资质、承诺）默认标记为 human_required
- [ ] 前端展示任务看板，支持筛选、认领和状态更新
- [ ] Typecheck 通过
- [ ] **[UI]** 在浏览器中验证任务看板

#### US-E1-004: 模板原位填充与 AIRevision 生成

**描述：** 作为用户，我希望 AI 基于招标要求和公司资料，在投标模板的正确位置生成填充内容，但不直接修改最终稿。

**验收标准：**

- [ ] 接收 E0 的 TemplateSlot 列表作为填充目标
- [ ] 根据 TemplateSlot 的 expected_content_type 和 section_path 匹配招标要求
- [ ] 调用 LLM 生成 AIRevision（含 revision_type、before_content、ai_content、comment）
- [ ] AIRevision 绑定 TemplateSlot（template_slot_id）、招标要求（source_requirement_ids）和资料来源（source_knowledge_ids）
- [ ] 每条 AIRevision 标注 risk_level 和 confidence
- [ ] 涉及资质、报价、案例、承诺的内容 risk_level 自动为 high，状态为 need_human_confirm
- [ ] 无法填充的位置生成 UnfinishedItem
- [ ] 模型调用记录写入 ModelCallLog（scenario = generation）
- [ ] Typecheck 通过

#### US-E1-005: AI 编辑预览——章节树与 HTML 预览

**描述：** 作为用户，我想在前端以章节树和 HTML 格式预览 AI 在模板中的编辑内容，清晰区分原始内容和 AI 修订。

**验收标准：**

- [ ] 使用 mammoth 将 DOCX 转为 HTML 预览基础
- [ ] 左侧章节树导航：点击章节跳转到对应预览位置
- [ ] HTML 预览中原模板内容和 AI 新增内容有明显视觉区分（高亮/边框/背景色）
- [ ] 每条 AIRevision 在预览中位置可定位和高亮
- [ ] 批注说明展示：AI 修改原因、引用来源、关联招标要求
- [ ] 表格中 AI 填充的单元格高亮
- [ ] Typecheck 通过
- [ ] **[UI]** 在浏览器中验证章节树导航和 HTML 预览高亮

#### US-E1-006: AIRevision 采纳与拒绝

**描述：** 作为用户，我想逐条或批量处理 AI 修改，就像审阅 Word 修订一样。

**验收标准：**

- [ ] 侧边栏 AI 修订列表：按章节分组，展示每条修订的状态、类型和风险等级
- [ ] 单条操作：接受、拒绝、编辑后接受、标记待确认
- [ ] 批量操作：批量接受低风险修改、批量拒绝不适用修改
- [ ] 人工编辑后接受：弹出编辑框，用户修改 ai_content 后保存为 edited_then_accepted
- [ ] 状态实时更新到 AIRevision 表
- [ ] 操作记录写入 AuditLog（action = accept_revision / reject_revision / edit_revision）
- [ ] Typecheck 通过
- [ ] **[UI]** 在浏览器中验证修订列表和接受/拒绝操作

#### US-E1-007: 未完成项清单与处理

**描述：** 作为用户，我想看到系统无法自动处理的模板位置及原因，并能补充资料后重新生成。

**验收标准：**

- [ ] 侧边栏未完成清单：按风险等级分组，展示原因和建议动作
- [ ] 未完成位置在 HTML 预览中醒目标记（红色边框/警告图标）
- [ ] 筛选：按风险等级、章节、类型、责任人
- [ ] 补充资料入口：上传文件后触发重新生成该位置的 AIRevision
- [ ] 用户可手动填写内容并记录为经验
- [ ] 未完成项状态可更新（pending / resolved / ignored）
- [ ] Typecheck 通过
- [ ] **[UI]** 在浏览器中验证未完成项展示和补充资料流程

#### US-E1-008: 基础响应性检查

**描述：** 作为用户，我希望在导出前检查招标要求是否都已响应。

**验收标准：**

- [ ] 建立招标要求与 AIRevision/SectionContent 的响应矩阵
- [ ] 检查：每个 Requirement 是否有对应的 AIRevision 或人工内容
- [ ] 检查：废标项是否全部满足
- [ ] 输出检查结果：PASS / FAIL / WARNING
- [ ] FAIL 项展示问题说明和建议
- [ ] 有 FAIL 项时警告用户但仍允许导出（blocking 级别除外）
- [ ] Typecheck 通过
- [ ] **[UI]** 在浏览器中验证检查结果

#### US-E1-009: DOCX 导出

**描述：** 作为用户，我想将采纳后的内容合成为最终 DOCX 投标文件并下载。

**验收标准：**

- [ ] 仅合成 status = accepted 或 edited_then_accepted 的 AIRevision
- [ ] 从原始模板出发，逐个应用回写操作
- [ ] 导出前检查：有 blocking 级别 UnfinishedItem 时阻断导出并提示
- [ ] 导出格式：.docx
- [ ] 生成 DocumentVersion 记录（version_type = export）
- [ ] 导出文件存储到 Supabase Storage
- [ ] 支持下载
- [ ] 导出记录写入 ExportRecord
- [ ] Typecheck 通过
- [ ] **[UI]** 在浏览器中验证导出流程

### E1 功能需求

**项目管理：**

- **FR-E1-01:** 支持创建、编辑、删除和列表展示投标项目
- **FR-E1-02:** 支持上传招标文件（PDF/Word）、公司资料、投标模板

**招标解析：**

- **FR-E1-03:** 自动提取招标要求、评分标准、废标项和格式要求
- **FR-E1-04:** 提取结果支持人工修正和补充
- **FR-E1-05:** 自动标记强制性要求和废标风险

**任务拆解：**

- **FR-E1-06:** 自动生成标书任务清单，绑定招标要求
- **FR-E1-07:** 敏感任务（报价、资质、承诺）默认 human_required

**AI 填充：**

- **FR-E1-08:** AI 生成内容必须形成 AIRevision，不直接写入最终稿
- **FR-E1-09:** AIRevision 必须绑定 TemplateSlot、招标要求和资料来源
- **FR-E1-10:** 无法填充时生成 UnfinishedItem

**前端预览与采纳：**

- **FR-E1-11:** 章节树导航 + HTML 预览 + AI 修订高亮
- **FR-E1-12:** 支持接受、拒绝、编辑后接受、标记待确认
- **FR-E1-13:** 所有采纳操作写入 AuditLog

**未完成项：**

- **FR-E1-14:** 未完成项在前端醒目展示，支持补充资料和手动填写

**审查与导出：**

- **FR-E1-15:** 基础响应矩阵检查（PASS/FAIL/WARNING）
- **FR-E1-16:** 采纳后的 AIRevision 合成最终 DOCX
- **FR-E1-17:** blocking 级别未完成项阻断导出
- **FR-E1-18:** 导出记录写入 ExportRecord

### E1 非目标

- 不做知识库 RAG 检索（E2）
- 不做 diff 经验沉淀和复用（E2）
- 不做深度审查（废标检查、资质验证、格式检查）
- 不做 RBAC 和 Tenant 隔离
- 不做多智能体协作
- 不引入 Word 原生 Track Changes
- 不引入 OnlyOffice 在线编辑器
- 不生成 PDF 导出（仅 DOCX）

### E1 成功指标

- 标书初稿生成时间减少 50% 以上
- 招标要求整理时间减少 70% 以上
- 招标要求响应覆盖率 ≥ 95%
- 废标项漏检率 < 3%

### E1 未决问题

- HTML 预览对复杂表格的还原度有限，是否需要标注"以 Word 为准"？
- 大批量 AIRevision（> 100 条）时的前端性能策略？
- 用户中途退出采纳流程的断点续接？

---

## Epic 2: P2 — 知识库与经验增强

### E2 目标

建立公司资料、历史标书、案例、资质和人工 diff 经验库。通过 RAG 检索为 AI 内容生成提供可信依据，通过 diff 归因和经验沉淀让系统越用越聪明。

### E2 用户故事

#### US-E2-001: 公司知识库文档索引

**描述：** 作为用户，我想将公司资料结构化导入知识库，以便 AI 生成标书时引用真实材料。

**验收标准：**

- [ ] 支持上传/导入公司资料：Word、PDF、文本
- [ ] 文档自动切片（DocumentChunk），按章节/段落/表格边界
- [ ] 切片类型标注：正文、表格、案例、资质、经验
- [ ] 切片元数据：行业、章节类型、项目类型、客户类型
- [ ] 切片向量化存储（Supabase pgvector + embedding）
- [ ] 知识库管理页：浏览、搜索、删除、重新索引
- [ ] Typecheck 通过
- [ ] **[UI]** 在浏览器中验证知识库管理

#### US-E2-002: RAG 检索与 Citation 追踪

**描述：** 作为系统，AI 生成标书内容时自动检索相关知识片段，并为每段生成内容提供可追溯的证据引用。

**验收标准：**

- [ ] 混合检索：向量检索（语义相似）+ 关键词检索（Postgres FTS）+ 元数据过滤
- [ ] 检索范围：公司资料、历史标书、中标案例、服务承诺模板
- [ ] 按行业、章节类型、客户类型过滤
- [ ] rerank 候选结果
- [ ] 过滤过期资质和不可用案例
- [ ] 每条生成内容携带 Citation：来源文档、章节、段落、可信度
- [ ] 前端可点击 Citation 查看来源原文
- [ ] Typecheck 通过
- [ ] **[UI]** 在浏览器中验证检索结果展示和 Citation 链接

#### US-E2-003: 人工修改 diff 记录

**描述：** 作为系统，用户每次修改 AI 内容时自动记录修改前后的差异。

**验收标准：**

- [ ] 用户编辑 AIRevision 内容并保存后，自动生成 EditDiff 记录
- [ ] 记录内容：before_text、after_text、diff_text、edit_type、edit_reason
- [ ] 记录位置：section_content_id、related_requirement_ids
- [ ] 记录上下文：editor_id、accepted、used_in_final
- [ ] edit_type 分类：polish、supplement、delete、compliance_fix、format_fix、risk_control、customer_customization、qualification_fix、case_replacement、technical_enhancement、business_adjustment
- [ ] Typecheck 通过

#### US-E2-004: diff 自动分类与归因

**描述：** 作为系统，我需要自动分析人工修改的意图和类型，判断是否适合沉淀为经验。

**验收标准：**

- [ ] 调用 LLM 分析每一条 EditDiff：改了什么、为什么改、属于哪种类型
- [ ] 判断修改的通用性：仅当前项目特殊要求 vs 可复用经验
- [ ] 判断适用范围：公司通用 / 行业通用 / 客户特定
- [ ] 输出建议：是否适合入库为经验
- [ ] 模型调用记录写入 ModelCallLog（scenario = diff_attribution）
- [ ] Typecheck 通过

#### US-E2-005: 经验入库与人工确认

**描述：** 作为用户，我想审阅系统推荐的经验并决定是否入库。

**验收标准：**

- [ ] 经验推荐列表：展示 diff 原文、AI 分析、建议适用范围
- [ ] 用户确认：保存为经验 / 仅当前项目 / 不保存
- [ ] 确认时设置：experience_type、applicable_industry、applicable_section_type、applicable_customer_type
- [ ] 区分公司通用经验、行业经验、客户特殊经验
- [ ] 未中标项目经验自动降低权重
- [ ] 经验版本管理：同一经验多次修改时保留历史版本
- [ ] Typecheck 通过
- [ ] **[UI]** 在浏览器中验证经验确认流程

#### US-E2-006: 经验复用——新项目生成增强

**描述：** 作为系统，生成新标书时自动检索相似历史经验，优化 AI 初稿质量。

**验收标准：**

- [ ] 新项目生成时自动检索：相似项目、相似章节、相似招标要求、相似人工修改
- [ ] 检索中标项目的优秀表述，提高权重
- [ ] 将相关经验注入 LLM 生成提示词
- [ ] 经验复用记录追踪：哪些经验被引用、用户是否修改
- [ ] 用户可在侧边栏查看每条生成内容引用的经验
- [ ] Typecheck 通过

#### US-E2-007: 相似案例与章节推荐

**描述：** 作为用户，在制作新标书时，我想看到相似历史项目的中标章节和案例作为参考。

**验收标准：**

- [ ] 在内容生成页面侧边栏展示"相似历史内容"
- [ ] 推荐维度：同行业、同客户类型、同章节、中标项目
- [ ] 点击推荐项可查看原文
- [ ] 支持一键引用历史内容（生成 AIRevision 并标注来源）
- [ ] Typecheck 通过
- [ ] **[UI]** 在浏览器中验证相似推荐功能

### E2 功能需求

**知识库建设：**

- **FR-E2-01:** 支持上传公司资料、历史标书、案例、产品文档并自动切片
- **FR-E2-02:** 切片向量化存储，支持元数据过滤
- **FR-E2-03:** 支持知识库的浏览、搜索和管理

**RAG 检索：**

- **FR-E2-04:** 混合检索（向量 + 关键词 + 元数据过滤）
- **FR-E2-05:** 检索结果必须携带来源文档、章节、可信度
- **FR-E2-06:** 过滤过期资质和不可用案例

**diff 与经验：**

- **FR-E2-07:** 每次人工修改自动生成 EditDiff
- **FR-E2-08:** LLM 自动分析 diff 并推荐入库
- **FR-E2-09:** 经验入库需人工确认，区分适用范围
- **FR-E2-10:** 未中标项目经验降低权重

**复用：**

- **FR-E2-11:** 生成新内容时自动检索相似历史经验和案例
- **FR-E2-12:** Citation 在前端可点击追溯来源

### E2 非目标

- 不进行模型微调（优先通过 RAG + Prompt + 经验库提升质量）
- 不引入 OpenSearch、Redis 等额外基础设施
- 不做自动经验学习（所有经验入库需人工确认）
- 不做跨项目知识图谱

### E2 成功指标

- 人工修改率逐步下降（同类章节）
- 每个项目可沉淀有效修改经验
- 中标项目优秀内容被复用率逐步提升
- 相似项目生成质量逐步提升

### E2 未决问题

- 经验权重衰减策略：多久未复用的经验应降权？
- 资质类资料有效期管理：过期后自动标记还是人工复核？
- 知识库是否需要按部门/团队隔离？



---

## 跨阶段（Cross-Cutting）数据模型

以下数据模型贯穿各 Epic，按引入阶段标注：

| 模型            | 引入阶段 | 说明                           |
| --------------- | -------- | ------------------------------ |
| Project         | E1       | 投标项目                       |
| Document        | E0       | 文档（模板/招标文件/公司资料） |
| DocumentNode    | E0       | DOCX 结构树节点                |
| DocumentVersion | E1       | 文档版本                       |
| DocumentChunk   | E2       | 知识库切片                     |
| TemplateSlot    | E0       | 模板可填充位置                 |
| Requirement     | E1       | 招标要求                       |
| BidTask         | E1       | 标书制作任务                   |
| SectionContent  | E1       | 章节内容                       |
| AIRevision      | E1       | AI 修订记录                    |
| UnfinishedItem  | E0       | 未完成项                       |
| EditDiff        | E1       | 人工修改 diff（E2 增强归因）   |
| Experience      | E2       | 经验库                         |
| Citation        | E2       | 证据引用                       |
| AuditLog        | E1       | 操作审计日志                   |
| ModelCallLog    | E0       | 模型调用日志                   |
| TaskRun         | E1       | 后台任务                       |
| ExportRecord    | E1       | 导出记录                       |

---

## 系统架构

```
前端层（Next.js + React + Ant Design Pro）
  ├── Cloudflare Pages 托管
  ├── 章节树、HTML 预览、AIRevision 高亮、未完成项侧边栏
  └── 项目/任务/知识库管理页
         │
         ▼ REST API
         │
后端层（FastAPI + Docker）
  ├── api/          API 路由
  ├── core/         配置、依赖注入
  ├── models/       数据模型
  ├── services/
  │   ├── docx_parser/    E0: DOCX 模板理解引擎
  │   ├── tender/         E1: 招标解析
  │   ├── generation/     E1: 内容生成与 AIRevision
  │   ├── rag/            E2: 知识检索与 Citation
  │   └── experience/     E2: 经验沉淀与复用
  └── gateway/      Model Gateway（LLM 统一接入）
         │
         ▼
Supabase 数据层
  ├── Auth        用户认证
  ├── Postgres    业务数据、任务状态
  ├── pgvector    向量检索（知识库、经验库）
  └── Storage     文件存储（招标文件、模板、导出稿）
```

### 技术栈

| 层次      | 技术                                          | 用途                          |
| --------- | --------------------------------------------- | ----------------------------- |
| 前端      | Next.js + React + TypeScript + Ant Design Pro | UI 框架                       |
| 前端部署  | Cloudflare Pages                              | 托管、CDN、HTTPS              |
| 后端      | Python FastAPI + Docker                       | API 服务                      |
| 数据库    | Supabase Postgres                             | 业务数据                      |
| 认证      | Supabase Auth                                 | 用户认证                      |
| 向量检索  | Supabase pgvector                             | 知识库和经验检索              |
| 文件存储  | Supabase Storage                              | 文件管理                      |
| DOCX 解析 | zipfile + lxml + python-docx + docx2python    | 模板理解引擎                  |
| DOCX 预览 | mammoth + 自研章节树                          | 前端预览                      |
| DOCX 回写 | python-docx + lxml XML 级回写                 | 保留原始格式                  |
| PDF 解析  | pdfplumber + pypdf + PaddleOCR                | 招标文件解析                  |
| RAG       | LlamaIndex 或轻量自研                         | 知识检索和引用追踪            |
| 模型接入  | 自研 Model Gateway                            | 统一接入 DeepSeek/通义/OpenAI |

---

## 风险与应对

| 风险                                  | 等级 | 应对                                                                                     |
| ------------------------------------- | ---- | ---------------------------------------------------------------------------------------- |
| LLM 幻觉：编造资质、案例、技术能力    | 高   | 所有资质/案例/承诺必须绑定来源；无来源内容标记人工确认；不直接进入最终稿                 |
| 招标要求漏项                          | 高   | 建立要求清单和响应矩阵；废标项未完成阻断导出                                             |
| diff 学错：单项目修改被泛化为通用经验 | 中   | 经验入库需人工确认；区分公司/行业/客户适用范围；未中标项目降低权重                       |
| 模板格式复杂导致解析或回写失败        | 高   | 直接解析 XML；每个 TemplateSlot 有置信度；低置信度不自动写入；保留模板副本               |
| 数据安全：招标、资质、报价泄露        | 高   | 项目级访问控制；操作审计；模型调用脱敏；必要时使用私有化模型                              |
| AI 填错模板位置                       | 中   | TemplateSlot 模型绑定位置；填充带置信度；低置信度进入待确认；无法填充生成 UnfinishedItem |
| 成本失控                              | 中   | ModelCallLog 全量记录；按项目/场景统计成本；预算预警                                     |

---

## 建设顺序与依赖

```
E0 (P0) ──► E1 (P1) ──► E2 (P2)
模板引擎    闭环 MVP   知识库经验
3-6 周      6-10 周    4-8 周

依赖关系：
  E1 依赖 E0（模板引擎是填充和预览的基础）
  E2 依赖 E1（需要有人工修改数据才能沉淀经验）
```

---

## 参考

- 完整技术方案与数据模型定义：`plan.md`
- WordprocessingML 规范：[ECMA-376 Office Open XML](https://www.ecma-international.org/publications-and-standards/standards/ecma-376/)
