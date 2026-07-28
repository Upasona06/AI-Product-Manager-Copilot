"""
services/embedding_service.py — Dual-provider embedding generator for RAG Engine
Primary: Google Gemini text-embedding-004
Fallback: sentence-transformers all-MiniLM-L6-v2
"""

import logging
from typing import List, Optional

logger = logging.getLogger(__name__)


class EmbeddingService:
    """
    Generates vector embeddings using Gemini as the primary provider
    and sentence-transformers all-MiniLM-L6-v2 as automatic fallback.
    
    Provider selection is cached after first initialization so the check
    is performed only once per process lifetime.
    """

    def __init__(self, gemini_api_key: str = "", gemini_model: str = "models/text-embedding-004",
                 fallback_model_name: str = "all-MiniLM-L6-v2"):
        self._gemini_api_key = gemini_api_key
        self._gemini_model = gemini_model
        self._fallback_model_name = fallback_model_name

        self._provider: Optional[str] = None  # "gemini" or "local"
        self._gemini_client = None
        self._local_model = None
        self._embedding_dimension: Optional[int] = None

        self._initialize_provider()

    # ------------------------------------------------------------------
    # Initialization
    # ------------------------------------------------------------------
    def _initialize_provider(self):
        """Select primary or fallback provider based on availability."""
        if self._gemini_api_key:
            try:
                import google.generativeai as genai
                genai.configure(api_key=self._gemini_api_key)
                # Quick validation: generate a tiny test embedding
                result = genai.embed_content(
                    model=self._gemini_model,
                    content="test",
                    task_type="retrieval_document",
                )
                self._embedding_dimension = len(result["embedding"])
                self._gemini_client = genai
                self._provider = "gemini"
                logger.info(
                    "EmbeddingService: Gemini provider initialized successfully "
                    "(model=%s, dim=%d)", self._gemini_model, self._embedding_dimension
                )
                return
            except Exception as e:
                logger.warning(
                    "EmbeddingService: Gemini initialization failed (%s). "
                    "Falling back to local model.", str(e)
                )

        # Fallback to local sentence-transformers
        self._init_local_model()

    def _init_local_model(self):
        """Initialize local sentence-transformers model as fallback."""
        try:
            from sentence_transformers import SentenceTransformer
            self._local_model = SentenceTransformer(self._fallback_model_name)
            self._provider = "local"
            self._embedding_dimension = self._local_model.get_sentence_embedding_dimension()
            logger.info(
                "EmbeddingService: Local provider initialized "
                "(model=%s, dim=%d)", self._fallback_model_name, self._embedding_dimension
            )
        except Exception as e:
            logger.error(
                "EmbeddingService: Failed to initialize local model: %s", str(e)
            )
            raise RuntimeError(
                f"No embedding provider available. "
                f"Gemini API key is missing/invalid and local model failed: {e}"
            )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    @property
    def provider_name(self) -> str:
        """Return the name of the active provider."""
        if self._provider == "gemini":
            return f"Gemini ({self._gemini_model})"
        return f"Local ({self._fallback_model_name})"

    @property
    def dimension(self) -> int:
        """Return the embedding vector dimensionality."""
        return self._embedding_dimension or 384

    def generate_embedding(self, text: str) -> List[float]:
        """
        Generate a single embedding vector for the given text.
        
        Args:
            text: Input text to embed.
        
        Returns:
            List of floats representing the embedding vector.
        """
        if not text or not text.strip():
            logger.warning("EmbeddingService: Empty text provided, returning zero vector.")
            return [0.0] * self.dimension

        try:
            if self._provider == "gemini":
                return self._embed_gemini(text)
            else:
                return self._embed_local(text)
        except Exception as e:
            logger.error("EmbeddingService: Embedding generation failed: %s", str(e))
            # If Gemini fails at runtime, attempt fallback
            if self._provider == "gemini":
                logger.info("EmbeddingService: Attempting runtime fallback to local model.")
                try:
                    self._init_local_model()
                    return self._embed_local(text)
                except Exception as fallback_err:
                    logger.error("EmbeddingService: Fallback also failed: %s", str(fallback_err))
            raise

    def generate_embeddings_batch(self, texts: List[str]) -> List[List[float]]:
        """
        Generate embeddings for a batch of texts.
        
        Args:
            texts: List of input strings.
        
        Returns:
            List of embedding vectors.
        """
        if not texts:
            return []

        logger.info(
            "EmbeddingService: Generating batch embeddings for %d texts using %s",
            len(texts), self.provider_name
        )

        try:
            if self._provider == "gemini":
                return self._embed_gemini_batch(texts)
            else:
                return self._embed_local_batch(texts)
        except Exception as e:
            logger.error("EmbeddingService: Batch embedding failed: %s", str(e))
            # Runtime fallback
            if self._provider == "gemini":
                logger.info("EmbeddingService: Attempting runtime fallback to local model for batch.")
                try:
                    self._init_local_model()
                    return self._embed_local_batch(texts)
                except Exception as fallback_err:
                    logger.error("EmbeddingService: Batch fallback failed: %s", str(fallback_err))
            raise

    # ------------------------------------------------------------------
    # Private: Gemini
    # ------------------------------------------------------------------
    def _embed_gemini(self, text: str) -> List[float]:
        """Generate a single embedding using Gemini API."""
        result = self._gemini_client.embed_content(
            model=self._gemini_model,
            content=text,
            task_type="retrieval_document",
        )
        return result["embedding"]

    def _embed_gemini_batch(self, texts: List[str]) -> List[List[float]]:
        """Generate batch embeddings using Gemini API."""
        embeddings = []
        # Gemini embed_content supports single content at a time;
        # batch by iterating (API may add native batch in future)
        for text in texts:
            if not text or not text.strip():
                embeddings.append([0.0] * self.dimension)
            else:
                result = self._gemini_client.embed_content(
                    model=self._gemini_model,
                    content=text,
                    task_type="retrieval_document",
                )
                embeddings.append(result["embedding"])
        return embeddings

    # ------------------------------------------------------------------
    # Private: Local sentence-transformers
    # ------------------------------------------------------------------
    def _embed_local(self, text: str) -> List[float]:
        """Generate a single embedding using local model."""
        embedding = self._local_model.encode(text, convert_to_numpy=True)
        return embedding.tolist()

    def _embed_local_batch(self, texts: List[str]) -> List[List[float]]:
        """Generate batch embeddings using local model."""
        embeddings = self._local_model.encode(texts, convert_to_numpy=True, show_progress_bar=False)
        return [emb.tolist() for emb in embeddings]
