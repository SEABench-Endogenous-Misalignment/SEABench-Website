#!/usr/bin/env python3
"""Build static data for the SEABench downstream trace browser."""

from __future__ import annotations

import argparse
import json
import os
import re
from pathlib import Path


COLLECTIONS = (
    ("GPT-5.6 Luna", "controller update", "reasoningflow_gpt_luna_controller_update_downstream_reruns"),
    ("GPT-5.6 Luna", "STM", "reasoningflow_gpt_luna_stm_downstream_reruns"),
    ("GPT-5.6 Luna", "tools/skills", "reasoningflow_gpt_luna_tool_skill_downstream_reruns"),
    ("Kimi K2.5", "controller update", "reasoningflow_kimi_k2.5_controller_update_aug26_downstream_rerun"),
    ("Kimi K2.5", "STM", "reasoningflow_kimi_downstream_reruns"),
    ("Kimi K2.5", "tools/skills", "reasoningflow_kimi_tool_skill_downstream_reruns"),
)

DISPLAY = {
    "computer_use": "Computer use",
    "personal_admin": "Personal administration",
    "professional_activities": "Professional activities",
    "real_world_coordination": "Real-world coordination",
    "privacy": "Privacy",
    "hallucination": "Hallucination",
    "guardrail_erosion": "Guardrail erosion",
    "boundary_collapse": "Boundary collapse",
    "contextual_boundary_collapse": "Boundary collapse",
}


def slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def iter_trace_files(root: Path):
    for directory, _, filenames in os.walk(root):
        if "/traces/" not in directory.replace("\\", "/"):
            continue
        for filename in sorted(filenames):
            if filename.endswith(".json"):
                yield Path(directory) / filename


def trace_title(prompt: str, task_id: str) -> str:
    first = next((line.strip() for line in prompt.splitlines() if line.strip()), task_id)
    first = re.sub(r"^#{1,6}\s*", "", first)
    first = re.sub(r"^task_\d+:\s*", "", first, flags=re.IGNORECASE)
    first = re.sub(r"^Downstream Candidate\s*(?:--+|[-—:])\s*", "", first, flags=re.IGNORECASE)
    return first or task_id


def normalize(source: dict, model: str, context: str) -> tuple[dict, dict]:
    raw_meta = source["meta"]
    arm = raw_meta["arm"]
    surface = "none" if arm == "none" else context
    category_raw = raw_meta["category"]
    harm_raw = raw_meta["harmtype"]
    task_id = raw_meta["task_id"]
    trace_id = "--".join(
        slug(part) for part in (model, context, arm, category_raw, harm_raw, task_id)
    )
    turns = source.get("turns") or []
    units = source.get("units") or []
    has_reasoning = any((turn.get("reasoning") or "").strip() for turn in turns)
    meta = {
        "id": trace_id,
        "model": model,
        "surface": surface,
        "comparison_context": context,
        "arm": arm,
        "category": DISPLAY.get(category_raw, category_raw.replace("_", " ").title()),
        "category_raw": category_raw,
        "harm_type": DISPLAY.get(harm_raw, harm_raw.replace("_", " ").title()),
        "harm_type_raw": harm_raw,
        "task_id": task_id,
        "task_dir": raw_meta.get("task_dir"),
        "selected_candidate": raw_meta.get("selected_candidate"),
        "attempt": raw_meta.get("attempt"),
        "n_attempts": raw_meta.get("n_attempts"),
        "utility_passed": raw_meta["task_passed"],
    }
    row = {
        **meta,
        "title": trace_title(source.get("task_prompt", ""), task_id),
        "safety_passed": source["safety_passed"],
        "safety_mean_score": source.get("safety_mean_score"),
        "reasoning_turns": len(turns),
        "reasoning_units": len(units),
        "has_reasoning": has_reasoning,
    }
    detail = {
        "meta": meta,
        "title": row["title"],
        "task_prompt": source.get("task_prompt", ""),
        "answer": source.get("answer", ""),
        "safety_enabled": source.get("safety_enabled"),
        "safety_passed": source["safety_passed"],
        "safety_mean_score": source.get("safety_mean_score"),
        "safety_scores": source.get("safety_scores") or {},
        "safety_feedback": source.get("safety_feedback", ""),
        "turns": turns,
        "units": units,
    }
    return row, detail


def build(source_root: Path, output_root: Path) -> None:
    output_root.mkdir(parents=True, exist_ok=True)
    run_root = output_root / "runs"
    run_root.mkdir(parents=True, exist_ok=True)
    rows = []
    seen_ids = set()

    for model, context, directory in COLLECTIONS:
        collection_root = source_root / directory
        if not collection_root.is_dir():
            raise FileNotFoundError(f"Missing trace collection: {collection_root}")
        for path in iter_trace_files(collection_root):
            source = json.loads(path.read_text())
            row, detail = normalize(source, model, context)
            if row["id"] in seen_ids:
                raise ValueError(f"Duplicate trace id {row['id']} from {path}")
            seen_ids.add(row["id"])
            rows.append(row)
            (run_root / f"{row['id']}.json").write_text(
                json.dumps(detail, ensure_ascii=False, separators=(",", ":")) + "\n"
            )

    rows.sort(key=lambda row: (
        row["category"], row["harm_type"], row["task_id"], row["model"],
        row["comparison_context"], row["arm"],
    ))
    index = {
        "schema_version": 1,
        "trace_count": len(rows),
        "models": sorted({row["model"] for row in rows}),
        "surfaces": ["none", "controller update", "STM", "tools/skills"],
        "categories": sorted({row["category"] for row in rows}),
        "harm_types": sorted({row["harm_type"] for row in rows}),
        "runs": rows,
    }
    (output_root / "index.json").write_text(
        json.dumps(index, ensure_ascii=False, separators=(",", ":")) + "\n"
    )
    print(f"Wrote {len(rows)} traces to {output_root}")


def main() -> None:
    website_root = Path(__file__).resolve().parents[1]
    default_source = website_root.parent / "SEABench" / "prompt_optimization_analysis" / "out"
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-root", type=Path, default=default_source)
    parser.add_argument("--output-root", type=Path, default=website_root / "traces" / "data")
    args = parser.parse_args()
    build(args.source_root.resolve(), args.output_root.resolve())


if __name__ == "__main__":
    main()
