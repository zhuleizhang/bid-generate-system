'use client';

import { useState } from 'react';
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

export default function ExportModal({
	open,
	projectId,
	bidTemplates,
	onClose,
	onSuccess,
}: ExportModalProps) {
	const [step, setStep] = useState<ExportStep>('select');
	const [selectedDocId, setSelectedDocId] = useState<string>('');
	const [reviewResult, setReviewResult] = useState<ReviewCheckResult | null>(
		null,
	);
	const [exportResult, setExportResult] = useState<ExportResult | null>(null);
	const [errorMsg, setErrorMsg] = useState('');

	// 自动选择唯一的投标模板
	const effectiveDocId =
		selectedDocId || (bidTemplates.length === 1 ? bidTemplates[0].id : '');

	// 重置状态
	const reset = () => {
		setStep('select');
		setSelectedDocId('');
		setReviewResult(null);
		setExportResult(null);
		setErrorMsg('');
	};

	const handleClose = () => {
		reset();
		onClose();
	};

	// 执行响应性检查
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

	// 执行导出
	const handleExport = async () => {
		setStep('exporting');
		setErrorMsg('');
		try {
			const result = await api.post<ExportResult>(
				`/api/projects/${projectId}/export?document_id=${effectiveDocId}`,
			);
			setExportResult(result);

			if (result.status === 'blocked') {
				setStep('done');
				return;
			}

			if (result.status === 'success') {
				// 触发浏览器下载
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
			// 409 阻断
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

	// 重新开始
	const handleRetry = () => {
		setStep('select');
		setReviewResult(null);
		setExportResult(null);
		setErrorMsg('');
	};

	// 判断是否有警告项
	const hasWarnings =
		reviewResult &&
		reviewResult.warning_count > 0 &&
		!reviewResult.has_blocking_issues;

	// ── 渲染 ──────────────────────────────────────────────────────

	const renderSelectStep = () => (
		<div>
			<div style={{ marginBottom: 16 }}>
				<Text strong>选择要导出的投标模板：</Text>
			</div>
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
					onChange={(val) => setSelectedDocId(val)}
					options={bidTemplates.map((f) => ({
						value: f.id,
						label: f.name,
					}))}
				/>
			)}
			<div style={{ marginTop: 16, textAlign: 'right' }}>
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
		const warningItems = reviewResult.items.filter(
			(i) => i.status === 'WARNING',
		);

		return (
			<div>
				{/* 检查摘要 */}
				<Descriptions
					size="small"
					column={2}
					bordered
					style={{ marginBottom: 16 }}
				>
					<Descriptions.Item label="总要求数">
						{reviewResult.total_requirements}
					</Descriptions.Item>
					<Descriptions.Item label="覆盖率">
						<Text
							strong
							style={{
								color:
									reviewResult.coverage_rate >= 0.8
										? '#52c41a'
										: '#faad14',
							}}
						>
							{(reviewResult.coverage_rate * 100).toFixed(1)}%
						</Text>
					</Descriptions.Item>
					<Descriptions.Item label="已覆盖">
						<Tag color="green">{reviewResult.pass_count}</Tag>
					</Descriptions.Item>
					<Descriptions.Item label="待确认">
						<Tag color="orange">{reviewResult.warning_count}</Tag>
					</Descriptions.Item>
					<Descriptions.Item label="无响应">
						<Tag color="red">{reviewResult.fail_count}</Tag>
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
								dataSource={failItems.filter(
									(i) => i.is_mandatory,
								)}
								renderItem={(item: ReviewCheckItem) => (
									<List.Item>
										<Space>
											<Tag
												color={
													REQUIREMENT_TYPE_LABELS[
														item.requirement_type
													]
														? 'default'
														: 'default'
												}
											>
												{REQUIREMENT_TYPE_LABELS[
													item.requirement_type
												] || item.requirement_type}
											</Tag>
											<Text>{item.title}</Text>
											{item.is_mandatory && (
												<Tag color="red">强制</Tag>
											)}
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
				{!reviewResult.has_blocking_issues &&
					warningItems.length > 0 && (
						<Alert
							type="warning"
							message={`存在 ${warningItems.length} 条待确认的要求，建议确认后再导出`}
							description={
								<List
									size="small"
									dataSource={warningItems.slice(0, 5)}
									renderItem={(item: ReviewCheckItem) => (
										<List.Item>
											<Space>
												<Tag
													color={
														REVIEW_STATUS_COLORS[
															item.status
														]
													}
												>
													{
														REVIEW_STATUS_LABELS[
															item.status
														]
													}
												</Tag>
												<Text>{item.title}</Text>
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

				{/* 全部通过 */}
				{!reviewResult.has_blocking_issues &&
					warningItems.length === 0 && (
						<Alert
							type="success"
							message="所有招标要求均已覆盖，可以导出"
							showIcon
							style={{ marginBottom: 16 }}
						/>
					)}

				{/* 操作按钮 */}
				<div
					style={{ display: 'flex', justifyContent: 'space-between' }}
				>
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
		// 阻断
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
												style={{
													color: '#ff4d4f',
													marginRight: 8,
												}}
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

		// 失败
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

		// 成功
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

	// ── Modal 标题 ────────────────────────────────────────────────

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
			width={640}
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
