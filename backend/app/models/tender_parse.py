"""招标文件解析模型 — PDF 和 Word 解析结果。"""

from pydantic import BaseModel


class TenderSection(BaseModel):
    """解析出的章节。"""

    title: str
    level: int
    content: str = ""
    paragraphs: list[str] = []


class TenderTable(BaseModel):
    """解析出的表格。"""

    caption: str = ""
    headers: list[str] = []
    rows: list[list[str]] = []


class TenderParseResponse(BaseModel):
    """单文件解析结果。"""

    document_id: str
    document_name: str
    file_type: str
    status: str  # success / failed
    error: str = ""
    version_id: str = ""
    sections: list[TenderSection] = []
    tables: list[TenderTable] = []
    full_text: str = ""
