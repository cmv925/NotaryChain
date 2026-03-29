"""
ANAN Reputation & Agent Self-Tuning Service
Tracks per-agent accuracy over time and auto-adjusts consensus weights.
"""
import os
from datetime import datetime, timezone, timedelta

# Rolling window for accuracy calculation
ACCURACY_WINDOW_DAYS = 30
MIN_SAMPLES_FOR_TUNING = 5
WEIGHT_ADJUSTMENT_RATE = 0.02  # Max weight shift per tuning cycle
MIN_WEIGHT = 0.15
MAX_WEIGHT = 0.55


async def record_ceremony_outcome(db, ceremony_id: str, agents: dict, consensus_result: str, override: str = None):
    """Record agent predictions + outcome for accuracy tracking."""
    now = datetime.now(timezone.utc).isoformat()
    final_outcome = override if override else ("correct" if consensus_result == "APPROVED" else "incorrect")

    for agent_name in ["verifier", "witness", "sealer"]:
        agent_data = agents.get(agent_name, {})
        score = agent_data.get("score")
        if score is None:
            continue

        agent_predicted = "pass" if score >= 60 else "fail"
        was_correct = (
            (agent_predicted == "pass" and final_outcome in ("correct", "approve"))
            or (agent_predicted == "fail" and final_outcome in ("incorrect", "reject"))
        )

        record = {
            "ceremony_id": ceremony_id,
            "agent": agent_name,
            "score": score,
            "predicted": agent_predicted,
            "final_outcome": final_outcome,
            "was_correct": was_correct,
            "override": override,
            "recorded_at": now,
        }
        await db.anan_agent_accuracy.insert_one(record)


async def get_agent_reputation(db, agent_name: str) -> dict:
    """Get reputation stats for a single agent."""
    now = datetime.now(timezone.utc)

    # All-time stats
    total = await db.anan_agent_accuracy.count_documents({"agent": agent_name})
    correct = await db.anan_agent_accuracy.count_documents({"agent": agent_name, "was_correct": True})

    # 30-day rolling window
    window_start = (now - timedelta(days=ACCURACY_WINDOW_DAYS)).isoformat()
    total_30d = await db.anan_agent_accuracy.count_documents(
        {"agent": agent_name, "recorded_at": {"$gte": window_start}}
    )
    correct_30d = await db.anan_agent_accuracy.count_documents(
        {"agent": agent_name, "was_correct": True, "recorded_at": {"$gte": window_start}}
    )

    # 7-day window
    window_7d = (now - timedelta(days=7)).isoformat()
    total_7d = await db.anan_agent_accuracy.count_documents(
        {"agent": agent_name, "recorded_at": {"$gte": window_7d}}
    )
    correct_7d = await db.anan_agent_accuracy.count_documents(
        {"agent": agent_name, "was_correct": True, "recorded_at": {"$gte": window_7d}}
    )

    # Average score
    avg_pipeline = [
        {"$match": {"agent": agent_name, "score": {"$ne": None}}},
        {"$group": {"_id": None, "avg_score": {"$avg": "$score"}}},
    ]
    avg_raw = await db.anan_agent_accuracy.aggregate(avg_pipeline).to_list(1)
    avg_score = round(avg_raw[0]["avg_score"], 1) if avg_raw and avg_raw[0].get("avg_score") else 0

    return {
        "agent": agent_name,
        "all_time": {
            "total": total,
            "correct": correct,
            "accuracy": round(correct / max(total, 1) * 100, 1),
        },
        "last_30d": {
            "total": total_30d,
            "correct": correct_30d,
            "accuracy": round(correct_30d / max(total_30d, 1) * 100, 1),
        },
        "last_7d": {
            "total": total_7d,
            "correct": correct_7d,
            "accuracy": round(correct_7d / max(total_7d, 1) * 100, 1),
        },
        "avg_score": avg_score,
    }


async def get_all_reputations(db) -> dict:
    """Get reputation stats for all 3 agents."""
    results = {}
    for agent in ["verifier", "witness", "sealer"]:
        results[agent] = await get_agent_reputation(db, agent)
    return results


async def compute_tuned_weights(db) -> dict:
    """Auto-tune agent weights based on rolling accuracy."""
    from services.anan_swarm import AGENT_WEIGHTS

    reputations = await get_all_reputations(db)

    # Check if we have enough data
    total_samples = sum(r["last_30d"]["total"] for r in reputations.values())
    if total_samples < MIN_SAMPLES_FOR_TUNING:
        return {
            "weights": dict(AGENT_WEIGHTS),
            "tuned": False,
            "reason": f"Insufficient data ({total_samples}/{MIN_SAMPLES_FOR_TUNING} samples needed)",
            "reputations": reputations,
        }

    # Compute accuracy-weighted adjustments
    accuracies = {}
    for agent, rep in reputations.items():
        acc = rep["last_30d"]["accuracy"] / 100.0 if rep["last_30d"]["total"] > 0 else 0.5
        accuracies[agent] = max(0.1, acc)  # Floor at 10%

    # Normalize accuracies to sum to 1.0
    total_acc = sum(accuracies.values())
    target_weights = {k: v / total_acc for k, v in accuracies.items()}

    # Apply gradual adjustment toward target
    current_weights = dict(AGENT_WEIGHTS)
    new_weights = {}
    for agent in ["verifier", "witness", "sealer"]:
        current = current_weights[agent]
        target = target_weights[agent]
        diff = target - current
        adjustment = max(-WEIGHT_ADJUSTMENT_RATE, min(WEIGHT_ADJUSTMENT_RATE, diff))
        new_weight = max(MIN_WEIGHT, min(MAX_WEIGHT, current + adjustment))
        new_weights[agent] = round(new_weight, 4)

    # Re-normalize to sum to 1.0
    total_w = sum(new_weights.values())
    new_weights = {k: round(v / total_w, 4) for k, v in new_weights.items()}

    return {
        "weights": new_weights,
        "previous_weights": current_weights,
        "tuned": True,
        "accuracies": {k: round(v * 100, 1) for k, v in accuracies.items()},
        "reputations": reputations,
    }


async def apply_tuned_weights(db) -> dict:
    """Compute and persist tuned weights."""
    result = await compute_tuned_weights(db)
    if result["tuned"]:
        now = datetime.now(timezone.utc).isoformat()
        await db.anan_weight_history.insert_one({
            "weights": result["weights"],
            "previous": result.get("previous_weights"),
            "accuracies": result.get("accuracies"),
            "applied_at": now,
        })

        # Update the live weights in anan_swarm module
        import services.anan_swarm as swarm
        for agent, weight in result["weights"].items():
            swarm.AGENT_WEIGHTS[agent] = weight

    return result
