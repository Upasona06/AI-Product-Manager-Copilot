"""
services/assistant_tools.py — Tool functions for AI Assistant function calling.

Each function queries the real database and returns structured data.
These are registered as Gemini function-calling tools so the AI can
fetch live project data instead of returning hardcoded answers.
"""

import uuid
from sqlalchemy import func, desc

from models.raw_feedback import RawFeedback
from models.classified_feedback import ClassifiedFeedback
from models.aggregated_feature import AggregatedFeature
from models.prioritized_feature import PrioritizedFeature
from models.processed_feedback import ProcessedFeedback


# ---------------------------------------------------------------------------
# Tool 1 — Top Feature Requests
# ---------------------------------------------------------------------------

def get_top_feature_requests(project_id: str, limit: int = 5) -> dict:
    """
    Fetch the top feature requests for a project from the aggregated_features table,
    ordered by frequency (most requested first).

    Args:
        project_id: The UUID of the project to query.
        limit: Number of top features to return (default 5).

    Returns:
        A dict with a list of top features including cluster label,
        frequency, importance, affected_users, dominant_sentiment,
        and trend_direction.
    """
    try:
        pid = uuid.UUID(project_id)
    except (ValueError, AttributeError):
        return {"error": "Invalid project_id format.", "features": []}

    rows = (
        AggregatedFeature.query
        .filter_by(project_id=pid)
        .order_by(desc(AggregatedFeature.frequency))
        .limit(limit)
        .all()
    )

    if not rows:
        # Fallback: query classified_feedback for Feature Request category
        clf_rows = (
            ClassifiedFeedback.query
            .filter_by(project_id=pid, ai_category="Feature Request")
            .order_by(desc(ClassifiedFeedback.weight))
            .limit(limit)
            .all()
        )
        if clf_rows:
            total = sum(r.weight for r in clf_rows)
            features = [
                {
                    "feature": r.ai_themes[0] if r.ai_themes else r.original_subject[:60],
                    "frequency": r.weight,
                    "percentage": round((r.weight / total) * 100, 1) if total else 0,
                    "sentiment": r.ai_sentiment,
                    "importance": "High" if r.weight >= 5 else "Medium",
                    "trend": "stable",
                }
                for r in clf_rows
            ]
            return {
                "source": "classified_feedback",
                "total_features": len(features),
                "features": features,
            }
        return {"source": "none", "total_features": 0, "features": []}

    total_frequency = sum(r.frequency for r in rows)
    features = [
        {
            "feature": r.cluster_label,
            "description": r.cluster_description or "",
            "frequency": r.frequency,
            "percentage": round((r.frequency / total_frequency) * 100, 1) if total_frequency else 0,
            "importance": r.importance,
            "affected_users": r.affected_users,
            "dominant_sentiment": r.dominant_sentiment,
            "trend": r.trend_direction,
            "keywords": (r.representative_keywords or [])[:5],
        }
        for r in rows
    ]

    return {
        "source": "aggregated_features",
        "total_features": len(features),
        "features": features,
    }


# ---------------------------------------------------------------------------
# Tool 2 — Feedback Summary (category + sentiment breakdown)
# ---------------------------------------------------------------------------

def get_feedback_summary(project_id: str) -> dict:
    """
    Return a complete summary of customer feedback for a project:
    total counts, category breakdown, and sentiment distribution
    from the classified_feedback table.

    Args:
        project_id: The UUID of the project.

    Returns:
        A dict with total_classified, category_counts, sentiment_counts,
        and top pain points extracted from AI analysis.
    """
    try:
        pid = uuid.UUID(project_id)
    except (ValueError, AttributeError):
        return {"error": "Invalid project_id format."}

    # Category distribution
    category_rows = (
        ClassifiedFeedback.query
        .with_entities(ClassifiedFeedback.ai_category, func.count(ClassifiedFeedback.classified_id).label("cnt"))
        .filter_by(project_id=pid)
        .group_by(ClassifiedFeedback.ai_category)
        .all()
    )

    # Sentiment distribution
    sentiment_rows = (
        ClassifiedFeedback.query
        .with_entities(ClassifiedFeedback.ai_sentiment, func.count(ClassifiedFeedback.classified_id).label("cnt"))
        .filter_by(project_id=pid)
        .group_by(ClassifiedFeedback.ai_sentiment)
        .all()
    )

    total_classified = sum(r.cnt for r in category_rows)
    total_raw = RawFeedback.query.filter_by(project_id=pid).count()
    total_pending = RawFeedback.query.filter_by(project_id=pid, processing_status="pending").count()

    category_counts = {r.ai_category: r.cnt for r in category_rows}
    sentiment_counts = {r.ai_sentiment: r.cnt for r in sentiment_rows}

    # Percentages
    category_pct = {
        cat: {"count": cnt, "percentage": round((cnt / total_classified) * 100, 1) if total_classified else 0}
        for cat, cnt in category_counts.items()
    }

    return {
        "total_raw_feedback": total_raw,
        "total_classified": total_classified,
        "total_pending_processing": total_pending,
        "category_breakdown": category_pct,
        "sentiment_breakdown": {
            s: {"count": c, "percentage": round((c / total_classified) * 100, 1) if total_classified else 0}
            for s, c in sentiment_counts.items()
        },
    }


# ---------------------------------------------------------------------------
# Tool 3 — Prioritized Backlog
# ---------------------------------------------------------------------------

def get_prioritized_backlog(project_id: str, limit: int = 10) -> dict:
    """
    Fetch the top prioritized features from the prioritized_features table
    ordered by priority_score descending (highest priority first).
    Includes RICE scores, MoSCoW category, and business recommendation.

    Args:
        project_id: The UUID of the project.
        limit: Maximum number of items to return (default 10).

    Returns:
        A dict containing a list of prioritized features with scores and
        recommendations.
    """
    try:
        pid = uuid.UUID(project_id)
    except (ValueError, AttributeError):
        return {"error": "Invalid project_id format.", "backlog": []}

    # PrioritizedFeature joins ProcessedFeedback which has project_id
    rows = (
        PrioritizedFeature.query
        .join(ProcessedFeedback, PrioritizedFeature.processed_feedback_id == ProcessedFeedback.processed_id)
        .filter(ProcessedFeedback.project_id == pid)
        .order_by(desc(PrioritizedFeature.priority_score))
        .limit(limit)
        .all()
    )

    if not rows:
        return {"total": 0, "backlog": [], "note": "No prioritized features found. Run AI Prioritization first."}

    backlog = [
        {
            "rank": i + 1,
            "feature": r.feature_name,
            "description": r.description or "",
            "priority_class": r.priority_class,
            "priority_score": round(r.priority_score, 2),
            "moscow_category": r.moscow_category,
            "rice_score": round(r.rice_score, 2),
            "rice_reach": r.rice_reach,
            "rice_impact": round(r.rice_impact, 2),
            "rice_confidence": round(r.rice_confidence, 1),
            "rice_effort": round(r.rice_effort, 2),
            "impact_score": round(r.impact_score, 2),
            "effort_score": round(r.effort_score, 2),
            "roi_score": round(r.roi_score, 2),
            "recommendation": r.business_recommendation,
        }
        for i, r in enumerate(rows)
    ]

    return {
        "total": len(backlog),
        "backlog": backlog,
    }


# ---------------------------------------------------------------------------
# Tool 4 — Overall Project Statistics
# ---------------------------------------------------------------------------

def get_project_statistics(project_id: str) -> dict:
    """
    Return high-level statistics for the project including counts of
    raw feedback, processed records, classified items, aggregated features,
    and prioritized features. Useful for dashboards and executive summaries.

    Args:
        project_id: The UUID of the project.

    Returns:
        A dict with counts for each pipeline stage.
    """
    try:
        pid = uuid.UUID(project_id)
    except (ValueError, AttributeError):
        return {"error": "Invalid project_id format."}

    raw_total = RawFeedback.query.filter_by(project_id=pid).count()
    raw_pending = RawFeedback.query.filter_by(project_id=pid, processing_status="pending").count()
    raw_processed = RawFeedback.query.filter_by(project_id=pid, processing_status="processed").count()
    raw_duplicate = RawFeedback.query.filter_by(project_id=pid, processing_status="duplicate").count()

    processed_total = ProcessedFeedback.query.filter_by(project_id=pid).count()
    classified_total = ClassifiedFeedback.query.filter_by(project_id=pid).count()
    aggregated_total = AggregatedFeature.query.filter_by(project_id=pid).count()

    prioritized_total = (
        PrioritizedFeature.query
        .join(ProcessedFeedback, PrioritizedFeature.processed_feedback_id == ProcessedFeedback.processed_id)
        .filter(ProcessedFeedback.project_id == pid)
        .count()
    )

    return {
        "raw_feedback": {
            "total": raw_total,
            "pending": raw_pending,
            "processed": raw_processed,
            "duplicate": raw_duplicate,
        },
        "processed_feedback": processed_total,
        "classified_feedback": classified_total,
        "aggregated_features": aggregated_total,
        "prioritized_features": prioritized_total,
        "pipeline_completion_pct": round((classified_total / raw_total) * 100, 1) if raw_total else 0,
    }


# ---------------------------------------------------------------------------
# Registry — maps function name → callable for dispatcher
# ---------------------------------------------------------------------------

TOOL_FUNCTIONS = {
    "get_top_feature_requests": get_top_feature_requests,
    "get_feedback_summary": get_feedback_summary,
    "get_prioritized_backlog": get_prioritized_backlog,
    "get_project_statistics": get_project_statistics,
}
