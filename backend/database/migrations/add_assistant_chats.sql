-- ==========================================================================
-- Migration: Add assistant_chats table
-- Module 9: AI Assistant Conversation History
-- ==========================================================================

CREATE TABLE IF NOT EXISTS assistant_chats (
    chat_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id    UUID NOT NULL,
    title         VARCHAR(255) NOT NULL DEFAULT 'New Conversation',
    messages      JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for scoping queries by project
CREATE INDEX IF NOT EXISTS idx_assistant_chats_project_id 
    ON assistant_chats (project_id);

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS trg_assistant_chats_updated_at ON assistant_chats;
CREATE TRIGGER trg_assistant_chats_updated_at
    BEFORE UPDATE ON assistant_chats
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Helpful comments
COMMENT ON TABLE assistant_chats IS 'Module 9: AI Assistant saved conversation sessions and messages';
COMMENT ON COLUMN assistant_chats.messages IS 'JSONB array of chat messages with sender, text, and timestamp';
