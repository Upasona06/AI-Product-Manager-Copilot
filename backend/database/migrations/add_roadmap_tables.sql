-- ==========================================================================
-- Migration: Add Roadmap Items Table
-- ==========================================================================

CREATE TABLE IF NOT EXISTS roadmap_items (
    roadmap_item_id UUID PRIMARY KEY,
    project_id UUID NOT NULL,
    prioritization_id UUID NOT NULL UNIQUE,
    horizon VARCHAR(50) NOT NULL,
    milestone_name VARCHAR(255),
    target_date VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    FOREIGN KEY (prioritization_id) REFERENCES prioritized_features(prioritization_id) ON DELETE CASCADE,
    CONSTRAINT chk_roadmap_horizon CHECK (horizon IN ('now', 'next', 'later'))
);

CREATE INDEX IF NOT EXISTS idx_roadmap_project ON roadmap_items(project_id);
