import json
import os
import numpy as np
import faiss
from sentence_transformers import SentenceTransformer

MODEL_NAME = "all-MiniLM-L6-v2"
EMBEDDINGS_BASE = os.path.join(os.path.dirname(__file__), "..", "backend", "data", "embeddings")

_model = None


def get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        _model = SentenceTransformer(MODEL_NAME)
    return _model


def _index_dir(subject_id: str, topic_id: str, subtopic_id: str) -> str:
    return os.path.join(EMBEDDINGS_BASE, subject_id, topic_id, subtopic_id)


def build_index(chunks: list[str], subject_id: str, topic_id: str, subtopic_id: str) -> int:
    model = get_model()
    embeddings = model.encode(chunks, show_progress_bar=False).astype("float32")

    index = faiss.IndexFlatL2(embeddings.shape[1])
    index.add(embeddings)

    out_dir = _index_dir(subject_id, topic_id, subtopic_id)
    os.makedirs(out_dir, exist_ok=True)

    faiss.write_index(index, os.path.join(out_dir, "index.faiss"))
    with open(os.path.join(out_dir, "chunks.json"), "w", encoding="utf-8") as f:
        json.dump(chunks, f, ensure_ascii=False)

    return len(chunks)


def query_index(query: str, subject_id: str, topic_id: str, subtopic_id: str, top_k: int = 5) -> list[str]:
    idx_dir = _index_dir(subject_id, topic_id, subtopic_id)
    index_path = os.path.join(idx_dir, "index.faiss")
    chunks_path = os.path.join(idx_dir, "chunks.json")

    if not os.path.exists(index_path):
        raise FileNotFoundError(f"No FAISS index found for {subject_id}/{topic_id}/{subtopic_id}")

    index = faiss.read_index(index_path)
    with open(chunks_path, "r", encoding="utf-8") as f:
        chunks = json.load(f)

    model = get_model()
    q_emb = model.encode([query], show_progress_bar=False).astype("float32")
    k = min(top_k, len(chunks))
    _, indices = index.search(q_emb, k)

    return [chunks[i] for i in indices[0] if i < len(chunks)]


def delete_index(subject_id: str, topic_id: str, subtopic_id: str) -> bool:
    idx_dir = _index_dir(subject_id, topic_id, subtopic_id)
    deleted = False
    for fname in ("index.faiss", "chunks.json"):
        fpath = os.path.join(idx_dir, fname)
        if os.path.exists(fpath):
            os.remove(fpath)
            deleted = True
    if os.path.isdir(idx_dir):
        try:
            os.rmdir(idx_dir)
        except OSError:
            pass
    return deleted
