from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from pdf_processor import extract_text, chunk_text
from indexer import build_index, query_index, delete_index

app = FastAPI(title="RAG Service")


class EmbedRequest(BaseModel):
    pdf_path: str
    subtopic_id: str
    subject_id: str
    topic_id: str


class QueryRequest(BaseModel):
    query: str
    subtopic_id: str
    subject_id: str
    topic_id: str
    top_k: int = 5


@app.post("/embed")
def embed(req: EmbedRequest):
    try:
        text = extract_text(req.pdf_path)
        if not text.strip():
            raise HTTPException(status_code=422, detail="No text could be extracted from the PDF")
        chunks = chunk_text(text)
        if not chunks:
            raise HTTPException(status_code=422, detail="No usable chunks after processing")
        count = build_index(chunks, req.subject_id, req.topic_id, req.subtopic_id)
        return {"status": "ok", "chunk_count": count}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/query")
def query(req: QueryRequest):
    try:
        chunks = query_index(req.query, req.subject_id, req.topic_id, req.subtopic_id, req.top_k)
        return {"chunks": chunks}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/index/{subject_id}/{topic_id}/{subtopic_id}")
def delete(subject_id: str, topic_id: str, subtopic_id: str):
    delete_index(subject_id, topic_id, subtopic_id)
    return {"status": "deleted"}
