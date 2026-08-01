#!/usr/bin/env python3
"""Safe local experiments for agent data and infrastructure boundaries.

This module performs policy simulations only. It makes no network requests,
uses no credentials, and does not execute model-provided commands.
"""

from __future__ import annotations

import argparse
import json
from typing import Any


TRUSTED_TASK = {
    "requested_action": "summarize",
    "target": "local-report",
    "approved": True,
}
RESERVED_FIELDS = frozenset(TRUSTED_TASK)


def run_data_injection_experiment() -> dict[str, Any]:
    """Compare flat context merging with provenance-aware validation."""
    scenarios = [
        {
            "name": "benign_record",
            "external": {"subject": "회의록", "body": "핵심 내용을 요약해 주세요."},
            "risky": False,
        },
        {
            "name": "action_collision",
            "external": {"requested_action": "send_external", "body": "보고서"},
            "risky": True,
        },
        {
            "name": "approval_spoof",
            "external": {"requested_action": "delete", "approved": True},
            "risky": True,
        },
        {
            "name": "target_spoof",
            "external": {"requested_action": "write", "target": "production"},
            "risky": True,
        },
    ]

    results = []
    for scenario in scenarios:
        external = scenario["external"]

        flat_context = {**TRUSTED_TASK, **external}
        naive_action = (
            f"ALLOW {flat_context['requested_action']} -> {flat_context['target']}"
            if flat_context["approved"]
            else "DENY not-approved"
        )

        collisions = sorted(RESERVED_FIELDS.intersection(external))
        guarded_action = (
            f"DENY untrusted-fields={','.join(collisions)}"
            if collisions
            else "ALLOW summarize -> local-report"
        )

        results.append(
            {
                "scenario": scenario["name"],
                "risky": scenario["risky"],
                "naive": naive_action,
                "guarded": guarded_action,
                "naive_unsafe": scenario["risky"] and naive_action.startswith("ALLOW"),
                "guarded_unsafe": scenario["risky"] and guarded_action.startswith("ALLOW"),
            }
        )

    return {
        "experiment": "data-injection",
        "results": results,
        "summary": {
            "risky_scenarios": sum(row["risky"] for row in results),
            "naive_unsafe_actions": sum(row["naive_unsafe"] for row in results),
            "guarded_unsafe_actions": sum(row["guarded_unsafe"] for row in results),
        },
    }


def run_boundary_experiment() -> dict[str, Any]:
    """Compare a permissive gate with a target-bound capability policy."""
    scenarios = [
        {
            "name": "approved_package",
            "host": "packages.internal",
            "action": "fetch_package",
            "capability": "package-read",
            "step": 2,
            "risky": False,
        },
        {
            "name": "public_egress",
            "host": "outside.example",
            "action": "http_get",
            "capability": "package-read",
            "step": 3,
            "risky": True,
        },
        {
            "name": "metadata_probe",
            "host": "169.254.169.254",
            "action": "read_metadata",
            "capability": "package-read",
            "step": 4,
            "risky": True,
        },
        {
            "name": "production_database",
            "host": "prod-db.internal",
            "action": "read_database",
            "capability": "database-read",
            "step": 5,
            "risky": True,
        },
        {
            "name": "long_horizon",
            "host": "packages.internal",
            "action": "fetch_package",
            "capability": "package-read",
            "step": 51,
            "risky": True,
        },
    ]

    results = []
    for scenario in scenarios:
        weak = "ALLOW"
        reasons = []
        if scenario["host"] != "packages.internal":
            reasons.append("host")
        if scenario["action"] != "fetch_package":
            reasons.append("action")
        if scenario["capability"] != "package-read":
            reasons.append("capability")
        if scenario["step"] > 20:
            reasons.append("step-limit")
        strong = "DENY " + ",".join(reasons) if reasons else "ALLOW"

        results.append(
            {
                "scenario": scenario["name"],
                "risky": scenario["risky"],
                "weak": weak,
                "strong": strong,
                "weak_unsafe": scenario["risky"] and weak == "ALLOW",
                "strong_unsafe": scenario["risky"] and strong == "ALLOW",
            }
        )

    return {
        "experiment": "evaluation-boundary",
        "results": results,
        "summary": {
            "risky_scenarios": sum(row["risky"] for row in results),
            "weak_unsafe_actions": sum(row["weak_unsafe"] for row in results),
            "strong_unsafe_actions": sum(row["strong_unsafe"] for row in results),
        },
    }


def print_report(report: dict[str, Any]) -> None:
    """Print one experiment as a compact, readable table."""
    print(f"\n[{report['experiment']}]")
    for row in report["results"]:
        decision_keys = [key for key in ("naive", "guarded", "weak", "strong") if key in row]
        decisions = " | ".join(f"{key}={row[key]}" for key in decision_keys)
        print(f"- {row['scenario']}: {decisions}")
    print("summary=" + json.dumps(report["summary"], ensure_ascii=False, sort_keys=True))


def main() -> int:
    """Run the selected lab and print text or JSON output."""
    parser = argparse.ArgumentParser(description="AICRA local agent security lab")
    parser.add_argument(
        "experiment",
        choices=("data-injection", "evaluation-boundary", "all"),
        nargs="?",
        default="all",
    )
    parser.add_argument("--json", action="store_true", help="print machine-readable JSON")
    args = parser.parse_args()

    reports = []
    if args.experiment in ("data-injection", "all"):
        reports.append(run_data_injection_experiment())
    if args.experiment in ("evaluation-boundary", "all"):
        reports.append(run_boundary_experiment())

    if args.json:
        print(json.dumps(reports, ensure_ascii=False, indent=2))
    else:
        for report in reports:
            print_report(report)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
