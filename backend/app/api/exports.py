"""导出 API — DOCX 最终合成与下载端点。"""

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response

from app.gateway.supabase_gateway import SupabaseGateway
from app.models.export_record import ExportResult
from app.services.export_service import export_project_docx

exports_router = APIRouter(prefix="/projects", tags=["exports"])


@exports_router.post("/{project_id}/export", response_model=ExportResult)
async def export_docx(
    project_id: str,
    document_id: str = Query(..., description="要导出的投标模板文档 ID"),
    exported_by: str = Query("", description="导出人标识"),
):
    """将已接受的 AIRevision 合成为最终 DOCX 投标文件。

    仅合成 status = 'accepted' 或 'edited_then_accepted' 的修订。
    导出前检查 blocking 级别 UnfinishedItem，存在时返回 409。
    """
    try:
        result = await export_project_docx(project_id, document_id, exported_by)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导出失败: {str(e)}")

    if result["status"] == "blocked":
        raise HTTPException(
            status_code=409,
            detail={
                "message": "存在 blocking 级别的未完成项，无法导出",
                "blocked_by": result["blocked_by"],
            },
        )

    return ExportResult(**result)


@exports_router.get("/{project_id}/export/download")
async def download_export(project_id: str):
    """下载项目最新的导出文件。"""
    gw = SupabaseGateway()

    project = gw.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")

    records = gw.get_export_records(project_id)
    if not records:
        raise HTTPException(status_code=404, detail="该项目尚无导出记录")

    latest = records[0]
    file_path = latest.get("file_path", "")
    if not file_path:
        raise HTTPException(status_code=404, detail="导出记录缺少文件路径")

    try:
        file_bytes = gw.download_file_by_url(file_path)
    except Exception:
        raise HTTPException(status_code=500, detail="导出文件下载失败")

    project_name = project.get("name", project_id)
    safe_name = project_name.replace("/", "_").replace("\\", "_")
    filename = f"{safe_name}_投标文件.docx"

    return Response(
        content=file_bytes,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )
