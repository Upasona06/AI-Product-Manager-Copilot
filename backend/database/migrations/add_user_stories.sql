-- ==========================================================================
-- Migration: Add user_stories table
-- Module 9: User Story Generation
-- ==========================================================================

CREATE TABLE IF NOT EXISTS user_stories (
    story_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id          UUID NOT NULL,
    prioritization_id   UUID REFERENCES prioritized_features(prioritization_id) ON DELETE SET NULL,
    feature_name        VARCHAR(255) NOT NULL,
    description         TEXT,
    story_content       TEXT NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for scoping queries by project
CREATE INDEX IF NOT EXISTS idx_user_stories_project_id 
    ON user_stories (project_id);

-- Index for looking up by backlog item
CREATE INDEX IF NOT EXISTS idx_user_stories_prioritization_id 
    ON user_stories (prioritization_id) WHERE prioritization_id IS NOT NULL;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS trg_user_stories_updated_at ON user_stories;
CREATE TRIGGER trg_user_stories_updated_at
    BEFORE UPDATE ON user_stories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Helpful comments
COMMENT ON TABLE user_stories IS 'Module 9: AI-generated user stories, acceptance criteria, and DoD';
COMMENT ON COLUMN user_stories.story_content IS 'Markdown containing generated stories, BDD acceptance criteria, and DoD';
