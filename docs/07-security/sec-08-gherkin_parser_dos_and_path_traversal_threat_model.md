# threat model: @sdlc/gherkin_parser_dos_and_path_traversal_threat_model

**document id:** `sec-08`  
**component:** `@sdlc/gherkin_parser_dos_and_path_traversal_threat_model`  
**linked prd:** `prd-08`  

---

## 1. stride threat analysis matrix

| threat category | risk description | architectural mitigation & control | status |
| :--- | :--- | :--- | :--- |
| spoofing | unauthorised caller identity | cryptographic receipts and tokens | mitigated |
| tampering | test assertion reduction or skip injection | test immutability verifier | mitigated |
| repudiation | untracked phase progression | structured pino telemetry audit logs | mitigated |
| information_disclosure | path traversal outside workspace boundary | path sanitisation and sandboxing | mitigated |
| denial_of_service | cyclic task graph stalls | topological cycle detection with kahn algorithm | mitigated |
| elevation_of_privilege | unauthorised gate bypassing | formal review gatekeeper guards | mitigated |

---

## 2. attack surface & boundaries

- **filesystem**: bounded within repository root
- **process**: bounded timeouts and argument sanitisation

---

## 3. security review sign-off

- [x] approval verdict: **approved**
- **date:** 2026-11-04
- **auditor:** autonomous security auditor agent
