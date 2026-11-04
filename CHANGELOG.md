# changelog - @thing/sdlc-dual_engine_harness

all notable changes to this project are documented in this file using conventional commits and semantic versioning.

## [0.1.0] - 2026-11-03

### added
- **macro statechart engine**: deterministic 10-phase finite state machine (`phase_00_inception` through `phase_09_continuous_learning`) with guarded transitions and review gates.
- **task dag execution engine**: kahn-style topological sort over task dependencies with cycle detection and status tracking.
- **formal review gatekeeper**: evaluation rules for gates 1 through 4 enforcing prd, adr, test passing, immutability, mutation scores (>= 80%), security audits, and signed receipts.
- **mastra execution bridge**: coupled micro execution workflow bridge executing 4-step pipelines (context assembly, agent reasoning, ast validation, rubric scoring).
- **test immutability verification**: algorithm verifying that test assertion counts never decrease and test skips are not introduced.
- **zero-daemon persistence**: persistent session suspension and atomic resumption using local json state snapshots.
- **path traversal hardening**: strict alphanumeric sanitisation on session identifiers and containment validation for snapshot paths.
- **command-line interface**: standalone `sdlc-harness` binary providing `status`, `transition`, and `gate-check` subcommands.
