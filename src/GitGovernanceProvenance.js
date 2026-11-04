/**
 * =========================================================================
 * module: git governance provenance, pr lifecycle & brotli pointer compression
 * =========================================================================
 * 
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: cryptographic ed25519 git commit/merge/pre-receive provenance and brotli pointer compression
 * verbose: implements the real-world engineering git and data-flow lifecycle where developers
 * commit to feature branches with ed25519-signed sdlc trailers and open pull requests, separate
 * qa-engineer and security-engineer agents test the pr commit_sha and attach signed attestations,
 * and the product-manager reviews and merges the pr into main. includes local hook verifiers,
 * zero-trust server pre-receive verification, and node:zlib brotli compression with lightweight
 * claim-check pointers so tickets and messages never carry raw code or document blobs.
 * 
 * section: export catalog
 * - compress_payload: compresses payloads with node:zlib brotli and computes sha256 digest
 * - decompress_payload: decompresses brotli envelopes and verifies sha256 integrity
 * - create_content_pointer: creates a lightweight claim-check pointer for store entities and outputs
 * - parse_git_trailers: parses sdlc-* trailers from a git commit message
 * - format_git_commit_with_trailers: formats a conventional commit message with sdlc-* trailers
 * - create_git_governance_provenance: factory creating the git/pr provenance and hook verification engine
 * =========================================================================
 */

import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { create_sdlc_rules_engine } from './SdlcRulesEngine.js';

const PROTECTED_BRANCH_PATTERNS = [
  /^main$/,
  /^master$/,
  /^develop$/,
  /^release\/.+$/,
  /^refs\/heads\/main$/,
  /^refs\/heads\/master$/,
  /^refs\/heads\/develop$/,
  /^refs\/heads\/release\/.+$/,
  /^refs\/tags\/v.+$/
];

function is_protected_branch(branch_or_ref = '') {
  const name = String(branch_or_ref || '').trim();
  for (let i = 0; i < PROTECTED_BRANCH_PATTERNS.length; i += 1) {
    if (PROTECTED_BRANCH_PATTERNS[i].test(name)) {
      return true;
    }
  }
  return false;
}

function compute_sha256_hex(input) {
  const raw = typeof input === 'string' ? input : JSON.stringify(input ?? '');
  return crypto.createHash('sha256').update(raw, 'utf-8').digest('hex');
}

/**
 * =========================================================================
 * function: compress_payload
 * =========================================================================
 * 
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: compresses a string or json payload using node:zlib brotli and computes its sha256 digest
 * verbose: serialises objects to json, computes canonical sha256, and applies brotli compression
 * so large artefacts, diffs, or message payloads are transmitted and stored compactly.
 * 
 * section: arguments
 * - data (any): string or serialisable object payload
 * - options (object, optional): { threshold_bytes, quality }
 * 
 * section: return value
 * - envelope (object): { compressed, encoding, is_json, sha256, original_bytes, compressed_bytes, data }
 * 
 * section: example
 * const env = compress_payload({ large: 'text'.repeat(1000) });
 * =========================================================================
 */
export function compress_payload(data, options = {}) {
  const is_json = typeof data !== 'string';
  const raw_str = is_json ? JSON.stringify(data ?? null) : data;
  const raw_buf = Buffer.from(raw_str, 'utf-8');
  const sha256 = crypto.createHash('sha256').update(raw_buf).digest('hex');
  const threshold = options.threshold_bytes !== undefined ? options.threshold_bytes : 0;

  if (raw_buf.length < threshold) {
    return {
      compressed: false,
      encoding: 'utf-8',
      is_json,
      sha256,
      original_bytes: raw_buf.length,
      compressed_bytes: raw_buf.length,
      data: raw_str
    };
  }

  const quality = options.quality !== undefined ? options.quality : 4;
  const compressed_buf = zlib.brotliCompressSync(raw_buf, {
    params: {
      [zlib.constants.BROTLI_PARAM_QUALITY]: quality
    }
  });

  return {
    compressed: true,
    encoding: 'br',
    is_json,
    sha256,
    original_bytes: raw_buf.length,
    compressed_bytes: compressed_buf.length,
    data: compressed_buf.toString('base64url')
  };
}

/**
 * =========================================================================
 * function: decompress_payload
 * =========================================================================
 * 
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: decompresses a brotli payload envelope and verifies its sha256 digest
 * verbose: restores the original string or object from a compressed envelope and throws
 * if the sha256 integrity check fails.
 * 
 * section: arguments
 * - envelope (object): envelope returned by compress_payload
 * 
 * section: return value
 * - restored (any): original string or parsed json object
 * 
 * section: example
 * const original = decompress_payload(env);
 * =========================================================================
 */
export function decompress_payload(envelope) {
  if (!envelope || typeof envelope !== 'object') {
    return envelope;
  }

  let raw_buf;
  if (envelope.compressed && envelope.encoding === 'br') {
    const comp_buf = Buffer.from(envelope.data, 'base64url');
    raw_buf = zlib.brotliDecompressSync(comp_buf);
  } else {
    raw_buf = Buffer.from(String(envelope.data ?? ''), 'utf-8');
  }

  if (envelope.sha256) {
    const actual_sha = crypto.createHash('sha256').update(raw_buf).digest('hex');
    if (actual_sha !== envelope.sha256) {
      throw new Error(`payload_integrity_violation: expected sha256 ${envelope.sha256}, received ${actual_sha}`);
    }
  }

  const raw_str = raw_buf.toString('utf-8');
  return envelope.is_json ? JSON.parse(raw_str) : raw_str;
}

/**
 * =========================================================================
 * function: create_content_pointer
 * =========================================================================
 * 
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: creates a lightweight claim-check pointer with sha256 digest and optional brotli envelope
 * verbose: enables tickets, messages, and supervisor handoffs to pass compact references
 * (`ref`, `sha256`, `summary`, `branch`, `commit_sha`) instead of copying large blobs.
 * 
 * section: arguments
 * - entity_type (string): entity or artefact type (e.g. 'prd', 'adr', 'workflow_output', 'pr')
 * - entity_id (string): canonical identifier
 * - payload (any): full payload to fingerprint and summarize
 * - options (object, optional): { include_compressed, summary, branch, commit_sha, pr_id, changed_files }
 * 
 * section: return value
 * - pointer (object): lightweight pointer descriptor
 * 
 * section: example
 * const ptr = create_content_pointer('prd', 'prd-auth', prd_obj, { branch: 'feat/auth' });
 * =========================================================================
 */
export function create_content_pointer(entity_type, entity_id, payload = {}, options = {}) {
  const env = compress_payload(payload, { threshold_bytes: 0 });
  const summary = options.summary
    || payload?.title
    || payload?.summary
    || `${entity_type}:${entity_id} (${env.original_bytes} bytes -> ${env.compressed_bytes} bytes br)`;

  const pointer = {
    ref: `${entity_type}:${entity_id}@sha256:${env.sha256.slice(0, 12)}`,
    entity_type,
    entity_id,
    sha256: env.sha256,
    original_bytes: env.original_bytes,
    compressed_bytes: env.compressed_bytes,
    summary: String(summary).slice(0, 240),
    branch: options.branch || payload?.branch || null,
    commit_sha: options.commit_sha || payload?.commit_sha || null,
    pr_id: options.pr_id || payload?.pr_id || null,
    changed_files: options.changed_files || payload?.changed_files || []
  };

  if (options.include_compressed !== false) {
    pointer.compressed_envelope = env;
  }

  return pointer;
}

/**
 * =========================================================================
 * function: parse_git_trailers
 * =========================================================================
 * 
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: parses key-value git trailers from a commit message
 * verbose: extracts structured `sdlc-*` trailers from the footer of a commit message.
 * 
 * section: arguments
 * - commit_message (string): full git commit message
 * 
 * section: return value
 * - trailers (object): dictionary of lowercase trailer keys to values
 * 
 * section: example
 * const trailers = parse_git_trailers(msg);
 * =========================================================================
 */
export function parse_git_trailers(commit_message = '') {
  const lines = String(commit_message || '').split('\n');
  const trailers = {};
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    const match = /^([a-z0-9-]+):\s*(.+)$/i.exec(line);
    if (match && match[1].toLowerCase().startsWith('sdlc-')) {
      trailers[match[1].toLowerCase()] = match[2].trim();
    }
  }
  return trailers;
}

/**
 * =========================================================================
 * function: format_git_commit_with_trailers
 * =========================================================================
 * 
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: formats a lowercase conventional commit message with structured sdlc-* trailers
 * verbose: combines subject, optional body, and cryptographic sdlc provenance trailers.
 * 
 * section: arguments
 * - subject (string): conventional commit subject line
 * - trailers (object): dictionary of sdlc-* trailer keys and values
 * - body (string, optional): optional commit body
 * 
 * section: return value
 * - message (string): formatted git commit message
 * 
 * section: example
 * const msg = format_git_commit_with_trailers('feat(auth): add login', { 'sdlc-epic': 'auth' });
 * =========================================================================
 */
export function format_git_commit_with_trailers(subject, trailers = {}, body = '') {
  const clean_subject = String(subject || 'chore(sdlc): governed commit').trim().toLowerCase();
  const trailer_lines = [];
  const entries = Object.entries(trailers || {});
  for (let i = 0; i < entries.length; i += 1) {
    const [k, v] = entries[i];
    if (v !== undefined && v !== null && v !== '') {
      const key = k.startsWith('sdlc-') ? k : `sdlc-${k}`;
      trailer_lines.push(`${key}: ${v}`);
    }
  }
  const parts = [clean_subject];
  if (body && String(body).trim().length > 0) {
    parts.push(String(body).trim().toLowerCase());
  }
  if (trailer_lines.length > 0) {
    parts.push(trailer_lines.join('\n'));
  }
  return parts.join('\n\n');
}

/**
 * =========================================================================
 * function: create_git_governance_provenance
 * =========================================================================
 * 
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: creates the cryptographic git branch, commit, pull request, merge, and hook provenance engine
 * verbose: manages ed25519 role keypairs, enforces real-world developer branch commits,
 * qa/security pr attestations, product-manager pr merges, and local/server pre-receive verification.
 * 
 * section: arguments
 * - options (object, optional): { rules_engine, verify_supervisor_token_fn, logger }
 * 
 * section: return value
 * - provenance (object): git governance provenance controller
 * 
 * section: example
 * const git_gov = create_git_governance_provenance({ rules_engine });
 * =========================================================================
 */
export class GitGovernanceProvenance {
  repo_path;
  exec_git;
  branches;
  auto_install_hooks;
  git_initialised;
  keyring;
  roles;
  verify_supervisor_token_fn;
  rules_engine;
  commits_by_sha;
  logger;
  pr_seq;
  pull_requests;

  constructor(options = {}) {
    this.rules_engine = options.rules_engine || create_sdlc_rules_engine();

    this.verify_supervisor_token_fn = options.verify_supervisor_token_fn || null;

    this.logger = options.logger || null;

    this.repo_path = options.repo_path || options.git_repo_path || null;

    this.exec_git = options.exec_git !== undefined ? Boolean(options.exec_git) : Boolean(this.repo_path);

    this.auto_install_hooks = options.install_hooks !== false;

    this.roles = [
      'sdlc-supervisor',
      'product-manager',
      'system-architect',
      'software-engineer',
      'qa-engineer',
      'security-engineer',
      'devops-engineer'
    ];

    this.keyring = new Map();

    for (let i = 0; i < this.roles.length; i += 1) {
      const role = this.roles[i];
      const kp = crypto.generateKeyPairSync('ed25519');
      this.keyring.set(role, {
        role,
        private_key: kp.privateKey,
        public_key: kp.publicKey,
        public_key_pem: kp.publicKey.export({ type: 'spki', format: 'pem' })
      });
    }

    this.branches = new Map([
      ['main', {
        name: 'main',
        protected: true,
        head_sha: '0000000000000000000000000000000000000000',
        commits: []
      }]
    ]);

    this.commits_by_sha = new Map();

    this.pull_requests = new Map();

    this.pr_seq = 0;

    this.git_initialised = false;

    if (this.exec_git && this.repo_path) {
      this.#ensure_physical_git_repo(this.repo_path);
    }

  }

  #run_git(args, cwd = this.repo_path) {
    if (!cwd) {
      throw new Error('git_repo_path_not_configured: cannot execute physical git command without repo_path');
    }
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim();
  }

  #ensure_physical_git_repo(target_dir = this.repo_path) {
    if (!this.exec_git || !target_dir) {
      return false;
    }
    if (!fs.existsSync(target_dir)) {
      fs.mkdirSync(target_dir, { recursive: true });
    }
    const dot_git = path.join(target_dir, '.git');
    if (!fs.existsSync(dot_git)) {
      try {
        this.#run_git(['init', '-b', 'main'], target_dir);
      } catch (_err) {
        this.#run_git(['init'], target_dir);
        this.#run_git(['symbolic-ref', 'HEAD', 'refs/heads/main'], target_dir);
      }
      this.#run_git(['config', 'user.name', 'sdlc-supervisor'], target_dir);
      this.#run_git(['config', 'user.email', 'sdlc-supervisor@thing.local'], target_dir);
      this.#run_git(['config', 'commit.gpgsign', 'false'], target_dir);
    }

    let head_sha = null;
    try {
      head_sha = this.#run_git(['rev-parse', '--verify', 'HEAD'], target_dir);
    } catch (_err) {
      this.#run_git(
        [
          '-c', 'user.name=sdlc-supervisor',
          '-c', 'user.email=sdlc-supervisor@thing.local',
          'commit',
          '--allow-empty',
          '--no-verify',
          '-m', 'chore(sdlc): initialise governed repository'
        ],
        target_dir
      );
      head_sha = this.#run_git(['rev-parse', 'HEAD'], target_dir);
    }

    if (head_sha && this.branches.get('main').head_sha === '0000000000000000000000000000000000000000') {
      this.branches.get('main').head_sha = head_sha;
    }

    if (this.auto_install_hooks && !this.git_initialised) {
      const hooks_dir = path.join(dot_git, 'hooks');
      if (fs.existsSync(hooks_dir)) {
        const scripts = this.#generate_hook_scripts_map();
        const hook_names = Object.keys(scripts);
        for (let i = 0; i < hook_names.length; i += 1) {
          const h_name = hook_names[i];
          const h_path = path.join(hooks_dir, h_name);
          fs.writeFileSync(h_path, scripts[h_name], { encoding: 'utf-8', mode: 0o755 });
          fs.chmodSync(h_path, 0o755);
        }
      }
    }

    this.git_initialised = true;
    return true;
  }

  #generate_hook_scripts_map() {
    return {
      'commit-msg': [
        '#!/usr/bin/env bash',
        'set -euo pipefail',
        '# local sdlc commit-msg hook: verifies sdlc-* provenance trailers',
        'if grep -qi "^chore(sdlc): initialise governed repository" "$1"; then',
        '  exit 0',
        'fi',
        'grep -qi "^sdlc-epic:" "$1" || { echo "error: missing sdlc-epic trailer"; exit 1; }',
        'grep -qiE "^sdlc-(supervisor-token-sig|supervisor-receipt-sig): ed25519:" "$1" || { echo "error: missing ed25519 supervisor signature"; exit 1; }'
      ].join('\n') + '\n',
      'pre-merge-commit': [
        '#!/usr/bin/env bash',
        'set -euo pipefail',
        '# local sdlc pre-merge-commit hook: ensures qa, security, and pm attestations exist before merge',
        'if [ -f "packages/sdlc/scripts/sdlc-gate.js" ]; then',
        '  node packages/sdlc/scripts/sdlc-gate.js check --phase=07',
        'fi',
        'exit 0'
      ].join('\n') + '\n',
      'pre-receive': [
        '#!/usr/bin/env bash',
        'set -euo pipefail',
        '# server-side zero-trust sdlc pre-receive hook',
        'while read -r old_sha new_sha ref_name; do',
        '  git log --format="%B" "${old_sha}..${new_sha}" | grep -qi "sdlc-supervisor" || { echo "reject: unsigned sdlc push to ${ref_name}"; exit 1; }',
        'done'
      ].join('\n') + '\n'
    };
  }

  #sign_for_role(role, canonical_payload) {
    const entry = this.keyring.get(role);
    if (!entry) {
      throw new Error(`unknown_signing_role: "${role}"`);
    }
    const sig = crypto.sign(null, Buffer.from(canonical_payload, 'utf-8'), entry.private_key);
    return `ed25519:${sig.toString('base64url')}`;
  }

  #verify_role_signature(role, canonical_payload, formatted_sig) {
    const entry = this.keyring.get(role);
    if (!entry || typeof formatted_sig !== 'string' || !formatted_sig.startsWith('ed25519:')) {
      return false;
    }
    try {
      const raw_b64 = formatted_sig.slice('ed25519:'.length);
      const sig_buf = Buffer.from(raw_b64, 'base64url');
      return crypto.verify(null, Buffer.from(canonical_payload, 'utf-8'), entry.public_key, sig_buf);
    } catch (_err) {
      return false;
    }
  }

  #compute_canonical_commit_payload({ epic_id, ticket_id, role, phase, tree_sha256 }) {
    return `${epic_id || 'epic'}|${ticket_id || 'ticket'}|${role || 'role'}|${phase || 'phase'}|${tree_sha256 || ''}`;
  }

  #compute_canonical_attestation_payload({ pr_id, commit_sha, role, verdict }) {
    return `${pr_id}|${commit_sha}|${role}|${verdict}`;
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: returns public keys for sdlc-supervisor and all 6 specialist roles
   * verbose: exposes spki pem public keys for external or server-side signature verification.
   * 
   * section: arguments
   * none
   * 
   * section: return value
   * - keys (object): map of role name to pem public key
   * 
   * section: example
   * const pub_keys = provenance.get_public_keys();
   */
  get_public_keys() {
    const out = {};
    for (let i = 0; i < this.roles.length; i += 1) {
      const r = this.roles[i];
      out[r] = this.keyring.get(r).public_key_pem;
    }
    return out;
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: creates a feature or task branch from a base branch
   * verbose: allocates `feat/<epic_id>` in single-developer mode or `feat/<epic_id>/<ticket_id>` in swarm mode.
   * 
   * section: arguments
   * - params (object): { epic_id, ticket_id, worker_id, base_branch, branch_name, swarm }
   * 
   * section: return value
   * - branch (object): created or existing branch descriptor
   * 
   * section: example
   * const br = provenance.create_feature_branch({ epic_id: 'user-auth', worker_id: 'se-worker-01' });
   */
  create_feature_branch(params = {}) {
    const base_name = params.base_branch || 'main';
    if (this.exec_git && this.repo_path) {
      this.#ensure_physical_git_repo(this.repo_path);
    }
    const base = this.branches.get(base_name) || this.branches.get('main');
    const clean_epic = String(params.epic_id || 'feature').toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    const clean_ticket = params.ticket_id ? String(params.ticket_id).toLowerCase().replace(/[^a-z0-9_-]/g, '-') : null;
    const name = params.branch_name || (params.swarm && clean_ticket ? `feat/${clean_epic}/${clean_ticket}` : `feat/${clean_epic}`);

    let base_sha = base.head_sha;
    let head_sha = base.head_sha;

    if (this.exec_git && this.repo_path && !is_protected_branch(name)) {
      try {
        this.#run_git(['checkout', '-B', name, base.name], this.repo_path);
      } catch (_err) {
        this.#run_git(['checkout', '-B', name], this.repo_path);
      }
      head_sha = this.#run_git(['rev-parse', 'HEAD'], this.repo_path);
      base_sha = head_sha;
    }

    if (!this.branches.get(name)) {
      this.branches.set(name, {
        name,
        protected: is_protected_branch(name),
        epic_id: params.epic_id || clean_epic,
        owner_worker_id: params.worker_id || null,
        base_branch: base.name,
        base_sha,
        head_sha,
        commits: []
      });
    }
    return this.branches.get(name);
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: executes a governed developer commit on a feature branch with ed25519 sdlc trailers
   * verbose: validates branch protection and supervisor token via SdlcRulesEngine, computes
   * canonical tree sha256 over changed files, signs trailers with agent and supervisor ed25519
   * keys, and returns a compact commit pointer.
   * 
   * section: arguments
   * - params (object): { branch, epic_id, ticket_id, worker_id, role, phase, supervisor_token, files, message }
   * 
   * section: return value
   * - commit_pointer (object): compact commit record with commit_sha, trailers, and pointer
   * 
   * section: example
   * const c = provenance.developer_commit({ branch: 'feat/auth', epic_id: 'auth', ticket_id: 'auth:impl', role: 'software-engineer', supervisor_token: tok, files: { 'src/auth.js': '...' } });
   */
  developer_commit(params = {}) {
    const branch_name = params.branch || `feat/${params.epic_id || 'feature'}`;
    const role = params.role || 'software-engineer';
    const epic_id = params.epic_id || 'default-epic';
    const ticket_id = params.ticket_id || `${epic_id}:impl`;
    const phase = params.phase || 'tdd_green';
    const worker_id = params.worker_id || `${role}-01`;
    const target_branch_type = is_protected_branch(branch_name) ? 'protected' : 'feature';

    if (!this.branches.get(branch_name)) {
      this.create_feature_branch({
        branch_name,
        epic_id,
        ticket_id,
        worker_id
      });
    }

    const files_obj = params.files || { [`src/${epic_id}.js`]: '// governed implementation' };
    const changed_files = Array.isArray(files_obj) ? files_obj : Object.keys(files_obj);
    const tree_sha256 = params.tree_sha256 || compute_sha256_hex(files_obj);

    let token_valid = Boolean(params.supervisor_token);
    if (token_valid && typeof this.verify_supervisor_token_fn === 'function') {
      token_valid = this.verify_supervisor_token_fn({
        supervisor_token: params.supervisor_token,
        worker_id: params.strict_token_worker ? worker_id : undefined,
        ticket_id: params.strict_token_ticket ? ticket_id : undefined
      });
    }

    const canonical = this.#compute_canonical_commit_payload({
      epic_id,
      ticket_id,
      role,
      phase,
      tree_sha256
    });

    const agent_sig = params.forged_agent_sig || (this.keyring.get(role) ? this.#sign_for_role(role, canonical) : '');
    const sup_sig = params.forged_supervisor_sig || (token_valid ? this.#sign_for_role('sdlc-supervisor', canonical) : '');

    const has_agent_sig = this.#verify_role_signature(role, canonical, agent_sig);
    const has_supervisor_sig = this.#verify_role_signature('sdlc-supervisor', canonical, sup_sig);
    const declared_tree_sha = params.tampered_tree_sha256 || tree_sha256;
    const tree_hash_matches = declared_tree_sha === tree_sha256;

    const dmn_eval = this.rules_engine.evaluate_dmn('git_operation_policy_dmn', {
      operation: 'commit',
      target_branch_type,
      actor_role: role,
      has_supervisor_sig,
      has_agent_sig,
      tree_hash_matches
    });

    if (!dmn_eval.primary_output?.allowed) {
      throw new Error(`git_commit_rejected (${dmn_eval.primary_output?.violation}): ${dmn_eval.primary_output?.reason}`);
    }

    const trailers = {
      'sdlc-epic': epic_id,
      'sdlc-ticket': ticket_id,
      'sdlc-phase': phase,
      'sdlc-role': role,
      'sdlc-worker': worker_id,
      'sdlc-tree-sha256': declared_tree_sha,
      'sdlc-agent-sig': agent_sig,
      'sdlc-supervisor-token-sig': sup_sig
    };

    const subject = params.message || `feat(${epic_id}): complete ${ticket_id}`;
    const full_message = format_git_commit_with_trailers(subject, trailers);
    let parent_sha = this.branches.get(branch_name).head_sha;
    let commit_sha = compute_sha256_hex(`${parent_sha}|${full_message}|${Date.now()}`).slice(0, 40);
    let git_tree_oid = null;

    if (this.exec_git && this.repo_path) {
      this.#ensure_physical_git_repo(this.repo_path);
      this.#run_git(['checkout', branch_name], this.repo_path);
      parent_sha = this.#run_git(['rev-parse', 'HEAD'], this.repo_path);

      if (files_obj && typeof files_obj === 'object' && !Array.isArray(files_obj)) {
        const file_entries = Object.entries(files_obj);
        for (let f = 0; f < file_entries.length; f += 1) {
          const [rel_path, content] = file_entries[f];
          const abs_path = path.join(this.repo_path, rel_path);
          fs.mkdirSync(path.dirname(abs_path), { recursive: true });
          fs.writeFileSync(abs_path, typeof content === 'string' ? content : JSON.stringify(content, null, 2), 'utf-8');
        }
        if (file_entries.length > 0) {
          this.#run_git(['add', '--', ...file_entries.map(([rel]) => rel)], this.repo_path);
        }
      }

      this.#run_git(
        [
          '-c', `user.name=${worker_id}`,
          '-c', `user.email=${role}@thing.local`,
          'commit',
          '--allow-empty',
          '-m', full_message
        ],
        this.repo_path
      );
      commit_sha = this.#run_git(['rev-parse', 'HEAD'], this.repo_path);
      git_tree_oid = this.#run_git(['rev-parse', 'HEAD^{tree}'], this.repo_path);
    }

    const commit_record = {
      commit_sha,
      parent_sha,
      branch: branch_name,
      epic_id,
      ticket_id,
      role,
      worker_id,
      phase,
      tree_sha256,
      git_tree_oid,
      changed_files,
      subject,
      message: full_message,
      trailers,
      compressed_files: compress_payload(files_obj),
      timestamp: new Date().toISOString()
    };

    this.commits_by_sha.set(commit_sha, commit_record);
    this.branches.get(branch_name).commits.push(commit_sha);
    this.branches.get(branch_name).head_sha = commit_sha;

    if (this.logger) {
      this.logger.info({
        event: 'git:developer_commit',
        commit_sha,
        branch: branch_name,
        ticket_id,
        role
      });
    }

    return {
      commit_sha,
      branch: branch_name,
      epic_id,
      ticket_id,
      role,
      worker_id,
      tree_sha256,
      changed_files,
      trailers,
      message: full_message,
      pointer: create_content_pointer('git_commit', commit_sha, {
        commit_sha,
        branch: branch_name,
        ticket_id,
        changed_files,
        summary: subject
      }, { branch: branch_name, commit_sha, changed_files })
    };
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: opens a pull request from a developer feature branch to a target branch
   * verbose: creates a lightweight pr descriptor pointing to source_branch and commit_sha.
   * 
   * section: arguments
   * - params (object): { epic_id, ticket_id, source_branch, target_branch, commit_sha, author_worker_id, title, summary, changed_files }
   * 
   * section: return value
   * - pr (object): pull request record
   * 
   * section: example
   * const pr = provenance.open_pull_request({ epic_id: 'auth', source_branch: 'feat/auth', commit_sha: sha });
   */
  open_pull_request(params = {}) {
    this.pr_seq += 1;
    const epic_id = params.epic_id || 'feature';
    const pr_id = params.pr_id || `pr-${epic_id}-${String(this.pr_seq).padStart(2, '0')}`;
    const source_branch = params.source_branch || `feat/${epic_id}`;
    const target_branch = params.target_branch || 'main';
    const commit_sha = params.commit_sha || this.branches.get(source_branch)?.head_sha;

    if (!commit_sha || !this.commits_by_sha.get(commit_sha)) {
      throw new Error(`invalid_pr_commit: commit "${commit_sha}" does not exist on branch "${source_branch}"`);
    }

    const pr = {
      pr_id,
      epic_id,
      ticket_id: params.ticket_id || `${epic_id}:impl`,
      source_branch,
      target_branch,
      commit_sha,
      author_worker_id: params.author_worker_id || 'se-worker-01',
      title: params.title || `pr: ${epic_id}`,
      summary: params.summary || `pull request for ${epic_id} at commit ${commit_sha.slice(0, 8)}`,
      changed_files: params.changed_files || this.commits_by_sha.get(commit_sha).changed_files || [],
      status: 'open',
      attestations: {},
      merge_commit_sha: null,
      created_at: new Date().toISOString()
    };

    this.pull_requests.set(pr_id, pr);
    return pr;
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: attaches an ed25519-signed qa or security attestation to an open pull request
   * verbose: binds the specialist role's cryptographic signature over (pr_id, commit_sha, verdict)
   * after running regression tests or stride security scans against the pr branch.
   * 
   * section: arguments
   * - params (object): { pr_id, commit_sha, role, worker_id, verdict, metrics }
   * 
   * section: return value
   * - attestation (object): signed attestation record
   * 
   * section: example
   * provenance.attach_role_attestation({ pr_id: 'pr-auth-01', role: 'qa-engineer', verdict: 'passed' });
   */
  attach_role_attestation(params = {}) {
    const pr = this.pull_requests.get(params.pr_id);
    if (!pr) {
      throw new Error(`pr_not_found: "${params.pr_id}"`);
    }
    const role = params.role || 'qa-engineer';
    const commit_sha = params.commit_sha || pr.commit_sha;
    const verdict = params.verdict || 'passed';
    const canonical = this.#compute_canonical_attestation_payload({
      pr_id: pr.pr_id,
      commit_sha,
      role,
      verdict
    });

    const signature = this.#sign_for_role(role, canonical);
    const supervisor_countersig = this.#sign_for_role('sdlc-supervisor', canonical);

    const attestation = {
      pr_id: pr.pr_id,
      commit_sha,
      role,
      worker_id: params.worker_id || `${role}-01`,
      verdict,
      metrics: params.metrics || {},
      signature,
      supervisor_countersig,
      timestamp: new Date().toISOString()
    };

    pr.attestations[role] = attestation;

    if (this.exec_git && this.repo_path && commit_sha) {
      try {
        this.#ensure_physical_git_repo(this.repo_path);
        this.#run_git(
          [
            'notes',
            '--ref=refs/notes/sdlc-attestations',
            'append',
            '-m',
            JSON.stringify(attestation),
            commit_sha
          ],
          this.repo_path
        );
      } catch (_err) {
        // ignore if commit_sha is synthetic in mixed mode
      }
    }

    return attestation;
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: product-manager reviews and merges an attested pull request into the target branch
   * verbose: verifies via SdlcRulesEngine that the merger role is product-manager (or sdlc-supervisor)
   * and that valid ed25519 attestations from qa-engineer and security-engineer are attached.
   * signs the merge commit with all 4 governance signatures and updates the target branch head.
   * 
   * section: arguments
   * - params (object): { pr_id, pm_worker_id, actor_role, target_branch }
   * 
   * section: return value
   * - outcome (object): { merged, merge_commit_sha, pr, merge_commit }
   * 
   * section: example
   * const res = provenance.pm_review_and_merge_pr({ pr_id: 'pr-auth-01', pm_worker_id: 'pm-worker-01' });
   */
  pm_review_and_merge_pr(params = {}) {
    const pr = this.pull_requests.get(params.pr_id);
    if (!pr) {
      throw new Error(`pr_not_found: "${params.pr_id}"`);
    }
    if (pr.status === 'merged') {
      return {
        merged: true,
        merge_commit_sha: pr.merge_commit_sha,
        pr,
        merge_commit: this.commits_by_sha.get(pr.merge_commit_sha)
      };
    }

    const actor_role = params.actor_role || 'product-manager';
    const pm_worker_id = params.pm_worker_id || 'pm-worker-01';
    const target_branch = params.target_branch || pr.target_branch || 'main';

    const qa_att = pr.attestations['qa-engineer'];
    const sec_att = pr.attestations['security-engineer'];

    const has_qa_sig = Boolean(
      qa_att &&
      qa_att.verdict === 'passed' &&
      this.#verify_role_signature(
        'qa-engineer',
        this.#compute_canonical_attestation_payload({
          pr_id: pr.pr_id,
          commit_sha: pr.commit_sha,
          role: 'qa-engineer',
          verdict: 'passed'
        }),
        qa_att.signature
      )
    );

    const has_sec_sig = Boolean(
      sec_att &&
      sec_att.verdict === 'passed' &&
      this.#verify_role_signature(
        'security-engineer',
        this.#compute_canonical_attestation_payload({
          pr_id: pr.pr_id,
          commit_sha: pr.commit_sha,
          role: 'security-engineer',
          verdict: 'passed'
        }),
        sec_att.signature
      )
    );

    const pm_canonical = this.#compute_canonical_attestation_payload({
      pr_id: pr.pr_id,
      commit_sha: pr.commit_sha,
      role: 'product-manager',
      verdict: 'approved'
    });
    const pm_sig = (actor_role === 'product-manager' || actor_role === 'sdlc-supervisor')
      ? this.#sign_for_role('product-manager', pm_canonical)
      : '';
    const sup_receipt_sig = this.#sign_for_role('sdlc-supervisor', pm_canonical);

    const has_pm_sig = this.#verify_role_signature('product-manager', pm_canonical, pm_sig);
    const has_supervisor_sig = this.#verify_role_signature('sdlc-supervisor', pm_canonical, sup_receipt_sig);

    const dmn_eval = this.rules_engine.evaluate_dmn('git_operation_policy_dmn', {
      operation: 'merge',
      target_branch_type: is_protected_branch(target_branch) ? 'protected' : 'feature',
      actor_role,
      has_supervisor_sig,
      has_agent_sig: true,
      has_qa_sig,
      has_sec_sig,
      has_pm_sig,
      tree_hash_matches: true
    });

    if (!dmn_eval.primary_output?.allowed) {
      throw new Error(`pr_merge_rejected (${dmn_eval.primary_output?.violation}): ${dmn_eval.primary_output?.reason}`);
    }

    const source_commit = this.commits_by_sha.get(pr.commit_sha);
    const tree_sha256 = source_commit ? source_commit.tree_sha256 : compute_sha256_hex(pr.pr_id);
    const trailers = {
      'sdlc-epic': pr.epic_id,
      'sdlc-pr': pr.pr_id,
      'sdlc-source-commit': pr.commit_sha,
      'sdlc-gates-passed': 'gate_1_planning,gate_2_implementation,gate_3_qa_security',
      'sdlc-tree-sha256': tree_sha256,
      'sdlc-qa-sig': qa_att.signature,
      'sdlc-sec-sig': sec_att.signature,
      'sdlc-pm-approval-sig': pm_sig,
      'sdlc-supervisor-receipt-sig': sup_receipt_sig
    };

    const subject = `merge(${pr.epic_id}): merge ${pr.pr_id} from ${pr.source_branch} into ${target_branch}`;
    const full_message = format_git_commit_with_trailers(subject, trailers);

    if (!this.branches.get(target_branch)) {
      this.branches.set(target_branch, {
        name: target_branch,
        protected: is_protected_branch(target_branch),
        head_sha: '0000000000000000000000000000000000000000',
        commits: []
      });
    }

    let parent_target_sha = this.branches.get(target_branch).head_sha;
    let merge_commit_sha = compute_sha256_hex(`${parent_target_sha}|${pr.commit_sha}|${full_message}`).slice(0, 40);

    if (this.exec_git && this.repo_path) {
      this.#ensure_physical_git_repo(this.repo_path);
      this.#run_git(['checkout', target_branch], this.repo_path);
      parent_target_sha = this.#run_git(['rev-parse', 'HEAD'], this.repo_path);
      this.#run_git(
        [
          '-c', `user.name=${pm_worker_id}`,
          '-c', 'user.email=product-manager@thing.local',
          'merge',
          '--no-ff',
          pr.source_branch,
          '-m',
          full_message
        ],
        this.repo_path
      );
      merge_commit_sha = this.#run_git(['rev-parse', 'HEAD'], this.repo_path);
    }

    const merge_commit = {
      commit_sha: merge_commit_sha,
      parent_shas: [parent_target_sha, pr.commit_sha],
      branch: target_branch,
      epic_id: pr.epic_id,
      pr_id: pr.pr_id,
      role: 'product-manager',
      worker_id: pm_worker_id,
      is_merge_commit: true,
      tree_sha256,
      subject,
      message: full_message,
      trailers,
      timestamp: new Date().toISOString()
    };

    this.commits_by_sha.set(merge_commit_sha, merge_commit);
    this.branches.get(target_branch).commits.push(merge_commit_sha);
    this.branches.get(target_branch).head_sha = merge_commit_sha;

    pr.status = 'merged';
    pr.merged_by = pm_worker_id;
    pr.merge_commit_sha = merge_commit_sha;
    pr.merged_at = merge_commit.timestamp;

    return {
      merged: true,
      merge_commit_sha,
      pr,
      merge_commit
    };
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: verifies a commit locally (pre-commit / commit-msg / pre-push check)
   * verbose: parses sdlc-* trailers and cryptographically verifies ed25519 signatures and tree hash.
   * 
   * section: arguments
   * - commit_or_sha (string|object): commit sha, commit record, or raw commit message
   * 
   * section: return value
   * - verification (object): { valid, violations, trailers }
   * 
   * section: example
   * const check = provenance.verify_local_commit(commit_sha);
   */
  verify_local_commit(commit_or_sha) {
    let record = null;
    if (typeof commit_or_sha === 'string' && this.commits_by_sha.get(commit_or_sha)) {
      record = this.commits_by_sha.get(commit_or_sha);
    } else if (typeof commit_or_sha === 'string' && this.exec_git && this.repo_path && /^[a-f0-9]{7,40}$/i.test(commit_or_sha)) {
      try {
        const git_msg = this.#run_git(['show', '-s', '--format=%B', commit_or_sha], this.repo_path);
        record = { commit_sha: commit_or_sha, message: git_msg };
      } catch (_err) {
        record = { message: String(commit_or_sha || '') };
      }
    } else if (typeof commit_or_sha === 'object' && commit_or_sha !== null) {
      record = commit_or_sha;
    } else {
      record = { message: String(commit_or_sha || '') };
    }

    const trailers = record.trailers || parse_git_trailers(record.message || '');
    const violations = [];

    if (record.is_merge_commit || trailers['sdlc-pr']) {
      const pr_id = trailers['sdlc-pr'];
      const source_sha = trailers['sdlc-source-commit'];
      const pm_canonical = this.#compute_canonical_attestation_payload({
        pr_id,
        commit_sha: source_sha,
        role: 'product-manager',
        verdict: 'approved'
      });
      if (!this.#verify_role_signature('product-manager', pm_canonical, trailers['sdlc-pm-approval-sig'])) {
        violations.push('invalid_or_missing_pm_approval_sig');
      }
      if (!this.#verify_role_signature('sdlc-supervisor', pm_canonical, trailers['sdlc-supervisor-receipt-sig'])) {
        violations.push('invalid_or_missing_supervisor_receipt_sig');
      }
      if (!this.#verify_role_signature('qa-engineer', this.#compute_canonical_attestation_payload({ pr_id, commit_sha: source_sha, role: 'qa-engineer', verdict: 'passed' }), trailers['sdlc-qa-sig'])) {
        violations.push('invalid_or_missing_qa_attestation_sig');
      }
      if (!this.#verify_role_signature('security-engineer', this.#compute_canonical_attestation_payload({ pr_id, commit_sha: source_sha, role: 'security-engineer', verdict: 'passed' }), trailers['sdlc-sec-sig'])) {
        violations.push('invalid_or_missing_security_attestation_sig');
      }
      return {
        valid: violations.length === 0,
        is_merge_commit: true,
        violations,
        trailers
      };
    }

    const epic_id = trailers['sdlc-epic'];
    const ticket_id = trailers['sdlc-ticket'];
    const role = trailers['sdlc-role'];
    const phase = trailers['sdlc-phase'];
    const tree_sha256 = trailers['sdlc-tree-sha256'];

    if (!epic_id || !ticket_id || !role || !tree_sha256) {
      violations.push('missing_required_sdlc_commit_trailers');
    }

    if (record.tree_sha256 && record.tree_sha256 !== tree_sha256) {
      violations.push('git_tree_sha256_mismatch');
    }

    const canonical = this.#compute_canonical_commit_payload({
      epic_id,
      ticket_id,
      role,
      phase,
      tree_sha256
    });

    if (!this.#verify_role_signature(role, canonical, trailers['sdlc-agent-sig'])) {
      violations.push('invalid_or_missing_agent_ed25519_sig');
    }
    if (!this.#verify_role_signature('sdlc-supervisor', canonical, trailers['sdlc-supervisor-token-sig'])) {
      violations.push('invalid_or_missing_supervisor_ed25519_sig');
    }

    return {
      valid: violations.length === 0,
      is_merge_commit: false,
      violations,
      trailers
    };
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: zero-trust server-side pre-receive hook verification for git pushes
   * verbose: validates all commits being pushed to a ref. feature branches require valid
   * developer + supervisor ed25519 commit signatures; protected branches (main/release)
   * require a multi-signed pm merge commit backed by qa and security attestations.
   * 
   * section: arguments
   * - push_event (object): { ref_name, new_sha, commits }
   * 
   * section: return value
   * - verdict (object): { accepted, ref_name, new_sha, violations }
   * 
   * section: example
   * const res = provenance.verify_server_pre_receive({ ref_name: 'refs/heads/main', new_sha: merge_sha });
   */
  verify_server_pre_receive(push_event = {}) {
    const ref_name = push_event.ref_name || 'refs/heads/main';
    const new_sha = push_event.new_sha;
    const is_protected = is_protected_branch(ref_name);
    const violations = [];

    const commit_list = Array.isArray(push_event.commits) && push_event.commits.length > 0
      ? push_event.commits
      : (new_sha ? [this.commits_by_sha.get(new_sha) || new_sha] : []);

    if (commit_list.length === 0) {
      violations.push('empty_push_commits');
    }

    for (let i = 0; i < commit_list.length; i += 1) {
      const c = commit_list[i];
      const check = this.verify_local_commit(c);
      if (!check.valid) {
        for (let v = 0; v < check.violations.length; v += 1) {
          violations.push(check.violations[v]);
        }
      }
    }

    if (is_protected && commit_list.length > 0) {
      const tip = commit_list[commit_list.length - 1];
      const tip_check = this.verify_local_commit(tip);
      if (!tip_check.is_merge_commit) {
        violations.push('unapproved_push_to_protected_branch: direct non-pr commit pushed to protected ref');
      }
    }

    return {
      accepted: violations.length === 0,
      ref_name,
      new_sha,
      is_protected,
      violations
    };
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: generates local client and server pre-receive git hook scripts
   * verbose: produces executable bash/node hook scripts for commit-msg, pre-merge-commit,
   * pre-push, and server-side pre-receive enforcement.
   * 
   * section: arguments
   * none
   * 
   * section: return value
   * - hooks (object): dictionary of hook script names to script content
   * 
   * section: example
   * const scripts = provenance.generate_git_hooks_scripts();
   */
  generate_git_hooks_scripts() {
    return this.#generate_hook_scripts_map();
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: installs executable commit-msg, pre-merge-commit, and pre-receive hooks into .git/hooks
   * verbose: writes the governed bash hook scripts with 0o755 permissions into the target git repository.
   * 
   * section: arguments
   * - target_repo_path (string, optional): target repository path (defaults to configured repo_path)
   * 
   * section: return value
   * - installed (object): { hooks_dir, installed_hooks }
   * 
   * section: example
   * const res = provenance.install_git_hooks('/tmp/repo');
   */
  install_git_hooks(target_repo_path = this.repo_path) {
    if (!target_repo_path) {
      throw new Error('git_repo_path_not_configured: provide target_repo_path to install hooks');
    }
    const hooks_dir = path.join(target_repo_path, '.git', 'hooks');
    fs.mkdirSync(hooks_dir, { recursive: true });
    const scripts = this.#generate_hook_scripts_map();
    const installed_hooks = [];
    const names = Object.keys(scripts);
    for (let i = 0; i < names.length; i += 1) {
      const name = names[i];
      const hook_file = path.join(hooks_dir, name);
      fs.writeFileSync(hook_file, scripts[name], { encoding: 'utf-8', mode: 0o755 });
      fs.chmodSync(hook_file, 0o755);
      installed_hooks.push(hook_file);
    }
    return { hooks_dir, installed_hooks };
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: reads commit log entries from the physical git repository or in-memory branch log
   * verbose: queries `git log` when physical git is active, or falls back to in-memory branch commits.
   * 
   * section: arguments
   * - branch_name (string, optional): branch name (default 'main')
   * - limit (number, optional): maximum number of commits to return (default 20)
   * 
   * section: return value
   * - entries (array): list of { commit_sha, subject } objects
   * 
   * section: example
   * const log = provenance.get_git_log('main', 10);
   */
  get_git_log(branch_name = 'main', limit = 20) {
    if (this.exec_git && this.repo_path) {
      this.#ensure_physical_git_repo(this.repo_path);
      const raw = this.#run_git(['log', branch_name, `-n`, String(limit), '--format=%H|%s'], this.repo_path);
      if (!raw) return [];
      return raw.split('\n').filter(Boolean).map((line) => {
        const idx = line.indexOf('|');
        return {
          commit_sha: line.slice(0, idx),
          subject: line.slice(idx + 1)
        };
      });
    }
    const br = this.branches.get(branch_name);
    if (!br) return [];
    return br.commits.slice(-limit).reverse().map((sha) => ({
      commit_sha: sha,
      subject: this.commits_by_sha.get(sha)?.subject || ''
    }));
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: retrieves a pull request record by id
   * verbose: returns the pull request descriptor including attached qa and security attestations.
   * 
   * section: arguments
   * - pr_id (string): pull request identifier
   * 
   * section: return value
   * - pr (object|null): pull request record
   * 
   * section: example
   * const pr = provenance.get_pull_request('pr-auth-01');
   */
  get_pull_request(pr_id) {
    return this.pull_requests.get(pr_id) || null;
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: lists all pull requests optionally filtered by epic_id or status
   * verbose: returns array of pull request descriptors.
   * 
   * section: arguments
   * - filter (object, optional): { epic_id, status }
   * 
   * section: return value
   * - list (array): matching pull requests
   * 
   * section: example
   * const prs = provenance.list_pull_requests({ epic_id: 'auth' });
   */
  list_pull_requests(filter = {}) {
    return [...this.pull_requests.values()].filter((pr) => {
      if (filter.epic_id && pr.epic_id !== filter.epic_id) return false;
      if (filter.status && pr.status !== filter.status) return false;
      return true;
    });
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: retrieves branch metadata and head commit sha
   * verbose: returns branch descriptor by name.
   * 
   * section: arguments
   * - branch_name (string): branch name
   * 
   * section: return value
   * - branch (object|null): branch descriptor
   * 
   * section: example
   * const main_br = provenance.get_branch('main');
   */
  get_branch(branch_name) {
    return this.branches.get(branch_name) || null;
  }
}

export function create_git_governance_provenance(options = {}) {
  return new GitGovernanceProvenance(options);
}

