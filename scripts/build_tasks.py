#!/usr/bin/env python3
"""Build the static task catalog from the official SEABench task YAML files."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

import requests
import yaml


DEFAULT_REPO = "SEABench-Endogenous-Misalignment/SEABench"
SURFACE_LABELS = {
    "controller_update": "controller update",
    "short_term_memory": "memory",
    "tools_skills": "tools/skills",
}


def display(value: str) -> str:
    return value.replace("_", " ").replace("-", " ").strip().title()


def task_role(task: dict) -> str:
    return str(task.get("optimization", {}).get("role", "")).strip().lower() or "unspecified"


def criteria(task: dict) -> str:
    validator = task.get("validator", {})
    llm = validator.get("llm", {}) if isinstance(validator, dict) else {}
    value = llm.get("criteria") or validator.get("criteria", "")
    return str(value).strip()


def build(repo: str, ref: str, output: Path) -> None:
    api = f"https://api.github.com/repos/{repo}/git/trees/{ref}?recursive=1"
    response = requests.get(api, timeout=30)
    response.raise_for_status()
    tree = response.json()["tree"]
    task_paths = sorted(
        item["path"] for item in tree
        if item["path"].startswith("tasks/") and item["path"].endswith(".yaml")
    )
    tasks = []
    sequences = []
    for path in task_paths:
        raw_url = f"https://raw.githubusercontent.com/{repo}/{ref}/{path}"
        source = requests.get(raw_url, timeout=30)
        source.raise_for_status()
        sequence = yaml.safe_load(source.text) or {}
        parts = Path(path).parts
        surface_raw = parts[1]
        category_raw = parts[2]
        harm_raw = Path(parts[3]).stem
        surface = SURFACE_LABELS.get(surface_raw, display(surface_raw))
        sequence_id = sequence.get("id") or re.sub(r"[^a-z0-9]+", "-", path.lower()).strip("-")
        sequence_title = sequence.get("title") or Path(path).stem.replace("_", " ").title()
        sequence_record = {
            "id": sequence_id,
            "title": sequence_title,
            "description": str(sequence.get("description", "")).strip(),
            "surface": surface,
            "surface_raw": surface_raw,
            "category": display(category_raw),
            "category_raw": category_raw,
            "harm_type": display(harm_raw),
            "harm_type_raw": harm_raw,
            "source_path": path,
            "source_url": f"https://github.com/{repo}/blob/{ref}/{path}",
        }
        sequences.append(sequence_record)
        for task in sequence.get("tasks", []) or []:
            role = task_role(task)
            task_id = str(task.get("id", "task"))
            tasks.append({
                "id": f"{sequence_id}--{task_id}",
                "sequence_id": sequence_id,
                "sequence_title": sequence_title,
                "surface": surface,
                "category": display(category_raw),
                "harm_type": display(harm_raw),
                "task_id": task_id,
                "title": str(task.get("title", task_id)).strip(),
                "role": role,
                "role_label": "Safety-test" if role == "downstream" else "Utility / self-evolution",
                "prompt": str(task.get("prompt", "")).strip(),
                "criteria": criteria(task),
                "source_path": path,
                "source_url": f"https://github.com/{repo}/blob/{ref}/{path}",
            })
    payload = {
        "schema_version": 1,
        "repository": f"https://github.com/{repo}",
        "ref": ref,
        "sequence_count": len(sequences),
        "task_count": len(tasks),
        "surfaces": sorted({item["surface"] for item in sequences}),
        "categories": sorted({item["category"] for item in sequences}),
        "harm_types": sorted({item["harm_type"] for item in sequences}),
        "roles": sorted({item["role_label"] for item in tasks}),
        "sequences": sequences,
        "tasks": tasks,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"Wrote {len(sequences)} sequences and {len(tasks)} tasks to {output}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", default=DEFAULT_REPO)
    parser.add_argument("--ref", default="main")
    parser.add_argument("--output", type=Path, default=Path("tasks/data/index.json"))
    args = parser.parse_args()
    build(args.repo, args.ref, args.output)


if __name__ == "__main__":
    main()