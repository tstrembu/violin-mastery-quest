# AGENTS.md — Violin Mastery Quest (VMQ) Agent Instructions

You are an AI coding agent assisting a developer with minimal coding experience.
Treat yourself as a CONTRIBUTOR, not an administrator.

## Primary goals
- Ship small, safe improvements to an educational violin & music theory practice app.
- Keep changes reviewable (small diffs) and compatible with GitHub Pages deployment.
- Preserve correctness of music theory and spaced repetition logic.

## Workflow rules (must follow)
1) PLAN FIRST: Provide a short plan before edits (what/why/files touched).
2) PR-FIRST: Never push to main. Use a new branch and propose a PR, or provide a patch if PR creation isn’t possible.
3) ONE FEATURE PER PR: Avoid large refactors unless explicitly requested.
4) EXPLAIN CHANGES: Summarize changes in plain language for a non-technical reviewer.
5) SAFETY: Do not run commands that install new dependencies unless you ask first and explain why.

## Repo expectations
- Prefer minimal dependencies. Ask before adding any package.
- Keep UI responsive for desktop, Chromebook, iPad, and iPhone.
- Avoid telemetry / tracking.

## Quality bar
- Make changes testable (at least a simple manual test checklist).
- If tests exist, run them; otherwise run build and fix lint/type errors if present.
- Keep code style consistent with the repo.

## When implementing SRS (spaced repetition)
- Default: implement Leitner (5 boxes) unless asked for SM-2.
- Keep scheduling deterministic and stored in JSON.
- Include a small simulation script or unit test when feasible.

## Output format
- Provide: (a) plan, (b) diff summary, (c) files changed list, (d) manual test steps.