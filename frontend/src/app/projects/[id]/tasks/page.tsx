'use client';

import { useEffect, useState } from 'react';
import {
	Card,
	Tag,
	Button,
	Space,
	Spin,
	Empty,
	Select,
	Modal,
	Descriptions,
	List,
	Typography,
	Tooltip,
	message,
	Segmented,
	Table,
} from 'antd';
import {
	ArrowLeftOutlined,
	ReloadOutlined,
	UserOutlined,
	RobotOutlined,
	TeamOutlined,
	SafetyOutlined,
} from '@ant-design/icons';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import type { BidTaskDBItem } from '@/lib/types/bid_task';
import {
	TASK_TYPE_LABELS,
	TASK_TYPE_COLORS,
	ASSIGNEE_TYPE_LABELS,
	ASSIGNEE_TYPE_COLORS,
	STATUS_LABELS,
	STATUS_COLORS,
	PRIORITY_LABELS,
	PRIORITY_COLORS,
	TASK_TYPE_OPTIONS,
	ASSIGNEE_TYPE_OPTIONS,
	PRIORITY_OPTIONS,
	KANBAN_COLUMNS,
} from '@/lib/types/bid_task';
import type { RequirementDBItem } from '@/lib/types/requirement';
import { REQUIREMENT_TYPE_LABELS } from '@/lib/types/requirement';
import type { Project } from '@/lib/types/project';

const { Title, Text, Paragraph } = Typography;

const ASSIGNEE_ICON: Record<string, React.ReactNode> = {
	ai: <RobotOutlined />,
	human: <UserOutlined />,
	ai_then_human: <TeamOutlined />,
	human_required: <SafetyOutlined />,
};

export default function TaskKanbanPage() {
	const { id } = useParams<{ id: string }>();
	const router = useRouter();

	const [project, setProject] = useState<Project | null>(null);
	const [tasks, setTasks] = useState<BidTaskDBItem[]>([]);
	const [requirements, setRequirements] = useState<RequirementDBItem[]>([]);
	const [loading, setLoading] = useState(true);

	// 筛选
	const [filterType, setFilterType] = useState<string | null>(null);
	const [filterPriority, setFilterPriority] = useState<string | null>(null);
	const [filterAssignee, setFilterAssignee] = useState<string | null>(null);

	// 视图切换
	const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');

	// 拖拽状态
	const [dragTaskId, setDragTaskId] = useState<string | null>(null);

	// 详情 Modal
	const [detailOpen, setDetailOpen] = useState(false);
	const [detailTask, setDetailTask] = useState<BidTaskDBItem | null>(null);

	useEffect(() => {
		let cancelled = false;
		const loadAll = async () => {
			setLoading(true);
			try {
				const [projectData, taskData, reqData] = await Promise.all([
					api.get<Project>(`/api/projects/${id}`),
					api.get<BidTaskDBItem[]>(`/api/projects/${id}/tasks`),
					api.get<RequirementDBItem[]>(
						`/api/projects/${id}/requirements`,
					),
				]);
				if (!cancelled) {
					setProject(projectData);
					setTasks(taskData);
					setRequirements(
						reqData.filter((r) => r.status !== 'ignored'),
					);
				}
			} catch {
				if (!cancelled) message.error('加载数据失败');
			} finally {
				if (!cancelled) setLoading(false);
			}
		};
		loadAll();
		return () => {
			cancelled = true;
		};
	}, [id]);

	const handleRefresh = async () => {
		setLoading(true);
		try {
			const [taskData, reqData] = await Promise.all([
				api.get<BidTaskDBItem[]>(`/api/projects/${id}/tasks`),
				api.get<RequirementDBItem[]>(
					`/api/projects/${id}/requirements`,
				),
			]);
			setTasks(taskData);
			setRequirements(reqData.filter((r) => r.status !== 'ignored'));
		} catch {
			message.error('刷新失败');
		} finally {
			setLoading(false);
		}
	};
	const updateTaskStatus = async (taskId: string, status: string) => {
		try {
			await api.patch(`/api/projects/${id}/tasks/${taskId}`, { status });
			setTasks((prev) =>
				prev.map((t) => (t.id === taskId ? { ...t, status } : t)),
			);
			message.success('状态已更新');
		} catch {
			message.error('更新失败');
		}
	};

	// ── 拖拽处理 ──────────────────────────────────────────────────

	const handleDragStart = (taskId: string) => {
		setDragTaskId(taskId);
	};

	const handleDragOver = (e: React.DragEvent) => {
		e.preventDefault();
		e.dataTransfer.dropEffect = 'move';
	};

	const handleDrop = (status: string) => {
		setDragTaskId(null);
		if (dragTaskId) {
			const task = tasks.find((t) => t.id === dragTaskId);
			if (task && task.status !== status) {
				updateTaskStatus(dragTaskId, status);
			}
		}
	};

	// ── 任务卡片 ──────────────────────────────────────────────────

	const renderTaskCard = (task: BidTaskDBItem) => {
		const reqCount = task.related_requirement_ids?.length || 0;
		const isDragging = dragTaskId === task.id;

		return (
			<Card
				key={task.id}
				size="small"
				style={{
					marginBottom: 8,
					cursor: 'grab',
					opacity: isDragging ? 0.4 : 1,
					borderColor: isDragging ? '#1677ff' : undefined,
				}}
				draggable
				onDragStart={() => handleDragStart(task.id)}
				onDragEnd={() => setDragTaskId(null)}
				onClick={() => {
					setDetailTask(task);
					setDetailOpen(true);
				}}
				hoverable
			>
				<Space direction="vertical" size={4} style={{ width: '100%' }}>
					<Text strong style={{ fontSize: 13 }}>
						{task.title}
					</Text>
					<Space wrap size={4}>
						<Tag
							color={
								TASK_TYPE_COLORS[task.task_type] || 'default'
							}
						>
							{TASK_TYPE_LABELS[task.task_type] || task.task_type}
						</Tag>
						<Tag color={PRIORITY_COLORS[task.priority]}>
							{PRIORITY_LABELS[task.priority]}
						</Tag>
					</Space>
					<Space size={12}>
						<Tooltip
							title={ASSIGNEE_TYPE_LABELS[task.assignee_type]}
						>
							<span style={{ fontSize: 12, color: '#888' }}>
								{ASSIGNEE_ICON[task.assignee_type]}{' '}
								{task.assignee ||
									ASSIGNEE_TYPE_LABELS[task.assignee_type]}
							</span>
						</Tooltip>
						{reqCount > 0 && (
							<Text type="secondary" style={{ fontSize: 11 }}>
								{reqCount} 条要求
							</Text>
						)}
					</Space>
				</Space>
			</Card>
		);
	};

	// ── 筛选 ──────────────────────────────────────────────────────

	const filteredTasks = tasks.filter((t) => {
		if (filterType && t.task_type !== filterType) return false;
		if (filterPriority && t.priority !== filterPriority) return false;
		if (filterAssignee && t.assignee_type !== filterAssignee) return false;
		return true;
	});

	const groupedTasks: Record<string, BidTaskDBItem[]> = {
		pending: [],
		in_progress: [],
		completed: [],
	};
	for (const t of filteredTasks) {
		if (groupedTasks[t.status]) {
			groupedTasks[t.status].push(t);
		}
	}

	// ── 详情 Modal ────────────────────────────────────────────────

	const taskRequirements = detailTask?.related_requirement_ids
		?.map((rid) => requirements.find((r) => r.id === rid))
		.filter(Boolean) as RequirementDBItem[] | undefined;

	// ── 渲染 ──────────────────────────────────────────────────────

	if (loading) {
		return (
			<div style={{ textAlign: 'center', padding: 80 }}>
				<Spin size="large" />
			</div>
		);
	}

	if (!project) {
		return <Text type="secondary">项目不存在或已被删除</Text>;
	}

	const filterBar = (
		<Space wrap style={{ marginBottom: 16 }}>
			<Select
				allowClear
				placeholder="任务类型"
				style={{ width: 130 }}
				value={filterType}
				onChange={setFilterType}
				options={TASK_TYPE_OPTIONS}
			/>
			<Select
				allowClear
				placeholder="优先级"
				style={{ width: 100 }}
				value={filterPriority}
				onChange={setFilterPriority}
				options={PRIORITY_OPTIONS}
			/>
			<Select
				allowClear
				placeholder="负责人类型"
				style={{ width: 130 }}
				value={filterAssignee}
				onChange={setFilterAssignee}
				options={ASSIGNEE_TYPE_OPTIONS}
			/>
			<Segmented
				options={[
					{ value: 'kanban', label: '看板' },
					{ value: 'list', label: '列表' },
				]}
				value={viewMode}
				onChange={(val) => setViewMode(val as 'kanban' | 'list')}
			/>
			<Button
				icon={<ReloadOutlined />}
				onClick={handleRefresh}
				size="small"
			>
				刷新
			</Button>
		</Space>
	);

	const noTasks = tasks.length === 0;

	return (
		<div>
			<Space style={{ marginBottom: 16 }}>
				<Button
					type="text"
					icon={<ArrowLeftOutlined />}
					onClick={() => router.push(`/projects/${id}`)}
				>
					返回项目
				</Button>
			</Space>

			<Title level={4} style={{ marginBottom: 16 }}>
				{project.name} — 任务看板
			</Title>

			{noTasks ? (
				<>
					{filterBar}
					<Empty description="暂无任务，请先在招标要求中触发任务拆解" />
				</>
			) : (
				<>
					{filterBar}

					{viewMode === 'kanban' ? (
						<div
							style={{
								display: 'grid',
								gridTemplateColumns: 'repeat(3, 1fr)',
								gap: 16,
							}}
						>
							{KANBAN_COLUMNS.map((col) => {
								const colTasks = groupedTasks[col.key];
								return (
									<div
										key={col.key}
										onDragOver={handleDragOver}
										onDrop={() => handleDrop(col.key)}
										style={{
											background: '#f5f5f5',
											borderRadius: 8,
											padding: 12,
											minHeight: 300,
										}}
									>
										<div
											style={{
												marginBottom: 12,
												display: 'flex',
												justifyContent: 'space-between',
												alignItems: 'center',
											}}
										>
											<Space>
												<Tag
													color={
														STATUS_COLORS[col.key]
													}
												>
													{col.title}
												</Tag>
												<Text
													type="secondary"
													style={{ fontSize: 12 }}
												>
													{colTasks.length}
												</Text>
											</Space>
										</div>
										{colTasks.length === 0 ? (
											<Text
												type="secondary"
												style={{
													fontSize: 12,
													display: 'block',
													textAlign: 'center',
													padding: 24,
												}}
											>
												拖拽任务到此处
											</Text>
										) : (
											colTasks.map(renderTaskCard)
										)}
									</div>
								);
							})}
						</div>
					) : (
						<Table
							dataSource={filteredTasks}
							rowKey="id"
							size="small"
							pagination={false}
							columns={[
								{
									title: '任务',
									dataIndex: 'title',
									key: 'title',
									render: (
										title: string,
										record: BidTaskDBItem,
									) => (
										<a
											onClick={() => {
												setDetailTask(record);
												setDetailOpen(true);
											}}
										>
											{title}
										</a>
									),
								},
								{
									title: '类型',
									dataIndex: 'task_type',
									key: 'task_type',
									width: 100,
									render: (t: string) => (
										<Tag
											color={
												TASK_TYPE_COLORS[t] || 'default'
											}
										>
											{TASK_TYPE_LABELS[t] || t}
										</Tag>
									),
								},
								{
									title: '优先级',
									dataIndex: 'priority',
									key: 'priority',
									width: 80,
									render: (p: string) => (
										<Tag color={PRIORITY_COLORS[p]}>
											{PRIORITY_LABELS[p]}
										</Tag>
									),
								},
								{
									title: '负责人',
									dataIndex: 'assignee_type',
									key: 'assignee_type',
									width: 120,
									render: (
										a: string,
										record: BidTaskDBItem,
									) => (
										<Space size={4}>
											<Tag
												color={ASSIGNEE_TYPE_COLORS[a]}
											>
												{ASSIGNEE_ICON[a]}{' '}
												{ASSIGNEE_TYPE_LABELS[a]}
											</Tag>
											{record.assignee && (
												<Text
													type="secondary"
													style={{ fontSize: 12 }}
												>
													{record.assignee}
												</Text>
											)}
										</Space>
									),
								},
								{
									title: '状态',
									dataIndex: 'status',
									key: 'status',
									width: 100,
									render: (s: string) => (
										<Tag color={STATUS_COLORS[s]}>
											{STATUS_LABELS[s]}
										</Tag>
									),
								},
								{
									title: '关联要求',
									dataIndex: 'related_requirement_ids',
									key: 'related_requirement_ids',
									width: 90,
									render: (ids: string[]) => (
										<Text type="secondary">
											{ids?.length || 0} 条
										</Text>
									),
								},
								{
									title: '操作',
									key: 'actions',
									width: 160,
									render: (
										_: unknown,
										record: BidTaskDBItem,
									) => (
										<Space size={4}>
											{record.status !== 'pending' && (
												<Button
													size="small"
													type="link"
													onClick={() =>
														updateTaskStatus(
															record.id,
															'pending',
														)
													}
												>
													退回
												</Button>
											)}
											{record.status !==
												'in_progress' && (
												<Button
													size="small"
													type="link"
													onClick={() =>
														updateTaskStatus(
															record.id,
															'in_progress',
														)
													}
												>
													开始
												</Button>
											)}
											{record.status !== 'completed' && (
												<Button
													size="small"
													type="link"
													onClick={() =>
														updateTaskStatus(
															record.id,
															'completed',
														)
													}
												>
													完成
												</Button>
											)}
										</Space>
									),
								},
							]}
						/>
					)}
				</>
			)}

			{/* 详情 Modal */}
			<Modal
				title={detailTask?.title}
				open={detailOpen}
				onCancel={() => {
					setDetailOpen(false);
					setDetailTask(null);
				}}
				footer={null}
				width={640}
				destroyOnHidden
			>
				{detailTask && (
					<div>
						<Descriptions
							size="small"
							column={2}
							style={{ marginBottom: 16 }}
						>
							<Descriptions.Item label="任务类型">
								<Tag
									color={
										TASK_TYPE_COLORS[
											detailTask.task_type
										] || 'default'
									}
								>
									{TASK_TYPE_LABELS[detailTask.task_type] ||
										detailTask.task_type}
								</Tag>
							</Descriptions.Item>
							<Descriptions.Item label="优先级">
								<Tag
									color={PRIORITY_COLORS[detailTask.priority]}
								>
									{PRIORITY_LABELS[detailTask.priority]}
								</Tag>
							</Descriptions.Item>
							<Descriptions.Item label="当前状态">
								<Tag color={STATUS_COLORS[detailTask.status]}>
									{STATUS_LABELS[detailTask.status]}
								</Tag>
							</Descriptions.Item>
							<Descriptions.Item label="负责人类型">
								<Tag
									color={
										ASSIGNEE_TYPE_COLORS[
											detailTask.assignee_type
										]
									}
								>
									{ASSIGNEE_ICON[detailTask.assignee_type]}{' '}
									{
										ASSIGNEE_TYPE_LABELS[
											detailTask.assignee_type
										]
									}
								</Tag>
							</Descriptions.Item>
							<Descriptions.Item label="模板位置" span={2}>
								{detailTask.section_path || '未指定'}
							</Descriptions.Item>
							<Descriptions.Item label="负责人" span={2}>
								{detailTask.assignee || '未指定'}
							</Descriptions.Item>
						</Descriptions>

						<div style={{ marginBottom: 12 }}>
							<Text strong>变更状态：</Text>
							<Space style={{ marginLeft: 8 }}>
								{(
									[
										'pending',
										'in_progress',
										'completed',
									] as const
								).map((s) => (
									<Button
										key={s}
										size="small"
										type={
											detailTask.status === s
												? 'primary'
												: 'default'
										}
										onClick={() => {
											updateTaskStatus(detailTask.id, s);
											setDetailTask({
												...detailTask,
												status: s,
											});
										}}
									>
										{STATUS_LABELS[s]}
									</Button>
								))}
							</Space>
						</div>

						{taskRequirements && taskRequirements.length > 0 && (
							<Card
								title={`关联招标要求（${taskRequirements.length} 条）`}
								size="small"
							>
								<List
									size="small"
									dataSource={taskRequirements}
									renderItem={(item) => (
										<List.Item>
											<List.Item.Meta
												title={
													<Space size={4}>
														<Text>
															{item.title}
														</Text>
														<Tag>
															{REQUIREMENT_TYPE_LABELS[
																item
																	.requirement_type
															] ||
																item.requirement_type}
														</Tag>
														{item.is_mandatory && (
															<Tag color="red">
																强制
															</Tag>
														)}
													</Space>
												}
												description={
													<Paragraph
														ellipsis={{
															rows: 2,
															expandable: true,
															symbol: '展开',
														}}
														style={{
															marginBottom: 0,
														}}
													>
														{item.description ||
															'暂无描述'}
													</Paragraph>
												}
											/>
										</List.Item>
									)}
								/>
							</Card>
						)}
					</div>
				)}
			</Modal>
		</div>
	);
}
