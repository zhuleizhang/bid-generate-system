"""项目文件上传 API — 多文件上传、类型检测与存储。"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Body

from app.models.project_file import FileUploadItem, FilesUploadResponse, ProjectFileItem, ProjectFilesResponse
from app.gateway.supabase_gateway import SupabaseGateway

project_files_router = APIRouter(prefix="/projects", tags=["project-files"])

ALLOWED_EXTENSIONS = {".docx", ".pdf", ".doc"}

MIME_MAP = {
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".pdf": "application/pdf",
    ".doc": "application/msword",
}

# 扩展名 → document_type 默认映射，用户可通过 Form 参数显式指定覆盖
DEFAULT_TYPE_MAP = {
    ".docx": "bid_template",
    ".pdf": "tender_doc",
    ".doc": "company_material",
}


def _get_extension(filename: str) -> str:
    """提取文件扩展名（小写，含点号）。"""
    if "." in filename:
        return "." + filename.rsplit(".", 1)[-1].lower()
    return ""


@project_files_router.get("/{project_id}/files", response_model=ProjectFilesResponse)
async def list_project_files(project_id: str):
    """查询项目下所有已上传的文件，按类型和创建时间排序。"""
    gw = SupabaseGateway()

    project = gw.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")

    docs = gw.get_documents_by_project(project_id)
    files = [
        ProjectFileItem(
            id=doc.get("id", ""),
            name=doc.get("name", ""),
            document_type=doc.get("document_type", "company_material"),
            file_size=doc.get("file_size", 0),
            mime_type=doc.get("mime_type"),
            status=doc.get("status", "uploaded"),
            created_at=doc.get("created_at", ""),
        )
        for doc in docs
    ]
    return ProjectFilesResponse(project_id=project_id, files=files)


@project_files_router.post("/{project_id}/files/upload", response_model=FilesUploadResponse)
async def upload_project_files(
    project_id: str,
    files: list[UploadFile] = File(...),
    document_type: str | None = Form(None),
):
    """上传招标文件、公司资料等到项目中，支持多文件批量上传。

    document_type 为可选的 Form 参数，不传时根据扩展名自动推断。
    支持格式：.docx、.pdf、.doc（非 docx/pdf 格式仅存储，解析需 .docx 或 .pdf）。
    """
    gw = SupabaseGateway()

    project = gw.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")

    results: list[FileUploadItem] = []
    success_count = 0
    failed_count = 0

    for file in files:
        try:
            if not file.filename:
                results.append(FileUploadItem(
                    filename="(unknown)", file_size=0, document_type="unknown",
                    status="failed", error="文件名为空",
                ))
                failed_count += 1
                continue

            ext = _get_extension(file.filename)
            if ext not in ALLOWED_EXTENSIONS:
                results.append(FileUploadItem(
                    filename=file.filename, file_size=0,
                    document_type=document_type or "unknown",
                    status="failed",
                    error=f"不支持的文件类型 {ext}，仅支持 .docx, .pdf, .doc",
                ))
                failed_count += 1
                continue

            content = await file.read()
            if not content:
                results.append(FileUploadItem(
                    filename=file.filename, file_size=0,
                    document_type=document_type or DEFAULT_TYPE_MAP.get(ext, "company_material"),
                    status="failed", error="文件为空",
                ))
                failed_count += 1
                continue

            # 用户显式指定优先，否则按扩展名默认映射
            doc_type = document_type or DEFAULT_TYPE_MAP.get(ext, "company_material")
            mime_type = MIME_MAP.get(ext, "application/octet-stream")
            safe_name = file.filename.replace(" ", "_")

            # 存储到 Supabase Storage：projects/{project_id}/{document_type}/{filename}
            storage_path = f"projects/{project_id}/{doc_type}/{safe_name}"
            gw.upload_file(storage_path, content, mime_type)
            stored_url = gw.get_file_url(storage_path)

            # 创建 documents 表记录，关联到项目
            doc_data = {
                "name": file.filename,
                "document_type": doc_type,
                "file_path": stored_url,
                "file_size": len(content),
                "mime_type": mime_type,
                "project_id": project_id,
                "status": "uploaded",
            }
            record = gw.insert_document(doc_data)

            results.append(FileUploadItem(
                filename=file.filename,
                document_id=record.get("id"),
                file_size=len(content),
                document_type=doc_type,
                status="success",
            ))
            success_count += 1

        except Exception as e:
            results.append(FileUploadItem(
                filename=file.filename or "(unknown)",
                file_size=0,
                document_type=document_type or "unknown",
                status="failed",
                error=str(e),
            ))
            failed_count += 1

    return FilesUploadResponse(
        project_id=project_id,
        results=results,
        success_count=success_count,
        failed_count=failed_count,
    )


@project_files_router.delete("/{project_id}/files/{file_id}")
async def delete_project_file(project_id: str, file_id: str):
    """删除项目下的文件及其关联的解析数据。"""
    gw = SupabaseGateway()

    project = gw.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")

    doc = gw.get_document(file_id)
    if not doc or doc.get("project_id") != project_id:
        raise HTTPException(status_code=404, detail="文件不存在或不属于该项目")

    try:
        gw.delete_document(file_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"删除失败: {str(e)}")

    return {"message": "文件已删除"}


@project_files_router.patch("/{project_id}/files/{file_id}")
async def update_project_file(project_id: str, file_id: str, body: dict = Body(...)):
    """更新文件的 document_type。"""
    gw = SupabaseGateway()

    project = gw.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")

    doc = gw.get_document(file_id)
    if not doc or doc.get("project_id") != project_id:
        raise HTTPException(status_code=404, detail="文件不存在或不属于该项目")

    doc_type = body.get("document_type")
    if not doc_type or doc_type not in ("bid_template", "tender_doc", "company_material"):
        raise HTTPException(status_code=400, detail="无效的 document_type")

    try:
        return gw.update_document(file_id, {"document_type": doc_type})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"更新失败: {str(e)}")
