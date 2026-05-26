"""DOCX 内容回写引擎 — 将文本按策略写回原始 DOCX 模板的正确位置。

支持四种策略：
- replace：替换目标段落内所有 w:r/w:t 的文本，保留 w:rPr 原始样式
- append：在目标段落末尾追加新 w:r 元素，继承段落样式
- cell_fill：定位 w:tc 内段落，替换或追加文本
- section_append：在目标段落后插入新 w:p 段落
"""

import copy
import zipfile
from datetime import datetime
from io import BytesIO

from lxml import etree

from app.gateway.supabase_gateway import SupabaseGateway
from app.models.writeback import WriteBackOperation, WriteBackResult

# WordprocessingML 命名空间
_W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"


def _ns(tag: str) -> str:
    return f"{{{_W_NS}}}{tag}"


# ── location_path 解析 ────────────────────────────────────────


def _resolve_element(root: etree._Element, location_path: str) -> etree._Element | None:
    """根据 location_path 在 XML 树中定位目标元素。

    location_path 格式如 /w:document/w:body/w:p[3] 或 /w:document/w:body/w:tbl[1]/w:tr[2]/w:tc[1]。
    """
    parts = location_path.strip("/").split("/")
    current = root

    for part in parts:
        if not part:
            continue
        # 解析 "w:tagname[N]" 格式
        if "[" in part:
            tag_with_ns, idx_str = part.rsplit("[", 1)
            idx = int(idx_str.rstrip("]"))
        else:
            tag_with_ns = part
            idx = 1

        localname = tag_with_ns.split(":", 1)[-1] if ":" in tag_with_ns else tag_with_ns

        siblings = [
            c for c in current
            if isinstance(c, etree._Element) and etree.QName(c).localname == localname
        ]
        if idx < 1 or idx > len(siblings):
            return None
        current = siblings[idx - 1]

    return current


# ── 段落级操作 ────────────────────────────────────────────────


def _get_first_rPr(p_el: etree._Element) -> etree._Element | None:
    """获取段落中第一个 w:r 的 w:rPr 元素，用于继承样式。"""
    first_run = p_el.find(_ns("r"))
    if first_run is not None:
        return first_run.find(_ns("rPr"))
    # 回退到段落级别的 rPr
    pPr = p_el.find(_ns("pPr"))
    if pPr is not None:
        return pPr.find(_ns("rPr"))
    return None


def _apply_replace(p_el: etree._Element, new_text: str) -> None:
    """替换 w:p 内所有 w:r 的 w:t 文本，保留 w:rPr 样式。

    保留第一个 w:r 的 w:rPr 样式，移除其余 w:r，将新文本写入第一个 w:t。
    """
    runs = p_el.findall(_ns("r"))
    if not runs:
        # 段落无 w:r，创建一个
        first_run = etree.SubElement(p_el, _ns("r"))
        first_t = etree.SubElement(first_run, _ns("t"))
        first_t.text = new_text
        # 保留 xml:space 属性以支持前后空格
        first_t.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")
        return

    first_run = runs[0]
    # 移除其余 w:r
    for run in runs[1:]:
        p_el.remove(run)

    # 确保第一个 w:r 中有 w:t
    existing_t = first_run.find(_ns("t"))
    if existing_t is not None:
        existing_t.text = new_text
        existing_t.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")
        return

    # 创建新的 w:t 元素，插入到 w:rPr 之后（如果存在），否则插入到开头
    new_t = etree.Element(_ns("t"))
    rPr = first_run.find(_ns("rPr"))
    if rPr is not None:
        rPr_index = list(first_run).index(rPr)
        first_run.insert(rPr_index + 1, new_t)
    else:
        first_run.insert(0, new_t)

    new_t.text = new_text
    new_t.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")


def _apply_section_append(p_el: etree._Element, new_text: str) -> None:
    """在目标 w:p 之后插入新的 w:p 段落。"""
    parent = p_el.getparent()
    if parent is None:
        return

    new_p = etree.Element(_ns("p"))
    # 继承目标段落的 pPr 样式
    pPr = p_el.find(_ns("pPr"))
    if pPr is not None:
        new_p.append(copy.deepcopy(pPr))

    new_r = etree.SubElement(new_p, _ns("r"))
    # 继承 rPr 样式
    rPr = _get_first_rPr(p_el)
    if rPr is not None:
        new_r.append(copy.deepcopy(rPr))

    new_t = etree.SubElement(new_r, _ns("t"))
    new_t.text = new_text
    new_t.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")

    # 插入到目标段落之后
    idx = list(parent).index(p_el)
    parent.insert(idx + 1, new_p)


def _apply_append(p_el: etree._Element, new_text: str) -> None:
    """在 w:p 末尾追加新 w:r 元素，继承段落样式。"""
    new_run = etree.SubElement(p_el, _ns("r"))

    # 继承现有 w:r 的 w:rPr 样式
    existing_rPr = _get_first_rPr(p_el)
    if existing_rPr is not None:
        new_run.append(copy.deepcopy(existing_rPr))

    new_t = etree.SubElement(new_run, _ns("t"))
    new_t.text = new_text
    new_t.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")


# ── 主回写流程 ────────────────────────────────────────────────


def _apply_operation(root: etree._Element, op: WriteBackOperation) -> bool:
    """对 XML 树应用单条回写操作，返回是否成功。"""
    element = _resolve_element(root, op.location_path)
    if element is None:
        return False

    strategy = op.strategy

    if strategy == "replace":
        # 目标必须是 w:p
        if etree.QName(element).localname != "p":
            return False
        _apply_replace(element, op.new_text)
        return True

    elif strategy == "append":
        # 目标必须是 w:p
        if etree.QName(element).localname != "p":
            return False
        _apply_append(element, op.new_text)
        return True

    elif strategy == "cell_fill":
        # 目标必须是 w:tc
        if etree.QName(element).localname != "tc":
            return False
        # 定位 w:tc 内第一个 w:p，执行替换
        first_p = element.find(_ns("p"))
        if first_p is None:
            return False
        _apply_replace(first_p, op.new_text)
        return True

    elif strategy == "section_append":
        # 目标必须是 w:p，在其后插入新段落
        if etree.QName(element).localname != "p":
            return False
        _apply_section_append(element, op.new_text)
        return True

    return False


def write_back_docx(
    original_bytes: bytes,
    operations: list[WriteBackOperation],
) -> tuple[bytes, list[dict[str, str]]]:
    """将操作列表应用到 DOCX 文件，返回修改后的字节和失败明细。

    Args:
        original_bytes: 原始 DOCX 文件字节
        operations: 回写操作列表

    Returns:
        (modified_bytes, failed_details): 修改后的 DOCX 字节，失败操作明细列表
    """
    # 读取原始 ZIP 内容
    with zipfile.ZipFile(BytesIO(original_bytes), "r") as zf:
        doc_xml_bytes = zf.read("word/document.xml")
        other_files: dict[str, bytes] = {}
        for name in zf.namelist():
            if name != "word/document.xml":
                other_files[name] = zf.read(name)

    root = etree.fromstring(doc_xml_bytes)

    failed: list[dict[str, str]] = []
    for op in operations:
        success = _apply_operation(root, op)
        if not success:
            failed.append({
                "location_path": op.location_path,
                "strategy": op.strategy,
                "reason": "无法定位目标元素或不支持的策略",
            })

    # 序列化修改后的 document.xml
    modified_xml = etree.tostring(
        root, xml_declaration=True, encoding="UTF-8", standalone=True
    )

    # 重新打包为 DOCX
    output = BytesIO()
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("word/document.xml", modified_xml)
        for name, content in other_files.items():
            zf.writestr(name, content)

    return output.getvalue(), failed


def validate_docx(file_bytes: bytes) -> tuple[bool, str | None]:
    """验证回写后 DOCX 文件的结构完整性。

    Returns:
        (is_valid, error_message): 是否有效及错误信息
    """
    try:
        with zipfile.ZipFile(BytesIO(file_bytes), "r") as zf:
            if "word/document.xml" not in zf.namelist():
                return False, "缺少 word/document.xml"
            doc_xml = zf.read("word/document.xml")

        root = etree.fromstring(doc_xml)
        body = root.find(_ns("body"))
        if body is None:
            return False, "缺少 w:body 元素"

        return True, None
    except zipfile.BadZipFile:
        return False, "文件不是有效的 ZIP 格式"
    except etree.XMLSyntaxError as e:
        return False, f"document.xml 解析失败: {e}"
    except Exception as e:
        return False, str(e)


# ── 服务入口 ──────────────────────────────────────────────────


async def apply_writeback(
    doc_id: str,
    operations: list[WriteBackOperation],
) -> WriteBackResult:
    """对指定文档应用回写操作，含备份、写入和验证的完整流程。"""
    gw = SupabaseGateway()

    doc = gw.get_document(doc_id)
    if not doc:
        raise ValueError(f"文档不存在: {doc_id}")

    file_path = doc.get("file_path", "")
    if not file_path:
        raise ValueError("文档缺少 file_path，无法定位源文件")

    # 下载原始 DOCX
    original_bytes = gw.download_file_by_url(file_path)

    # 备份原始文件
    original_name = doc.get("name", f"{doc_id}.docx")
    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    backup_storage_path = f"backups/{doc_id}/{timestamp}_{original_name}"
    gw.upload_file(
        backup_storage_path,
        original_bytes,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )

    # 应用回写操作
    modified_bytes, failed_details = write_back_docx(original_bytes, operations)

    # 验证修改后的文件
    is_valid, validation_error = validate_docx(modified_bytes)

    # 上传修改后的文件（替换原位置）
    storage_dir = file_path.rsplit("/", 1)[0] if "/" in file_path else ""
    result_storage_path = f"{storage_dir}/{original_name}" if storage_dir else original_name
    gw.upload_file(
        result_storage_path,
        modified_bytes,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )

    succeeded = len(operations) - len(failed_details)

    return WriteBackResult(
        document_id=doc_id,
        backup_path=backup_storage_path,
        operations_total=len(operations),
        operations_succeeded=succeeded,
        operations_failed=len(failed_details),
        validation_passed=is_valid,
        validation_error=validation_error,
        result_path=gw.get_file_url(result_storage_path),
        failed_details=failed_details,
    )
