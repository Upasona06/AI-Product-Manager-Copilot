"""
services/rag_service.py — Core RAG Engine for Knowledge Base
Manages ChromaDB vector store, indexing, and semantic search.
"""

import uuid
import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any

import chromadb
from chromadb.config import Settings

from database.db import db
from models.processed_feedback import ProcessedFeedback
from models.prioritized_feature import PrioritizedFeature
from services.embedding_service import EmbeddingService

logger = logging.getLogger(__name__)


class RAGService:
    """
    Manages the Knowledge Base vector store:
    - Index processed feedback & prioritized features into ChromaDB
    - Perform semantic search with cosine similarity
    - Provide stats about the indexed knowledge base
    """

    def __init__(self, app_config: Dict[str, Any]):
        self._persist_dir = app_config.get("CHROMADB_PERSIST_DIR", "./chromadb_data")
        self._collection_name = app_config.get("CHROMADB_COLLECTION_NAME", "feedback_embeddings")
        self._top_k = app_config.get("RAG_SEARCH_TOP_K", 10)

        # Initialize embedding service
        self._embedding_service = EmbeddingService(
            gemini_api_key=app_config.get("GEMINI_API_KEY", ""),
            gemini_model=app_config.get("GEMINI_EMBEDDING_MODEL", "models/text-embedding-004"),
            fallback_model_name=app_config.get("RAG_FALLBACK_EMBEDDING_MODEL", "all-MiniLM-L6-v2"),
        )

        # Initialize ChromaDB
        self._chroma_client = chromadb.PersistentClient(
            path=self._persist_dir,
            settings=Settings(anonymized_telemetry=False),
        )
        self._collection = self._chroma_client.get_or_create_collection(
            name=self._collection_name,
            metadata={"hnsw:space": "cosine"},
        )

        logger.info(
            "RAGService: Initialized (persist_dir=%s, collection=%s, embedding=%s)",
            self._persist_dir, self._collection_name, self._embedding_service.provider_name,
        )

        # Track indexing state
        self._last_indexed_at: Optional[datetime] = None
        self._indexing_in_progress = False

    # ------------------------------------------------------------------
    # Indexing
    # ------------------------------------------------------------------
    def index_all_feedback(self, project_id: uuid.UUID) -> Dict[str, Any]:
        """
        Index all processed feedback and prioritized features for a project
        into the ChromaDB vector store.

        Args:
            project_id: UUID of the project to index.

        Returns:
            Dictionary with indexing statistics.
        """
        if self._indexing_in_progress:
            raise RuntimeError("Indexing is already in progress. Please wait.")

        self._indexing_in_progress = True
        stats = {
            "total_processed": 0,
            "total_indexed": 0,
            "total_skipped": 0,
            "total_errors": 0,
            "embedding_model": self._embedding_service.provider_name,
        }

        try:
            logger.info("RAGService: Starting full index for project %s", str(project_id))

            # Query all processed feedback for this project
            feedback_records = ProcessedFeedback.query.filter_by(
                project_id=project_id,
                processing_status="processed",
            ).all()

            stats["total_processed"] = len(feedback_records)
            logger.info("RAGService: Found %d processed feedback records", len(feedback_records))

            if not feedback_records:
                logger.info("RAGService: No feedback to index.")
                return stats

            # Build lookup for prioritized features
            feedback_ids = [f.processed_id for f in feedback_records]
            prioritized_map = {}
            try:
                prioritized_records = PrioritizedFeature.query.filter(
                    PrioritizedFeature.processed_feedback_id.in_(feedback_ids)
                ).all()
                prioritized_map = {
                    str(p.processed_feedback_id): p for p in prioritized_records
                }
                logger.info(
                    "RAGService: Found %d prioritized features to enrich metadata",
                    len(prioritized_records),
                )
            except Exception as e:
                logger.warning("RAGService: Could not load prioritized features: %s", str(e))

            # Prepare documents for embedding
            doc_ids = []
            doc_texts = []
            doc_metadatas = []

            for fb in feedback_records:
                doc_id = str(fb.processed_id)

                # Compose the document text for embedding
                text_parts = [
                    fb.original_subject or "",
                    fb.original_description or "",
                    fb.clean_text or "",
                ]
                combined_text = " ".join(part for part in text_parts if part).strip()

                if not combined_text:
                    stats["total_skipped"] += 1
                    continue

                # Build metadata for ChromaDB storage
                metadata = {
                    "processed_id": doc_id,
                    "project_id": str(project_id),
                    "category": fb.category or "General",
                    "priority": fb.priority or "Medium",
                    "sentiment": fb.sentiment_self_reported or "Unknown",
                    "source": fb.source or "unknown",
                    "subject": (fb.original_subject or "")[:200],
                    "weight": fb.weight or 1,
                    "word_count": fb.word_count or 0,
                }

                # Enrich with prioritization data if available
                pf = prioritized_map.get(doc_id)
                if pf:
                    metadata["feature_name"] = (pf.feature_name or "")[:200]
                    metadata["priority_class"] = pf.priority_class or ""
                    metadata["priority_score"] = float(pf.priority_score or 0)
                    metadata["moscow_category"] = pf.moscow_category or ""
                    metadata["roi_score"] = float(pf.roi_score or 0)

                doc_ids.append(doc_id)
                doc_texts.append(combined_text)
                doc_metadatas.append(metadata)

            if not doc_texts:
                logger.info("RAGService: No valid documents to embed after filtering.")
                return stats

            # Generate embeddings in batch
            logger.info("RAGService: Generating embeddings for %d documents...", len(doc_texts))
            embeddings = self._embedding_service.generate_embeddings_batch(doc_texts)

            # Upsert into ChromaDB (in chunks to avoid memory issues)
            chunk_size = 100
            for i in range(0, len(doc_ids), chunk_size):
                chunk_end = min(i + chunk_size, len(doc_ids))
                try:
                    self._collection.upsert(
                        ids=doc_ids[i:chunk_end],
                        embeddings=embeddings[i:chunk_end],
                        documents=doc_texts[i:chunk_end],
                        metadatas=doc_metadatas[i:chunk_end],
                    )
                    stats["total_indexed"] += (chunk_end - i)
                    logger.info(
                        "RAGService: Indexed chunk %d-%d of %d",
                        i + 1, chunk_end, len(doc_ids),
                    )
                except Exception as chunk_err:
                    stats["total_errors"] += (chunk_end - i)
                    logger.error(
                        "RAGService: Error indexing chunk %d-%d: %s",
                        i + 1, chunk_end, str(chunk_err),
                    )

            self._last_indexed_at = datetime.now(timezone.utc)
            logger.info(
                "RAGService: Indexing complete. Indexed=%d, Skipped=%d, Errors=%d",
                stats["total_indexed"], stats["total_skipped"], stats["total_errors"],
            )

        except Exception as e:
            logger.error("RAGService: Indexing failed with error: %s", str(e))
            raise
        finally:
            self._indexing_in_progress = False

        return stats

    # ------------------------------------------------------------------
    # Semantic Search
    # ------------------------------------------------------------------
    def semantic_search(
        self,
        query: str,
        top_k: Optional[int] = None,
        project_id: Optional[uuid.UUID] = None,
    ) -> Dict[str, Any]:
        """
        Perform semantic search against the knowledge base.

        Args:
            query: Natural language search query.
            top_k: Maximum number of results (default from config).
            project_id: Optional project filter.

        Returns:
            Dictionary with search results including similarity scores.
        """
        if not query or not query.strip():
            raise ValueError("Search query cannot be empty.")

        effective_top_k = top_k or self._top_k

        logger.info(
            "RAGService: Semantic search for '%s' (top_k=%d, project=%s)",
            query[:80], effective_top_k, str(project_id) if project_id else "all",
        )

        # Generate query embedding
        query_embedding = self._embedding_service.generate_embedding(query)

        # Build ChromaDB where filter
        where_filter = None
        if project_id:
            where_filter = {"project_id": str(project_id)}

        # Search ChromaDB
        try:
            results = self._collection.query(
                query_embeddings=[query_embedding],
                n_results=effective_top_k,
                where=where_filter,
                include=["documents", "metadatas", "distances"],
            )
        except Exception as e:
            logger.error("RAGService: ChromaDB query failed: %s", str(e))
            raise RuntimeError(f"Vector search failed: {e}")

        # Parse results into a clean format
        search_results = []
        if results and results.get("ids") and results["ids"][0]:
            ids = results["ids"][0]
            documents = results["documents"][0] if results.get("documents") else []
            metadatas = results["metadatas"][0] if results.get("metadatas") else []
            distances = results["distances"][0] if results.get("distances") else []

            for idx, doc_id in enumerate(ids):
                # ChromaDB cosine distance: 0 = identical, 2 = opposite
                # Convert to similarity score: 1 - (distance / 2) = cosine similarity
                distance = distances[idx] if idx < len(distances) else 1.0
                similarity_score = max(0.0, min(1.0, 1.0 - (distance / 2.0)))

                metadata = metadatas[idx] if idx < len(metadatas) else {}
                document = documents[idx] if idx < len(documents) else ""

                search_results.append({
                    "processed_id": doc_id,
                    "similarity_score": round(similarity_score, 4),
                    "document_preview": document[:500] if document else "",
                    "subject": metadata.get("subject", ""),
                    "category": metadata.get("category", "General"),
                    "priority": metadata.get("priority", "Medium"),
                    "sentiment": metadata.get("sentiment", "Unknown"),
                    "source": metadata.get("source", "unknown"),
                    "weight": metadata.get("weight", 1),
                    "feature_name": metadata.get("feature_name", ""),
                    "priority_class": metadata.get("priority_class", ""),
                    "priority_score": metadata.get("priority_score", 0),
                    "moscow_category": metadata.get("moscow_category", ""),
                    "roi_score": metadata.get("roi_score", 0),
                })

        logger.info(
            "RAGService: Search returned %d results for query '%s'",
            len(search_results), query[:50],
        )

        return {
            "query": query,
            "results": search_results,
            "total_results": len(search_results),
            "embedding_model": self._embedding_service.provider_name,
            "top_k": effective_top_k,
        }

    # ------------------------------------------------------------------
    # Statistics
    # ------------------------------------------------------------------
    def get_stats(self) -> Dict[str, Any]:
        """
        Return statistics about the knowledge base.

        Returns:
            Dictionary with KB stats including total docs, model info, etc.
        """
        try:
            collection_count = self._collection.count()
        except Exception as e:
            logger.error("RAGService: Failed to get collection count: %s", str(e))
            collection_count = 0

        return {
            "total_indexed_documents": collection_count,
            "embedding_model": self._embedding_service.provider_name,
            "embedding_dimension": self._embedding_service.dimension,
            "vector_database": "ChromaDB",
            "collection_name": self._collection_name,
            "persist_directory": self._persist_dir,
            "indexing_in_progress": self._indexing_in_progress,
            "last_indexed_at": (
                self._last_indexed_at.isoformat() if self._last_indexed_at else None
            ),
            "search_top_k": self._top_k,
        }
