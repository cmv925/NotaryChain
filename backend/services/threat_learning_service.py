"""
Auto-Learning Threat Detection Service
Analyzes GPT-5.2 ceremony responses to discover and learn new threat patterns.
"""
from datetime import datetime, timezone
import logging
import re
import uuid

logger = logging.getLogger(__name__)


THREAT_KEYWORDS = {
    "identity": ["fake id", "forged", "stolen identity", "identity theft", "impersonation", "synthetic identity", "fraudulent credentials"],
    "document": ["altered document", "tampered", "forgery", "counterfeit", "doctored", "falsified", "fabricated"],
    "biometric": ["spoofing", "deepfake", "photo attack", "mask attack", "replay attack", "liveness fail"],
    "transaction": ["money laundering", "unusual amount", "structuring", "smurfing", "suspicious transfer", "shell company"],
}

SEVERITY_THRESHOLDS = {
    "critical": 0.3,   # confidence < 30% → critical
    "high": 0.5,       # confidence < 50% → high
    "medium": 0.7,     # confidence < 70% → medium
    "low": 1.0,        # confidence < 100% → low
}


def _classify_severity(confidence: float) -> str:
    for sev, threshold in SEVERITY_THRESHOLDS.items():
        if confidence < threshold:
            return sev
    return "low"


def _extract_indicators(text: str) -> list:
    """Extract threat indicator keywords from GPT-5.2 response text."""
    indicators = []
    text_lower = text.lower()
    for category, keywords in THREAT_KEYWORDS.items():
        for kw in keywords:
            if kw in text_lower:
                indicators.append({"keyword": kw, "category": category})
    return indicators


async def analyze_ceremony_response(db, ceremony: dict) -> dict:
    """Analyze a completed ceremony's agent responses for threat signals.
    
    Returns a summary of detected threats and any auto-created patterns.
    """
    agents = ceremony.get("agents", {})
    ceremony_id = ceremony.get("ceremony_id", "unknown")
    doc_type = ceremony.get("document_type", "general")

    threats_found = []
    new_patterns = []

    for agent_name, agent_data in agents.items():
        if not isinstance(agent_data, dict):
            continue

        verdict = agent_data.get("verdict", "")
        confidence = agent_data.get("confidence")
        details = agent_data.get("details", {})

        # Skip passing agents with high confidence
        if verdict == "PASS" and confidence and confidence > 0.8:
            continue

        # Analyze details text for threat indicators
        detail_text = ""
        if isinstance(details, dict):
            for v in details.values():
                if isinstance(v, str):
                    detail_text += f" {v}"
                elif isinstance(v, dict):
                    for sv in v.values():
                        if isinstance(sv, str):
                            detail_text += f" {sv}"
        elif isinstance(details, str):
            detail_text = details

        indicators = _extract_indicators(detail_text)

        if verdict == "FAIL" or (confidence and confidence < 0.7) or indicators:
            severity = _classify_severity(confidence or 0.5)
            threat = {
                "agent": agent_name,
                "verdict": verdict,
                "confidence": confidence,
                "severity": severity,
                "indicators": [ind["keyword"] for ind in indicators],
                "categories": list(set(ind["category"] for ind in indicators)) if indicators else ["general"],
            }
            threats_found.append(threat)

            # Auto-create pattern if novel
            for cat in threat["categories"]:
                existing = await db.fraud_patterns.find_one({
                    "category": cat,
                    "auto_learned": True,
                    "indicators": {"$in": threat["indicators"]} if threat["indicators"] else [],
                }, {"_id": 0, "pattern_id": 1})

                if not existing and threat["indicators"]:
                    pattern = {
                        "pattern_id": f"AL-{uuid.uuid4().hex[:6].upper()}",
                        "category": cat,
                        "title": f"Auto-Learned: {cat.title()} Anomaly ({agent_name})",
                        "description": f"Pattern detected from ceremony {ceremony_id[:8]}. Agent '{agent_name}' flagged with {severity} severity (confidence: {confidence or 'N/A'}).",
                        "severity": severity,
                        "indicators": threat["indicators"],
                        "document_types": [doc_type],
                        "active": True,
                        "auto_learned": True,
                        "source_ceremony": ceremony_id,
                        "source_agent": agent_name,
                        "created_at": datetime.now(timezone.utc).isoformat(),
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                        "hit_count": 1,
                    }
                    await db.fraud_patterns.insert_one(pattern)
                    pattern.pop("_id", None)
                    new_patterns.append(pattern)
                    logger.info(f"Auto-learned threat pattern: {pattern['pattern_id']} ({cat})")
                elif existing:
                    # Increment hit_count on existing pattern
                    await db.fraud_patterns.update_one(
                        {"pattern_id": existing["pattern_id"]},
                        {"$inc": {"hit_count": 1}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
                    )

    # Store analysis result
    analysis = {
        "analysis_id": f"TA-{uuid.uuid4().hex[:8]}",
        "ceremony_id": ceremony_id,
        "analyzed_at": datetime.now(timezone.utc).isoformat(),
        "threats_detected": len(threats_found),
        "patterns_created": len(new_patterns),
        "threat_details": threats_found,
        "new_pattern_ids": [p["pattern_id"] for p in new_patterns],
    }
    await db.threat_analyses.insert_one(analysis)
    analysis.pop("_id", None)

    return analysis


async def get_threat_analytics(db) -> dict:
    """Get aggregated threat detection analytics."""
    total_analyses = await db.threat_analyses.count_documents({})
    total_threats = 0
    async for a in db.threat_analyses.find({}, {"_id": 0, "threats_detected": 1}):
        total_threats += a.get("threats_detected", 0)

    auto_patterns = await db.fraud_patterns.count_documents({"auto_learned": True})
    active_auto = await db.fraud_patterns.count_documents({"auto_learned": True, "active": True})
    manual_patterns = await db.fraud_patterns.count_documents({"auto_learned": {"$ne": True}})

    # Top indicators
    top_indicators = {}
    async for p in db.fraud_patterns.find({"auto_learned": True}, {"_id": 0, "indicators": 1, "hit_count": 1}):
        for ind in p.get("indicators", []):
            top_indicators[ind] = top_indicators.get(ind, 0) + p.get("hit_count", 1)
    sorted_indicators = sorted(top_indicators.items(), key=lambda x: x[1], reverse=True)[:10]

    # Recent analyses
    recent = []
    async for a in db.threat_analyses.find({}, {"_id": 0}).sort("analyzed_at", -1).limit(10):
        recent.append(a)

    return {
        "total_analyses": total_analyses,
        "total_threats_detected": total_threats,
        "auto_learned_patterns": auto_patterns,
        "active_auto_patterns": active_auto,
        "manual_patterns": manual_patterns,
        "top_indicators": [{"keyword": k, "hits": v} for k, v in sorted_indicators],
        "recent_analyses": recent,
        "learning_rate": round(auto_patterns / max(total_analyses, 1), 2),
    }
