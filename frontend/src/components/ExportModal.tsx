'use client';

import { useState, useEffect, useMemo } from 'react';
import {
	Modal,
	Button,
	Select,
	Alert,
	Space,
	Typography,
	Tag,
	List,
	Spin,
	Descriptions,
	message,
	Result,
	Radio,
	Checkbox,
	Divider,
	Card,
	Statistic,
	Row,
	Col,
} from 'antd';
import {
	ExportOutlined,
	DownloadOutlined,
	CheckCircleOutlined,
	CloseCircleOutlined,
} from '@ant-design/icons';
import { api } from '@/lib/api';
import type { ProjectFileItem } from '@/lib/types/project_file';
import type { ReviewCheckResult, ReviewCheckItem } from '@/lib/types/review';
import { REVIEW_STATUS_LABELS, REVIEW_STATUS_COLORS } from '@/lib/types/review';
import { REQUIREMENT_TYPE_LABELS } from '@/lib/types/requirement';
import type { ExportResult } from '@/lib/types/export';
import type { SectionContent } from '@/lib/types/template_slot';

const { Text } = Typography;

interface ExportModalProps {
	open: boolean;
	projectId: string;
	bidTemplates: ProjectFileItem[];
	onClose: () => void;
	onSuccess: () => void;
}

type ExportStep =
	| 'select'
	| 'checking'
	| 'review_result'
	| 'exporting'
	| 'done';

type ExportFormat = 'docx' | 'pdf' | 'html';

const FORMAT_LABELS: Record<ExportFormat, string> = {
	docx: 'DOCX（推荐）',
	pdf: 'PDF',
	html: 'HTML',
};

const FORMAT_DESCRIPTIONS: Record<ExportFormat, string> = {
	docx: '标准 Word 文档，保留原始模板格式，兼容 WPS/Office',
	pdf: 'PDF 格式，适合预览和打印',
	html: '网页格式，方便在浏览器中查看',
};

export default function ExportModal({
	open,
	projectId,
	bidTemplates,
	onClose,
	onSuccess,
}: ExportModalProps) {
	const [step, setStep] = useState<ExportStep>('select');
	const [selectedDocId, setSelectedDocId] = useState<string>('');
	const [exportFormat, setExportFormat] = useState<ExportFormat>('docx');
	const [selectedChapterIds, setSelectedChapterIds] = useState<string[]>([]);
	const [exportAllChapters, setExportAllChapters] = useState(true);
	const [sections, setSections] = useState<SectionContent[]>([]);
	const [sectionsLoading, setSectionsLoading] = useState(false);
	const [reviewResult, setReviewResult] = useState<ReviewCheckResult | null>(null);
	const [exportResult, setExportResult] = useState<ExportResult | null>(null);
	const [errorMsg, setErrorMsg] = useState('');

	const effectiveDocId =
		selectedDocId || (bidTemplates.length === 1 ? bidTemplates[0].id : '');

	// 加载选中模板的章节列表
	useEffect(() => {
		if (!effectiveDocId) return;
		let cancelled = false;
		const load = async () => {
			setSectionsLoading(true);
			try {
				const data = await api.get<SectionContent[]>(
					`/api/documents/${effectiveDocId}/sections`,
				);
				if (!cancelled) setSections(data);
			} catch {
				// 静默失败
			} finally {
				if (!cancelled) setSectionsLoading(false);
			}
		};
		load();
		return () => { cancelled = true; };
	}, [effectiveDocId]);

	// 章节树渲染为 flat options
	const chapterOptions = useMemo(() => {
		if (sections.length === 0) return [];
		return sections.map((s) => ({
			label: (
				<span style={{ paddingLeft: (s.level - 1) * 16 }}>
					{s.title}
				</span>
			),
			value: s.section_id,
		}));
	}, [sections]);

	const reset = () => {
		setStep('select');
		setSelectedDocId('');
		setExportFormat('docx');
		setSelectedChapterIds([]);
		setExportAllChapters(true);
		setReviewResult(null);
		setExportResult(null);
		setErrorMsg('');
	};

	const handleClose = () => {
		reset();
		onClose();
	};

	const handleRunReview = async () => {
		if (!effectiveDocId) {
			message.warning('请选择要导出的投标模板');
			return;
		}
		setStep('checking');
		setErrorMsg('');
		try {
			const result = await api.post<ReviewCheckResult>(
				`/api/projects/${projectId}/review`,
			);
			setReviewResult(result);
			setStep('review_result');
		} catch {
			setErrorMsg('响应性检查失败，请稍后重试');
			setStep('select');
		}
	};

	const handleExport = async () => {
		setStep('exporting');
		setErrorMsg('');
		try {
			const chapterIds = exportAllChapters
				? null
				: selectedChapterIds;
			const result = await api.post<ExportResult>(
				`/api/projects/${projectId}/export?document_id=${effectiveDocId}`,
				{
					format: exportFormat,
					chapter_ids: chapterIds,
				},
			);
			setExportResult(result);

			if (result.status === 'blocked') {
				setStep('done');
				return;
			}

			if (result.status === 'success') {
				const downloadUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/projects/${projectId}/export/download`;
				const a = document.createElement('a');
				a.href = downloadUrl;
				a.download = '';
				document.body.appendChild(a);
				a.click();
				document.body.removeChild(a);

				message.success('导出完成，文件已开始下载');
				setStep('done');
				onSuccess();
			} else {
				setErrorMsg(result.error || '导出失败');
				setStep('done');
			}
		} catch (err: unknown) {
			const detail =
				err && typeof err === 'object' && 'detail' in err
					? (err as { detail: unknown }).detail
					: '导出请求失败';
			if (
				err &&
				typeof err === 'object' &&
				'status' in err &&
				(err as { status: number }).status === 409
			) {
				const blockedBy =
					detail && typeof detail === 'object'
						? (detail as { blocked_by?: string[] }).blocked_by || []
						: [];
				setExportResult({
					project_id: projectId,
					document_id: selectedDocId,
					status: 'blocked',
					error: '',
					export_record_id: '',
					file_path: '',
					file_size: 0,
					revision_count: 0,
					download_url: '',
					blocked_by: blockedBy,
				});
				setStep('done');
				return;
			}
			setErrorMsg(typeof detail === 'string' ? detail : '导出请求失败');
			setStep('done');
		}
	};

	const handleRetry = () => {
		setStep('select');
		setReviewResult(null);
		setExportResult(null);
		setErrorMsg('');
	};

	const hasWarnings =
		reviewResult &&
		reviewResult.warning_count > 0 &&
		!reviewResult.has_blocking_issues;

	// ── 渲染 ──────────────────────────────────────────────────────

	const renderSelectStep = () => (
		<div>
			{/* 模板选择 */}
			<div style={{ marginBottom: 20 }}>
				<Text strong style={{ display: 'block', marginBottom: 8 }}>投标模板：</Text>
				{bidTemplates.length === 0 ? (
					<Alert
						type="warning"
						message="未找到投标模板"
						description="请先上传 .docx 格式的投标模板文件"
						showIcon
					/>
				) : (
					<Select
						style={{ width: '100%' }}
						placeholder="选择投标模板"
						value={effectiveDocId || undefined}
						onChange={(val) => {
							setSelectedDocId(val);
							setSelectedChapterIds([]);
						}}
						options={bidTemplates.map((f) => ({
							value: f.id,
							label: f.name,
						}))}
					/>
				)}
			</div>

			{/* 导出格式 */}
			<div style={{ marginBottom: 20 }}>
				<Text strong style={{ display: 'block', marginBottom: 8 }}>导出格式：</Text>
				<Radio.Group
					value={exportFormat}
					onChange={(e) => setExportFormat(e.target.value)}
					optionType="button"
					buttonStyle="solid"
				>
					{(Object.entries(FORMAT_LABELS) as [ExportFormat, string][]).map(([key, label]) => (
						<Radio.Button key={key} value={key}>
							{label}
						</Radio.Button>
					))}
				</Radio.Group>
				<div style={{ marginTop: 4 }}>
					<Text type="secondary" style={{ fontSize: 12 }}>
						{FORMAT_DESCRIPTIONS[exportFormat]}
					</Text>
				</div>
			</div>

			<Divider style={{ margin: '12px 0' }} />

			{/* 章节范围 */}
			<div style={{ marginBottom: 16 }}>
				<Text strong style={{ display: 'block', marginBottom: 8 }}>导出范围：</Text>
				<Radio.Group
					value={exportAllChapters ? 'all' : 'selection'}
					onChange={(e) => setExportAllChapters(e.target.value === 'all')}
				>
					<Space direction="vertical">
						<Radio value="all">
							全部章节
							{sections.length > 0 && (
								<Tag style={{ marginLeft: 4 }}>{sections.length} 个章节</Tag>
							)}
						</Radio>
						<Radio value="selection">指定章节</Radio>
					</Space>
				</Radio.Group>

				{!exportAllChapters && (
					<div style={{ marginTop: 8, marginLeft: 24 }}>
						{sectionsLoading ? (
							<Spin size="small" />
						) : sections.length === 0 ? (
							<Text type="secondary">暂未识别到章节结构</Text>
						) : (
							<>
								<div style={{ marginBottom: 4 }}>
									<Button
										size="small"
										type="link"
										onClick={() =>
											setSelectedChapterIds(sections.map((s) => s.section_id))
										}
									>
										全选
									</Button>
									<Button
										size="small"
										type="link"
										onClick={() => setSelectedChapterIds([])}
									>
										取消全选
									</Button>
									<Tag style={{ marginLeft: 8 }}>
										已选 {selectedChapterIds.length}/{sections.length}
									</Tag>
								</div>
								<Checkbox.Group
									value={selectedChapterIds}
									onChange={(vals) => setSelectedChapterIds(vals as string[])}
									style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
								>
									{chapterOptions.map((opt) => (
										<Checkbox key={opt.value} value={opt.value}>
											{opt.label}
										</Checkbox>
									))}
								</Checkbox.Group>
							</>
						)}
					</div>
				)}
			</div>

			<div style={{ textAlign: 'right' }}>
				<Button
					type="primary"
					icon={<CheckCircleOutlined />}
					onClick={handleRunReview}
					disabled={!effectiveDocId}
				>
					开始导出检查
				</Button>
			</div>
		</div>
	);

	const renderChecking = () => (
		<div style={{ textAlign: 'center', padding: 40 }}>
			<Spin size="large" />
			<div style={{ marginTop: 16 }}>
				<Text type="secondary">正在执行响应性检查...</Text>
			</div>
		</div>
	);

	const renderReviewResult = () => {
		if (!reviewResult) return null;

		const failItems = reviewResult.items.filter((i) => i.status === 'FAIL');
		const warningItems = reviewResult.items.filter((i) => i.status === 'WARNING');

		return (
			<div>
				{/* 检查摘要 */}
				<Row gutter={12} style={{ marginBottom: 16 }}>
					<Col span={6}>
						<Card size="small">
							<Statistic title="总要求" value={reviewResult.total_requirements} valueStyle={{ fontSize: 20 }} />
						</Card>
					</Col>
					<Col span={6}>
						<Card size="small">
							<Statistic title="已覆盖" value={reviewResult.pass_count} valueStyle={{ color: '#52c41a', fontSize: 20 }} />
						</Card>
					</Col>
					<Col span={6}>
						<Card size="small">
							<Statistic title="待确认" value={reviewResult.warning_count} valueStyle={{ color: '#faad14', fontSize: 20 }} />
						</Card>
					</Col>
					<Col span={6}>
						<Card size="small">
							<Statistic title="覆盖率" value={`${(reviewResult.coverage_rate * 100).toFixed(0)}%`} valueStyle={{ color: reviewResult.coverage_rate >= 0.8 ? '#52c41a' : '#ff4d4f', fontSize: 20 }} />
						</Card>
					</Col>
				</Row>

				{/* 导出配置摘要 */}
				<Descriptions size="small" column={2} bordered style={{ marginBottom: 16 }}>
					<Descriptions.Item label="导出格式">
						<Tag color="blue">{FORMAT_LABELS[exportFormat]}</Tag>
					</Descriptions.Item>
					<Descriptions.Item label="导出范围">
						{exportAllChapters
							? '全部章节'
							: `${selectedChapterIds.length} 个章节`}
					</Descriptions.Item>
				</Descriptions>

				{/* 阻断警告 */}
				{reviewResult.has_blocking_issues && (
					<Alert
						type="error"
						message="存在未响应的强制要求，无法导出"
						description={
							<List
								size="small"
								dataSource={failItems.filter((i) => i.is_mandatory)}
								renderItem={(item: ReviewCheckItem) => (
									<List.Item>
										<Space>
											<Tag color="default">
												{REQUIREMENT_TYPE_LABELS[item.requirement_type] || item.requirement_type}
											</Tag>
											<Text>{item.title}</Text>
											{item.is_mandatory && <Tag color="red">强制</Tag>}
										</Space>
									</List.Item>
								)}
								style={{ marginTop: 8 }}
							/>
						}
						showIcon
						style={{ marginBottom: 16 }}
					/>
				)}

				{/* WARNING 提示 */}
				{!reviewResult.has_blocking_issues && warningItems.length > 0 && (
					<Alert
						type="warning"
						message={`存在 ${warningItems.length} 条待确认的要求，建议确认后再导出`}
						showIcon
						style={{ marginBottom: 16 }}
					/>
				)}

				{/* 全部通过 */}
				{!reviewResult.has_blocking_issues && warningItems.length === 0 && (
					<Alert
						type="success"
						message="所有招标要求均已覆盖，可以导出"
						showIcon
						style={{ marginBottom: 16 }}
					/>
				)}

				<div style={{ display: 'flex', justifyContent: 'space-between' }}>
					<Button onClick={handleRetry}>返回重新检查</Button>
					<Button
						type="primary"
						icon={<ExportOutlined />}
						onClick={handleExport}
						disabled={reviewResult.has_blocking_issues}
					>
						{hasWarnings ? '仍要导出' : '确认导出'}
					</Button>
				</div>
			</div>
		);
	};

	const renderExporting = () => (
		<div style={{ textAlign: 'center', padding: 40 }}>
			<Spin size="large" />
			<div style={{ marginTop: 16 }}>
				<Text strong>正在合成文档...</Text>
			</div>
			<div style={{ marginTop: 8 }}>
				<Text type="secondary">
					正在将已接受的修订内容写入投标模板，请稍候
				</Text>
			</div>
		</div>
	);

	const renderDone = () => {
		if (exportResult?.status === 'blocked') {
			return (
				<div>
					<Result
						status="error"
						title="导出已阻断"
						subTitle="存在 blocking 级别的未完成项，请先处理后再导出"
					>
						{exportResult.blocked_by.length > 0 && (
							<div style={{ textAlign: 'left' }}>
								<Text strong>阻断原因：</Text>
								<List
									size="small"
									dataSource={exportResult.blocked_by}
									renderItem={(item: string) => (
										<List.Item>
											<CloseCircleOutlined
												style={{ color: '#ff4d4f', marginRight: 8 }}
											/>
											{item}
										</List.Item>
									)}
									style={{ marginTop: 8 }}
								/>
							</div>
						)}
					</Result>
					<div style={{ textAlign: 'center' }}>
						<Button onClick={handleRetry}>重新开始</Button>
					</div>
				</div>
			);
		}

		if (exportResult?.status === 'failed' || errorMsg) {
			return (
				<div>
					<Result
						status="error"
						title="导出失败"
						subTitle={errorMsg || exportResult?.error || '未知错误'}
					/>
					<div style={{ textAlign: 'center' }}>
						<Button onClick={handleRetry} type="primary">
							重试
						</Button>
					</div>
				</div>
			);
		}

		if (exportResult?.status === 'success') {
			return (
				<div>
					<Result
						status="success"
						title="导出成功"
						subTitle={`已合成 ${exportResult.revision_count} 条修订内容，文件已开始下载`}
					>
						<Descriptions size="small" column={1} bordered>
							<Descriptions.Item label="修订数量">
								{exportResult.revision_count}
							</Descriptions.Item>
							<Descriptions.Item label="文件大小">
								{exportResult.file_size > 0
									? `${(exportResult.file_size / 1024).toFixed(1)} KB`
									: '-'}
							</Descriptions.Item>
						</Descriptions>
					</Result>
					<div style={{ textAlign: 'center' }}>
						<Space>
							<Button
								type="primary"
								icon={<DownloadOutlined />}
								onClick={() => {
									const downloadUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/projects/${projectId}/export/download`;
									const a = document.createElement('a');
									a.href = downloadUrl;
									a.download = '';
									document.body.appendChild(a);
									a.click();
									document.body.removeChild(a);
								}}
							>
								重新下载
							</Button>
							<Button onClick={handleClose}>关闭</Button>
						</Space>
					</div>
				</div>
			);
		}

		return null;
	};

	const titleMap: Record<ExportStep, string> = {
		select: '导出投标文件',
		checking: '导出投标文件',
		review_result: '响应性检查结果',
		exporting: '正在导出...',
		done: exportResult?.status === 'success' ? '导出完成' : '导出结果',
	};

	return (
		<Modal
			title={titleMap[step]}
			open={open}
			onCancel={handleClose}
			footer={null}
			width={680}
			destroyOnHidden
		>
			{step === 'select' && renderSelectStep()}
			{step === 'checking' && renderChecking()}
			{step === 'review_result' && renderReviewResult()}
			{step === 'exporting' && renderExporting()}
			{step === 'done' && renderDone()}
		</Modal>
	);
}
