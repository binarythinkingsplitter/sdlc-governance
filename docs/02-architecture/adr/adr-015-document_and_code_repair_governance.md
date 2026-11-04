# adr: document and code repair governance feature

## status
proposed

## context
the repository requires a robust governance model for automated document and code repair. existing implementations often suffer from tight coupling between detection engines and remediation agents, leading to brittle synchronization issues, non-deterministic side effects, and insufficient audit trails across distributed subsystem boundaries. we evaluated two primary architectural patterns: a monolithically coupled repair pipeline embedding direct file mutation within validation loops, and a decoupled dual-engine architecture separating diagnostic evaluation from verified transactional execution.

## decision
we adopt the decoupled dual-engine architecture for the document and code repair governance feature. this design isolates diagnostic analysis and policy enforcement into an immutable evaluation engine, while delegating state modification and artifact generation to a separate, cryptographically verified execution engine. inter-engine communication occurs strictly via explicit, schema-validated message interfaces and signed transaction manifests.

## consequences
- positive: achieves high modularity and strict separation of concerns, preventing unauthorized or unverified mutations from reaching target repositories.
- positive: enhances auditability through immutable execution logs and clear cryptographic boundary checks.
- negative: introduces slight latency overhead due to message serialization and asynchronous dual-pass verification workflows.
- neutral: requires additional interface schemas and rigorous contract testing between diagnostic and execution engines.
