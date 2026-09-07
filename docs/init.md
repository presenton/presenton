# MISSION: REPOSITORY HARNESS BOOTSTRAPPING & GOVERNANCE (DSH)

You are the Lead Harness Architect and Orchestrator in DeepSeek Harness (DSH).
Your objective is to inspect this repository from scratch and set up an end-to-end, production-grade agentic harness system based on strict Harness Engineering principles.

You MUST coordinate the initialization using specialized sub-agents, enforce strict verification gates, and guarantee that all context artifacts fit optimal token budgets.

---

## CORE ARCHITECTURAL INVARIANTS (NON-NEGOTIABLE)

1. **System of Record**: The repository is the single source of truth. If a rule or constraint is not committed in repository files, it does not exist.
2. **Progressive Disclosure & Anti-Bloat**: `AGENTS.md` is a ROUTER / INDEX, strictly capped at 50–100 lines. Detailed context belongs in `docs/` and must only be loaded on demand (prevents "Lost in the Middle").
3. **Verification Gate**: No task is complete without deterministic proof. The single entrypoint `make check` must pass with exit code 0. Self-assessment by the LLM is untrusted.
4. **WIP=1 State Machine**: `PROGRESS.md` tracks strictly ONE active task at a time. It must be reset to a clean baseline upon clock-out.
5. **Maker / Checker Isolation**: Code/doc generation and verification must be executed by distinct sub-agents with fresh contexts.

---

## EXECUTION WORKFLOW

Execute the following 5 phases sequentially:

┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Phase 1: Audit  │ ──> │ Phase 2: Maker   │ ──> │ Phase 3: Gate   │ ──> │ Phase 4: Cold-  │ ──> │ Phase 5: Clean  │
│ (Inspect Stack) │     │ (Spawn & Write)  │     │ (make check)    │     │ Start Test      │     │ State Commit    │
└─────────────────┘     └──────────────────┘     └─────────────────┘     └─────────────────┘     └─────────────────┘

### Phase 1: Repository Discovery & Stack Detection
1. Analyze the repository structure, existing package files (`pyproject.toml`, `package.json`, `Cargo.toml`, etc.), source directories, and test suites.
2. Identify:
   - Primary programming language and runtime version.
   - Core frameworks, linter, formatter, type-checker, and test runner.
   - Main architectural domains and existing entrypoints.

### Phase 2: Sub-Agent Task Allocation (Maker Phase)
Spawn a **Maker Sub-Agent** to generate the standard harness files:

1. **`Makefile`**:
   - Must provide target `check` aggregating: `lint`, `typecheck`, `test`, `format-check`.
   - Must provide target `setup` (environment bootstrap) and `fix` (auto-formatting/lint fixes).

2. **`AGENTS.md` (Strict limit: 50–100 lines)**:
   - **Section 1**: Project Overview & Tech Stack (1–2 concise sentences).
   - **Section 2**: Quick Commands & Verification Gate (`make check`).
   - **Section 3**: Routing Table to `docs/` with explicit read conditions.
   - **Section 4**: Hard Invariants (WIP=1, zero type ignore bypasses, clean exit).
   - **Section 5**: Lifecycle Protocol (Clock-In -> Execute -> Verification -> Clock-Out).

3. **`PROGRESS.md`**:
   - Initialize with the baseline state:
     ```markdown
     # Progress
     No active task.
     ```

4. **`docs/` Directory Structure**:
   - Create `docs/architecture.md`: High-level component boundaries and data flows.
   - Create `docs/testing-standards.md`: Testing guidelines and mock conventions.
   - (Optional based on project) `docs/api-patterns.md` or `docs/database.md`.

5. **`.harness/hooks/` (or DSH plugin verification script)**:
   - Create `.harness/hooks/post_task_check.sh`:
     ```bash
     #!/usr/bin/env bash
     set -e
     echo "[HARNESS] Running deterministic verification gate..."
     make check
     echo "[HARNESS] Verification passed."
     ```

### Phase 3: Environment & Verification Validation
1. Execute `make setup` and `make check`.
2. If `make check` fails due to missing dependencies, configuration errors, or pre-existing code issues:
   - Fix the underlying configuration or code to establish a **green baseline**.
   - Do NOT proceed until `make check` exits with code 0.

### Phase 4: Cold-Start Acceptance Test (Checker Phase)
Spawn a **Checker Sub-Agent** with a completely fresh, isolated context (do not pass Phase 1–3 chat history).
The Checker must inspect ONLY the generated repository files and answer these 5 questions:
1. *What is this system?* (Found in `AGENTS.md` / `README.md`)
2. *How is it structured?* (Found in `docs/architecture.md`)
3. *How do I run and bootstrap it?* (Found in `Makefile` / `AGENTS.md`)
4. *How do I deterministically verify changes?* (Must locate `make check`)
5. *What is the current execution state?* (Found in `PROGRESS.md`)

**Evaluation Rule**: If the Checker fails to answer any question without guessing or burning excessive tool calls, update `AGENTS.md` / `docs/` immediately to eliminate the blind spot.

### Phase 5: Clean State & Commit (Clock-Out)
1. Verify `AGENTS.md` line count is between 50 and 100 lines.
2. Ensure `PROGRESS.md` is reset to `# Progress\n\nNo active task.`
3. Remove any temporary files, logs, or orphan test artifacts created during setup.
4. Create a clean git commit: `chore(harness): initialize repository harness and verification gates`.

---

## REQUIRED OUTPUT UPON COMPLETION

When finished, provide a concise summary containing:
1. **Detected Stack & Tooling Matrix** (Language, Linter, Type Checker, Test Runner).
2. **Harness Artifacts Map** (List of generated files with line counts).
3. **Cold-Start Verification Result** (Pass/Fail across the 5 validation questions).
4. **Verification Gate Execution Output** (Snippet of successful `make check` log).