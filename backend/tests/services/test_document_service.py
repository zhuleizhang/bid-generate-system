"""文档服务测试 — 解包与解析逻辑。"""

import io
import zipfile

import pytest

from app.services.document_service import unpack_docx, _resolve_parent_ids


def _make_minimal_docx_bytes() -> bytes:
    """创建一个最小可用的 DOCX 字节（有效 ZIP）。"""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("word/document.xml", "<w:document xmlns:w='http://schemas.openxmlformats.org/wordprocessingml/2006/main'><w:body><w:p><w:r><w:t>Hello</w:t></w:r></w:p></w:body></w:document>")
        zf.writestr("word/styles.xml", "<w:styles xmlns:w='http://schemas.openxmlformats.org/wordprocessingml/2006/main'/>")
        zf.writestr("[Content_Types].xml", '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>')
    return buf.getvalue()


class TestUnpackDocx:
    """DOCX 解包。"""

    def test_unpack_valid_docx(self):
        file_bytes = _make_minimal_docx_bytes()
        xml_parts, warnings = unpack_docx(file_bytes)
        assert "word/document.xml" in xml_parts
        assert "word/styles.xml" in xml_parts

    def test_unpack_invalid_zip_raises_value_error(self):
        with pytest.raises(ValueError):
            unpack_docx(b"not a zip file")


class TestResolveParentIds:
    """父节点 ID 回填。"""

    def test_resolve_hierarchy(self):
        nodes = [
            {"_temp_id": 1, "_temp_parent_id": None, "order_index": 1},
            {"_temp_id": 2, "_temp_parent_id": 1, "order_index": 2},
            {"_temp_id": 3, "_temp_parent_id": 2, "order_index": 3},
        ]
        inserted = [
            {"_temp_id": 1, "id": "a", "order_index": 1},
            {"_temp_id": 2, "id": "b", "order_index": 2},
            {"_temp_id": 3, "id": "c", "order_index": 3},
        ]
        _resolve_parent_ids(nodes, inserted)
        assert inserted[0].get("parent_node_id") is None
        assert inserted[1].get("parent_node_id") == "a"
        assert inserted[2].get("parent_node_id") == "b"

    def test_resolve_no_parent(self):
        nodes = [{"_temp_id": 1, "_temp_parent_id": None, "order_index": 1}]
        inserted = [{"_temp_id": 1, "id": "a", "order_index": 1}]
        _resolve_parent_ids(nodes, inserted)
        assert inserted[0].get("parent_node_id") is None
