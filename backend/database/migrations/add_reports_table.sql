-- ==========================================================================
-- Migration: Add Product Reports Table
-- ==========================================================================

CREATE TABLE IF NOT EXISTS product_reports (
    report_id UUID PRIMARY KEY,
    project_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    report_type VARCHAR(100) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    CONSTRAINT chk_report_type CHECK (report_type IN ('executive_summary', 'product_strategy'))
);

CREATE INDEX IF NOT EXISTS idx_reports_project ON product_reports(project_id);
