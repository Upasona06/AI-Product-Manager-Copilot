-- ============================================================
-- AI Product Manager Copilot — Module 7 RAG Migration
-- Version: 7.0.0  |  Module: 7 (Knowledge Base & RAG Engine)
-- Database: PostgreSQL 15+
-- Run: psql -U postgres -d ai_pm_copilot -f add_rag_tables.sql
-- ============================================================

-- ============================================================
-- TABLE: rag_search_history
-- Tracks semantic search queries for analytics and UI history
-- Note: Vector embeddings are stored in ChromaDB, not PostgreSQL
-- ============================================================
CREATE TABLE IF NOT EXISTS rag_search_history (
    search_id               UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID            NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    project_id              UUID            NOT NULL,
    query_text              TEXT            NOT NULL CONSTRAINT chk_rag_query_not_empty CHECK (LENGTH(TRIM(query_text)) > 0),
    results_count           INTEGER         NOT NULL DEFAULT 0 CHECK (results_count >= 0),
    top_similarity_score    FLOAT           CHECK (top_similarity_score IS NULL OR (top_similarity_score >= 0 AND top_similarity_score <= 1)),
    embedding_model         VARCHAR(255)    NOT NULL DEFAULT 'unknown',
    search_timestamp        TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rag_search_user_id       ON rag_search_history (user_id);
CREATE INDEX IF NOT EXISTS idx_rag_search_project_id    ON rag_search_history (project_id);
CREATE INDEX IF NOT EXISTS idx_rag_search_timestamp     ON rag_search_history (search_timestamp DESC);

COMMENT ON TABLE  rag_search_history                          IS 'Tracks semantic search queries for the Knowledge Base UI search history and analytics.';
COMMENT ON COLUMN rag_search_history.search_id                IS 'UUID primary key, auto-generated';
COMMENT ON COLUMN rag_search_history.user_id                  IS 'FK to users — who performed the search';
COMMENT ON COLUMN rag_search_history.project_id               IS 'Project scope for the search';
COMMENT ON COLUMN rag_search_history.query_text               IS 'The natural language search query entered by the user';
COMMENT ON COLUMN rag_search_history.results_count            IS 'Number of results returned by the semantic search';
COMMENT ON COLUMN rag_search_history.top_similarity_score     IS 'Highest cosine similarity score in the result set (0.0 - 1.0)';
COMMENT ON COLUMN rag_search_history.embedding_model          IS 'Name of the embedding model used (Gemini or local)';
COMMENT ON COLUMN rag_search_history.search_timestamp         IS 'When the search was performed';

-- ============================================================
-- VERIFICATION
-- ============================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'rag_search_history') THEN
        RAISE NOTICE 'Module 7 migration complete: rag_search_history table created successfully.';
    ELSE
        RAISE WARNING 'Module 7 migration FAILED: rag_search_history table was NOT created.';
    END IF;
END $$;
