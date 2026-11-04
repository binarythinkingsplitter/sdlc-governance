/**
 * =========================================================================
 * module: document entity store
 * =========================================================================
 * 
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: data-based storage and query engine for sdlc document entities
 * verbose: manages structured document entities in an adapter-backed store (.sdlc/store),
 * validates against extensive zod schemas, provides prd foreign key relational queries,
 * and compiles entities back into standard markdown via document builder.
 * 
 * section: export catalog
 * - create_document_entity_store: factory function creating the document entity store
 * =========================================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  DocumentEntityTypes,
  validate_document_entity
} from './DocumentEntitiesSchema.js';
import { FilestoreAdapter } from './FilestoreAdapter.js';
import {
  prd,
  adr,
  threat_model,
  test_report,
  release,
  retrospective,
  task,
  doc,
  chunk_markdown_sections,
  export_documents_from_store,
  generate_code_snippet,
  get_default_template_engine
} from './DocumentBuilder.js';
import { resolve_harness_knowledge } from './MastraMemoryStorage.js';

/**
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: tokenises text into normalised alphanumeric and hyphenated terms
 * verbose: extracts lowercase lexical tokens for bm25 and dense feature projection.
 * 
 * section: arguments
 * - text (string): input text string
 * 
 * section: return value
 * - tokens (Array<string>): normalised token list
 * 
 * section: example
 * const tokens = tokenise_rag_text('modern es6 prd-03');
 */
function tokenise_rag_text(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

/**
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: computes deterministic l2-normalised feature vector for semantic similarity
 * verbose: projects unigram and character trigram hashes into a 64-dimensional vector
 * without external embedding daemons.
 * 
 * section: arguments
 * - text (string): text to embed
 * - dims (number, optional): vector dimensionality (defaults to 64)
 * 
 * section: return value
 * - vector (Array<number>): l2-normalised embedding vector
 * 
 * section: example
 * const vec = compute_local_embedding('mastra memory storage');
 */
function compute_local_embedding(text, dims = 64) {
  const vec = new Array(dims).fill(0);
  const tokens = tokenise_rag_text(text);
  for (let i = 0; i < tokens.length; i += 1) {
    const tok = tokens[i];
    let h = 2166136261;
    for (let c = 0; c < tok.length; c += 1) {
      h ^= tok.charCodeAt(c);
      h = Math.imul(h, 16777619);
    }
    const bucket = Math.abs(h) % dims;
    const sign = (h & 1) === 0 ? 1 : -1;
    vec[bucket] += sign * 1.5;

    for (let g = 0; g + 2 < tok.length; g += 1) {
      const tri = (tok.charCodeAt(g) * 31 + tok.charCodeAt(g + 1)) * 31 + tok.charCodeAt(g + 2);
      const tri_bucket = Math.abs(tri) % dims;
      vec[tri_bucket] += 0.5;
    }
  }
  let norm_sq = 0;
  for (let d = 0; d < dims; d += 1) {
    norm_sq += vec[d] * vec[d];
  }
  const norm = Math.sqrt(norm_sq) || 1;
  for (let d = 0; d < dims; d += 1) {
    vec[d] = Number((vec[d] / norm).toFixed(6));
  }
  return vec;
}

/**
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: computes cosine similarity between two equal-length vectors
 * verbose: returns dot product divided by product of l2 norms.
 * 
 * section: arguments
 * - a (Array<number>): first vector
 * - b (Array<number>): second vector
 * 
 * section: return value
 * - score (number): cosine similarity in [-1, 1]
 * 
 * section: example
 * const sim = cosine_similarity(v1, v2);
 */
function cosine_similarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
    return 0;
  }
  let dot = 0;
  let norm_a = 0;
  let norm_b = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    norm_a += a[i] * a[i];
    norm_b += b[i] * b[i];
  }
  if (norm_a === 0 || norm_b === 0) {
    return 0;
  }
  return dot / (Math.sqrt(norm_a) * Math.sqrt(norm_b));
}

const type_to_collection_map = {
  [DocumentEntityTypes.PRD]: 'prds',
  [DocumentEntityTypes.USER_STORY]: 'stories',
  [DocumentEntityTypes.TASK]: 'tasks',
  [DocumentEntityTypes.ADR]: 'adrs',
  [DocumentEntityTypes.INTERFACE_CONTRACT]: 'interfaces',
  [DocumentEntityTypes.THREAT_MODEL]: 'threat_models',
  [DocumentEntityTypes.TEST_REPORT]: 'test_reports',
  [DocumentEntityTypes.RELEASE_MANIFEST]: 'releases',
  [DocumentEntityTypes.RETROSPECTIVE]: 'retrospectives',
  [DocumentEntityTypes.TICKET]: 'tickets',
  [DocumentEntityTypes.AGENT_MESSAGE]: 'messages'
};

/**
 * =========================================================================
 * class: DocumentEntityStore
 * =========================================================================
 * 
 * section: version number
 * version: 0.2.0
 * 
 * section: documentation
 * tldr: adapter-backed tier 1 document entity store with hybrid rag search
 * verbose: validates and persists structured document entities (.sdlc/store), renders canonical markdown,
 * and maintains a structure-aware bm25 + dense-vector reciprocal-rank-fusion index.
 * 
 * section: arguments
 * - options (object, optional): { adapter, store_root, workspace_root, rag_index_path }
 * 
 * section: example
 * const store = new DocumentEntityStore();
 * store.save_entity('prd', { id: 'prd-01', title: 'sdlc' });
 * =========================================================================
 */
export class DocumentEntityStore {
  adapter;
  rag_index_chunks = [];
  rag_index_path;

  constructor(options = {}) {
    this.adapter = options.adapter || new FilestoreAdapter({
      store_root: options.store_root,
      workspace_root: options.workspace_root
    });
    this.rag_index_path = options.rag_index_path || null;
  }

  #resolve_collection(type) {
    const col = type_to_collection_map[type];
    if (!col) {
      throw new Error(`unsupported document entity type: "${type}"`);
    }
    return col;
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: returns underlying storage adapter instance
   * verbose: provides direct access to configured adapter.
   * 
   * section: arguments
   * none
   * 
   * section: return value
   * - adapter (object): storage adapter
   * 
   * section: example
   * const ad = store.get_adapter();
   */
  get_adapter() {
    return this.adapter;
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: validates and saves document entity to datastore
   * verbose: performs schema validation and writes structured entity to adapter collection.
   * 
   * section: arguments
   * - type (string): canonical document entity type
   * - data (object): raw or pre-validated entity data
   * 
   * section: return value
   * - saved_entity (object): validated entity object
   * 
   * section: example
   * const entity = store.save_entity('prd', prd_data);
   */
  save_entity(type, data) {
    const validated = validate_document_entity(type, data);
    const collection = this.#resolve_collection(type);
    this.adapter.save(collection, validated.id, validated);
    return validated;
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: retrieves entity by type and identifier
   * verbose: fetches structured record from adapter or returns null if not found.
   * 
   * section: arguments
   * - type (string): canonical document entity type
   * - id (string): entity identifier
   * 
   * section: return value
   * - entity (object|null): stored entity or null
   * 
   * section: example
   * const p = store.get_entity('prd', 'prd-01');
   */
  get_entity(type, id) {
    const collection = this.#resolve_collection(type);
    return this.adapter.find_by_id(collection, id);
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: lists entities of given type matching optional predicate or query
   * verbose: iterates through adapter collection records with optional filtering.
   * 
   * section: arguments
   * - type (string): canonical document entity type
   * - query (function|object, optional): filter predicate or matching properties
   * 
   * section: return value
   * - entities (array): array of stored entities
   * 
   * section: example
   * const stories = store.list_entities('user_story', (s) => s.linked_prd_id === 'prd-01');
   */
  list_entities(type, query = null) {
    const collection = this.#resolve_collection(type);
    let filter_fn = null;

    if (typeof query === 'function') {
      filter_fn = query;
    } else if (query && typeof query === 'object') {
      const keys = Object.keys(query);
      filter_fn = (item) => {
        for (let k = 0; k < keys.length; k += 1) {
          const key = keys[k];
          if (item[key] !== query[key]) {
            return false;
          }
        }
        return true;
      };
    }

    return this.adapter.find_all(collection, filter_fn);
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: deletes entity from store
   * verbose: unlinks entity record from adapter.
   * 
   * section: arguments
   * - type (string): canonical document entity type
   * - id (string): entity identifier
   * 
   * section: return value
   * - deleted (boolean): true if deleted
   * 
   * section: example
   * store.delete_entity('prd', 'prd-01');
   */
  delete_entity(type, id) {
    const collection = this.#resolve_collection(type);
    return this.adapter.delete(collection, id);
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: performs relational query aggregating all artefacts linked to a prd
   * verbose: queries stories, tasks, adrs, interfaces, threat models, test reports, releases,
   * and retrospectives linked via foreign key to the specified prd identifier.
   * 
   * section: arguments
   * - prd_id (string): canonical prd identifier (e.g. prd-01)
   * 
   * section: return value
   * - aggregated (object): consolidated relational tree
   * 
   * section: example
   * const tree = store.query_by_prd('prd-01');
   */
  query_by_prd(prd_id) {
    const prd_entity = this.get_entity(DocumentEntityTypes.PRD, prd_id);
    const stories = this.list_entities(DocumentEntityTypes.USER_STORY, (s) => s.linked_prd_id === prd_id);
    const tasks = this.list_entities(DocumentEntityTypes.TASK, (t) => t.linked_prd_id === prd_id);
    const adrs = this.list_entities(DocumentEntityTypes.ADR, (a) => a.linked_prd_id === prd_id);
    const interfaces = this.list_entities(DocumentEntityTypes.INTERFACE_CONTRACT, (i) => i.linked_prd_id === prd_id);
    const threat_models = this.list_entities(DocumentEntityTypes.THREAT_MODEL, (tm) => tm.linked_prd_id === prd_id);
    const test_reports = this.list_entities(DocumentEntityTypes.TEST_REPORT, (tr) => tr.linked_prd_id === prd_id);
    const releases = this.list_entities(DocumentEntityTypes.RELEASE_MANIFEST, (r) => Array.isArray(r.linked_prd_ids) && r.linked_prd_ids.includes(prd_id));
    const retrospectives = this.list_entities(DocumentEntityTypes.RETROSPECTIVE, (ret) => Array.isArray(ret.linked_prd_ids) && ret.linked_prd_ids.includes(prd_id));
    const tickets = this.list_entities(DocumentEntityTypes.TICKET, (tk) => tk.linked_prd_id === prd_id);

    return {
      prd: prd_entity,
      stories,
      tasks,
      adrs,
      interfaces,
      threat_models,
      test_reports,
      releases,
      retrospectives,
      tickets
    };
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: generates markdown document from stored entity using document builder
   * verbose: reads entity from datastore, maps its fields to document builder sections,
   * and returns the rendered markdown string.
   * 
   * section: arguments
   * - type (string): canonical document entity type
   * - id (string): entity identifier
   * 
   * section: return value
   * - markdown (string): rendered markdown document
   * 
   * section: example
   * const md = store.generate_document('prd', 'prd-01');
   */
  generate_document(type, id) {
    const entity = this.get_entity(type, id);
    if (!entity) {
      throw new Error(`entity not found: type "${type}", id "${id}"`);
    }

    switch (type) {
      case DocumentEntityTypes.PRD: {
        const builder = prd.create(entity.slug || entity.id)
          .title(entity.title)
          .document_id(entity.id)
          .status(entity.status)
          .author(entity.author)
          .date(entity.date);

        // executive summary
        if (entity.executive_summary) {
          const summary_text = [
            entity.executive_summary.vision ? `### vision\n${entity.executive_summary.vision}` : '',
            entity.executive_summary.problem ? `### problem statement\n${entity.executive_summary.problem}` : '',
            entity.executive_summary.strategic_context ? `### strategic context\n${entity.executive_summary.strategic_context}` : '',
            entity.executive_summary.primary_objectives && entity.executive_summary.primary_objectives.length > 0
              ? `### primary objectives\n${entity.executive_summary.primary_objectives.map((o) => `- ${o}`).join('\n')}`
              : ''
          ].filter(Boolean).join('\n\n');

          if (summary_text) {
            builder.section.create('summary')
              .heading('problem framing & strategic objectives')
              .contents(summary_text);
          }
        }

        // target audience / personas
        if (entity.target_audience && entity.target_audience.length > 0) {
          const persona_text = entity.target_audience.map((p) => {
            const resp = p.responsibilities && p.responsibilities.length > 0
              ? `\n- **responsibilities**:\n${p.responsibilities.map((r) => `  - ${r}`).join('\n')}`
              : '';
            return `#### persona: ${p.role}\n- **description**: ${p.description}${resp}`;
          }).join('\n\n');

          builder.section.create('personas')
            .heading('user personas & target audience')
            .contents(persona_text);
        }

        // functional requirements
        if (entity.functional_requirements && entity.functional_requirements.length > 0) {
          const req_text = entity.functional_requirements.map((r) => {
            return `#### ${r.id}: ${r.title}\n- **priority**: ${r.priority}\n- **status**: ${r.status}\n- **description**: ${r.description}`;
          }).join('\n\n');

          builder.section.create('functional_requirements')
            .heading('functional requirements')
            .contents(req_text);
        }

        // non-functional requirements
        if (entity.non_functional_requirements) {
          const nfr_entries = Object.entries(entity.non_functional_requirements)
            .filter(([, v]) => Boolean(v))
            .map(([k, v]) => `- **${k}**: ${v}`);
          if (nfr_entries.length > 0) {
            builder.section.create('non_functional_requirements')
              .heading('non-functional requirements')
              .contents(nfr_entries.join('\n'));
          }
        }

        // scope boundaries
        if (entity.scope_boundaries) {
          const scope_text = [
            entity.scope_boundaries.in_scope && entity.scope_boundaries.in_scope.length > 0
              ? `### in scope\n${entity.scope_boundaries.in_scope.map((s) => `- ${s}`).join('\n')}`
              : '',
            entity.scope_boundaries.out_of_scope && entity.scope_boundaries.out_of_scope.length > 0
              ? `### out of scope\n${entity.scope_boundaries.out_of_scope.map((s) => `- ${s}`).join('\n')}`
              : ''
          ].filter(Boolean).join('\n\n');

          if (scope_text) {
            builder.section.create('scope_boundaries')
              .heading('scope boundaries')
              .contents(scope_text);
          }
        }

        return builder.render();
      }

      case DocumentEntityTypes.USER_STORY: {
        const builder = doc.create(entity.slug || entity.id)
          .title(`user stories & acceptance criteria: ${entity.title}`)
          .document_id(entity.id)
          .status(entity.status)
          .metadata('linked prd', entity.linked_prd_id);

        if (entity.epic) {
          builder.section.create('epic')
            .heading('epic overview')
            .contents(entity.epic);
        }

        if (entity.narrative && (entity.narrative.as_a || entity.narrative.i_want)) {
          const narrative_text = `**as a** ${entity.narrative.as_a || 'user'},\n**i want** ${entity.narrative.i_want || ''},\n**so that** ${entity.narrative.so_that || ''}.`;
          builder.section.create('narrative')
            .heading('user narrative')
            .contents(narrative_text);
        }

        if (entity.acceptance_criteria && entity.acceptance_criteria.length > 0) {
          const ac_text = entity.acceptance_criteria.map((ac) => {
            const lines = [`#### ${ac.id}: ${ac.scenario}`];
            if (ac.given && ac.given.length > 0) lines.push(ac.given.map((g) => `- **given** ${g}`).join('\n'));
            if (ac.when && ac.when.length > 0) lines.push(ac.when.map((w) => `- **when** ${w}`).join('\n'));
            if (ac.then && ac.then.length > 0) lines.push(ac.then.map((t) => `- **then** ${t}`).join('\n'));
            if (ac.and && ac.and.length > 0) lines.push(ac.and.map((a) => `- **and** ${a}`).join('\n'));
            return lines.join('\n');
          }).join('\n\n');

          builder.section.create('acceptance_criteria')
            .heading('acceptance criteria')
            .contents(ac_text);
        }

        return builder.render();
      }

      case DocumentEntityTypes.TASK: {
        const builder = task.create(entity.slug || entity.id)
          .title(entity.title)
          .document_id(entity.id)
          .status(entity.status)
          .metadata('linked prd', entity.linked_prd_id)
          .metadata('assigned role', entity.assigned_role);

        if (entity.objective) {
          builder.section.create('objective')
            .heading('task objective')
            .contents(entity.objective);
        }

        if (entity.inputs && entity.inputs.length > 0) {
          builder.section.create('inputs')
            .heading('task inputs')
            .contents(entity.inputs.map((inp) => `- ${inp}`).join('\n'));
        }

        if (entity.outputs && entity.outputs.length > 0) {
          builder.section.create('outputs')
            .heading('expected outputs')
            .contents(entity.outputs.map((out) => `- ${out}`).join('\n'));
        }

        if (entity.criteria && entity.criteria.length > 0) {
          builder.section.create('criteria')
            .heading('completion criteria')
            .contents(entity.criteria.map((c) => `- [x] ${c}`).join('\n'));
        }

        if (entity.tasks && entity.tasks.length > 0) {
          const subtask_text = entity.tasks.map((t) => {
            const steps = t.steps && t.steps.length > 0
              ? `\n- **steps**:\n${t.steps.map((st) => `  1. ${st}`).join('\n')}`
              : '';
            return `### task ${String(t.number).padStart(2, '0')}: ${t.title}\n- **status**: ${t.status}\n- **description**: ${t.description}${steps}`;
          }).join('\n\n');

          builder.section.create('tasks')
            .heading('decomposed tasks')
            .contents(subtask_text);
        }

        return builder.render();
      }

      case DocumentEntityTypes.ADR: {
        const builder = adr.create(entity.slug || entity.id)
          .title(entity.title)
          .document_id(entity.id)
          .status(entity.status)
          .author(entity.author)
          .date(entity.date)
          .metadata('linked prd', entity.linked_prd_id);

        builder.section.create('context')
          .heading('context & problem statement')
          .contents(entity.context);

        builder.section.create('decision')
          .heading('decision')
          .contents(entity.decision);

        if (entity.consequences) {
          const pos = entity.consequences.positive && entity.consequences.positive.length > 0
            ? `### positive\n${entity.consequences.positive.map((p) => `- ${p}`).join('\n')}`
            : '';
          const neg = entity.consequences.negative && entity.consequences.negative.length > 0
            ? `### negative\n${entity.consequences.negative.map((n) => `- ${n}`).join('\n')}`
            : '';
          const neu = entity.consequences.neutral && entity.consequences.neutral.length > 0
            ? `### neutral\n${entity.consequences.neutral.map((nu) => `- ${nu}`).join('\n')}`
            : '';
          const cons_body = [pos, neg, neu].filter(Boolean).join('\n\n');
          if (cons_body) {
            builder.section.create('consequences')
              .heading('consequences')
              .contents(cons_body);
          }
        }

        if (entity.compliance_rules && entity.compliance_rules.length > 0) {
          builder.section.create('compliance')
            .heading('compliance & invariants')
            .contents(entity.compliance_rules.map((cr) => `- ${cr}`).join('\n'));
        }

        return builder.render();
      }

      case DocumentEntityTypes.THREAT_MODEL: {
        const builder = threat_model.create(entity.slug || entity.id)
          .title(`threat model: ${entity.component}`)
          .document_id(entity.id)
          .metadata('linked prd', entity.linked_prd_id)
          .metadata('auditor', entity.sign_off?.auditor || 'security auditor');

        if (entity.threat_vectors && entity.threat_vectors.length > 0) {
          const table_rows = entity.threat_vectors.map((tv) => {
            return `| ${tv.category} | ${tv.risk.replace(/\|/g, '\\|')} | ${tv.mitigation.replace(/\|/g, '\\|')} | ${tv.status} |`;
          });
          const table = [
            '| threat category | risk description | architectural mitigation & control | status |',
            '| :--- | :--- | :--- | :--- |',
            ...table_rows
          ].join('\n');

          builder.section.create('threat_vectors')
            .heading('stride threat analysis matrix')
            .contents(table);
        }

        if (entity.boundaries && entity.boundaries.length > 0) {
          const boundaries_text = entity.boundaries.map((b) => `- **${b.name}**: ${b.description}`).join('\n');
          builder.section.create('boundaries')
            .heading('attack surface & boundaries')
            .contents(boundaries_text);
        }

        if (entity.sign_off) {
          builder.section.create('sign_off')
            .heading('security review sign-off')
            .contents(`- [${entity.sign_off.approved ? 'x' : ' '}] sign-off approval verdict: **${entity.sign_off.approved ? 'approved' : 'rejected'}**\n- **date**: ${entity.sign_off.date}\n- **auditor**: ${entity.sign_off.auditor}`);
        }

        return builder.render();
      }

      case DocumentEntityTypes.TEST_REPORT: {
        const builder = test_report.create(entity.slug || entity.id)
          .title(`qa test report: ${entity.slug}`)
          .document_id(entity.id)
          .metadata('linked prd', entity.linked_prd_id)
          .metadata('target version', entity.target_version)
          .metadata('pass rate', `${entity.pass_rate}%`);

        if (entity.suites && entity.suites.length > 0) {
          const suite_rows = entity.suites.map((s) => `| ${s.suite_name} | ${s.pass_count} | ${s.fail_count} | ${s.duration_ms}ms |`);
          const table = [
            '| test suite | pass | fail | duration |',
            '| :--- | :--- | :--- | :--- |',
            ...suite_rows
          ].join('\n');

          builder.section.create('suites')
            .heading('test execution results')
            .contents(table);
        }

        if (entity.immutability_audit) {
          builder.section.create('immutability')
            .heading('test immutability audit')
            .contents(`- **baseline assertions**: ${entity.immutability_audit.baseline_assertions}\n- **current assertions**: ${entity.immutability_audit.current_assertions}\n- **delta**: ${entity.immutability_audit.delta}\n- **verdict**: ${entity.immutability_audit.valid ? 'verified (no assertion decrease)' : 'violation'}`);
        }

        return builder.render();
      }

      case DocumentEntityTypes.RELEASE_MANIFEST: {
        const builder = release.create(entity.slug || entity.id)
          .title(`release manifest: ${entity.version}`)
          .document_id(entity.id)
          .metadata('version', entity.version)
          .metadata('timestamp', entity.timestamp)
          .metadata('linked prds', entity.linked_prd_ids.join(', '));

        if (entity.deliverables && entity.deliverables.length > 0) {
          const del_rows = entity.deliverables.map((d) => `| \`${d.path}\` | \`${d.checksum}\` | ${d.description} |`);
          const table = [
            '| deliverable artefact | sha-256 checksum | description |',
            '| :--- | :--- | :--- |',
            ...del_rows
          ].join('\n');

          builder.section.create('deliverables')
            .heading('release deliverables & checksums')
            .contents(table);
        }

        if (entity.gate_receipts && entity.gate_receipts.length > 0) {
          const receipts_text = entity.gate_receipts.map((g) => `- **gate ${g.gate}**: signature \`${g.signature}\` (${g.timestamp})`).join('\n');
          builder.section.create('receipts')
            .heading('cryptographic gate receipts')
            .contents(receipts_text);
        }

        if (entity.changelog && entity.changelog.length > 0) {
          builder.section.create('changelog')
            .heading('release changelog')
            .contents(entity.changelog.map((entry) => `- ${entry}`).join('\n'));
        }

        return builder.render();
      }

      case DocumentEntityTypes.RETROSPECTIVE: {
        const builder = retrospective.create(entity.slug || entity.id)
          .title(`retrospective: ${entity.milestone}`)
          .document_id(entity.id)
          .metadata('milestone', entity.milestone)
          .metadata('linked prds', entity.linked_prd_ids.join(', '));

        if (entity.what_went_well && entity.what_went_well.length > 0) {
          builder.section.create('what_went_well')
            .heading('what went well')
            .contents(entity.what_went_well.map((w) => `- ${w}`).join('\n'));
        }

        if (entity.what_could_improve && entity.what_could_improve.length > 0) {
          builder.section.create('what_could_improve')
            .heading('areas for improvement & frictions')
            .contents(entity.what_could_improve.map((i) => `- ${i}`).join('\n'));
        }

        if (entity.action_items && entity.action_items.length > 0) {
          const actions_text = entity.action_items.map((ai) => `- [ ] **${ai.action}** (owner: ${ai.owner}, status: ${ai.status})`).join('\n');
          builder.section.create('action_items')
            .heading('agreed action items')
            .contents(actions_text);
        }

        return builder.render();
      }

      case DocumentEntityTypes.INTERFACE_CONTRACT: {
        const builder = doc.create(entity.slug || entity.id)
          .title(`interface contract: ${entity.component}`)
          .document_id(entity.id)
          .metadata('linked prd', entity.linked_prd_id)
          .metadata('version', entity.version);

        if (entity.methods && entity.methods.length > 0) {
          const methods_text = entity.methods.map((m) => {
            const params = m.parameters && m.parameters.length > 0
              ? `\n- **parameters**:\n${m.parameters.map((p) => `  - \`${p.name}\` (${p.type}): ${p.description}`).join('\n')}`
              : '\n- **parameters**: none';
            const ret = `\n- **returns**: \`${m.returns?.type || 'void'}\` - ${m.returns?.description || ''}`;
            return `### method: \`${m.name}\`\n${m.description}${params}${ret}`;
          }).join('\n\n');

          builder.section.create('methods')
            .heading('public interface methods')
            .contents(methods_text);
        }

        return builder.render();
      }

      case DocumentEntityTypes.TICKET: {
        const builder = doc.create(entity.id)
          .title(`ticket ${entity.id}: ${entity.title}`)
          .document_id(entity.id)
          .status(entity.status)
          .metadata('epic', entity.epic_id)
          .metadata('role', entity.role)
          .metadata('workflow', entity.workflow_id)
          .metadata('phase', entity.phase)
          .metadata('affinity', entity.affinity || 'unassigned');

        if (entity.depends_on && entity.depends_on.length > 0) {
          builder.section.create('dependencies')
            .heading('dependencies')
            .contents(entity.depends_on.map((d) => `- \`${d}\``).join('\n'));
        }

        if (entity.thread && entity.thread.length > 0) {
          const thread_text = entity.thread.map((c) => `- **[${c.timestamp}] ${c.author} (${c.role})** [${c.type}]: ${c.message}`).join('\n');
          builder.section.create('thread')
            .heading('ticket comment thread')
            .contents(thread_text);
        }

        return builder.render();
      }

      default:
        throw new Error(`cannot generate document: unhandled entity type "${type}"`);
    }
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: renders markdown summary of work board tickets
   * verbose: compiles stored tickets into a structured markdown board table and thread report.
   * 
   * section: arguments
   * - epic_id (string, optional): filter tickets by epic identifier
   * 
   * section: return value
   * - markdown (string): rendered markdown work board
   * 
   * section: example
   * const md = store.render_board_markdown('user-auth');
   */
  render_board_markdown(epic_id = null) {
    const tickets = this.list_entities(
      DocumentEntityTypes.TICKET,
      epic_id ? (t) => t.epic_id === epic_id : null
    );
    const builder = doc.create(epic_id || 'all-epics')
      .title(`work board: ${epic_id || 'all active epics'}`)
      .document_id(`board-${epic_id || 'global'}`);

    const rows = tickets.map((t) => (
      `| \`${t.id}\` | ${t.title} | \`${t.role}\` | \`${t.workflow_id}\` | **${t.status}** | ${t.depends_on.join(', ') || 'none'} | ${t.affinity || 'pool'} |`
    ));
    const table = [
      '| ticket id | title | role | workflow | status | depends_on | affinity |',
      '| :--- | :--- | :--- | :--- | :--- | :--- | :--- |',
      ...rows
    ].join('\n');

    builder.section.create('tickets')
      .heading('ticket queue')
      .contents(tickets.length > 0 ? table : 'no tickets registered on board.');

    return builder.render();
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: exports all stored documents to the file system using templates
   * verbose: walks store collections, compiles each entity through the template engine, and writes standard hierarchy to disk.
   * 
   * section: arguments
   * - export_options (object, optional): export configuration options
   * 
   * section: return value
   * - report (object): export receipt with total count and written file paths
   * 
   * section: example
   * const receipt = store.export_documents({ target_dir: 'dist/docs' });
   */
  export_documents(export_options = {}) {
    return export_documents_from_store(this, export_options);
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: generates code snippet from stored entity using templates
   * verbose: retrieves entity from datastore and compiles target code snippet template (test_suite, factory_function, gherkin_feature, interface_stub).
   * 
   * section: arguments
   * - type (string): document entity type
   * - id (string): document entity identifier
   * - snippet_type (string): code snippet template type
   * - snippet_options (object, optional): generation options
   * 
   * section: return value
   * - result (object): { code, path, bytes }
   * 
   * section: example
   * const snippet = store.generate_code_snippet('user_story', 'story-01', 'test_suite');
   */
  generate_code_snippet(type, id, snippet_type, snippet_options = {}) {
    const entity = this.get_entity(type, id);
    if (!entity) {
      throw new Error(`entity not found: type "${type}", id "${id}"`);
    }
    return generate_code_snippet(snippet_type, entity, snippet_options);
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: returns template engine instance
   * verbose: provides access to template engine configured for document and code generation.
   * 
   * section: arguments
   * none
   * 
   * section: return value
   * - engine (object): operational template engine
   * 
   * section: example
   * const engine = store.get_template_engine();
   */
  get_template_engine() {
    return get_default_template_engine();
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: builds structure-aware hybrid rag index over store entities and docs markdown
   * verbose: extracts sub-entity chunks from all 11 collections in .sdlc/store/ and section
   * chunks from docs/ markdown hierarchy, computing dense embeddings and bm25 term statistics.
   * 
   * section: arguments
   * - rag_options (object, optional): indexing options (docs_dir, index_path)
   * 
   * section: return value
   * - stats (object): indexing report with total_chunks, entity_chunks, and markdown_chunks
   * 
   * section: example
   * const stats = store.index_store_for_rag({ docs_dir: 'docs' });
   */
  index_store_for_rag(rag_options = {}) {
    const chunks = [];
    let entity_chunks = 0;
    let markdown_chunks = 0;

    const type_entries = Object.entries(type_to_collection_map);
    for (let t = 0; t < type_entries.length; t += 1) {
      const [entity_type, collection_name] = type_entries[t];
      const entities = this.adapter.find_all(collection_name);
      for (let e = 0; e < entities.length; e += 1) {
        const ent = entities[e];
        const linked_prd = ent.linked_prd_id || (Array.isArray(ent.linked_prd_ids) ? ent.linked_prd_ids[0] : (entity_type === DocumentEntityTypes.PRD ? ent.id : null));
        const summary_parts = [
          ent.id,
          ent.slug || '',
          ent.title || ent.component || ent.milestone || '',
          ent.context || '',
          ent.decision || '',
          ent.objective || '',
          ent.executive_summary ? `${ent.executive_summary.vision || ''} ${ent.executive_summary.problem || ''}` : '',
          Array.isArray(ent.functional_requirements)
            ? ent.functional_requirements.map((r) => `${r.id} ${r.title} ${r.description}`).join(' ')
            : '',
          Array.isArray(ent.acceptance_criteria)
            ? ent.acceptance_criteria.map((ac) => `${ac.id} ${ac.scenario} ${(ac.given || []).join(' ')} ${(ac.then || []).join(' ')}`).join(' ')
            : '',
          Array.isArray(ent.threat_vectors)
            ? ent.threat_vectors.map((tv) => `${tv.category} ${tv.risk} ${tv.mitigation}`).join(' ')
            : ''
        ].filter(Boolean).join('\n');

        const tokens = tokenise_rag_text(summary_parts);
        chunks.push({
          id: `entity:${entity_type}:${ent.id}`,
          source_kind: 'entity',
          type: entity_type,
          collection: collection_name,
          doc_id: ent.id,
          linked_prd_id: linked_prd || null,
          phase: collection_name,
          title: ent.title || ent.component || ent.id,
          text: summary_parts,
          tokens,
          embedding: compute_local_embedding(summary_parts)
        });
        entity_chunks += 1;
      }
    }

    if (rag_options.docs_dir && fs.existsSync(rag_options.docs_dir)) {
      const tier_dirs = fs.readdirSync(rag_options.docs_dir).sort();
      for (let d = 0; d < tier_dirs.length; d += 1) {
        const tier_name = tier_dirs[d];
        const tier_path = path.join(rag_options.docs_dir, tier_name);
        if (!fs.statSync(tier_path).isDirectory()) continue;

        const scan_dirs = [tier_path];
        const adr_subdir = path.join(tier_path, 'adr');
        if (fs.existsSync(adr_subdir) && fs.statSync(adr_subdir).isDirectory()) {
          scan_dirs.push(adr_subdir);
        }

        for (let s = 0; s < scan_dirs.length; s += 1) {
          const files = fs.readdirSync(scan_dirs[s]).filter((f) => f.endsWith('.md')).sort();
          for (let f = 0; f < files.length; f += 1) {
            const md_path = path.join(scan_dirs[s], files[f]);
            const md_content = fs.readFileSync(md_path, 'utf-8');
            const stem = files[f].replace(/\.md$/, '');
            const prd_match = stem.match(/^(prd-\d+)/);
            const md_sections = chunk_markdown_sections(md_content, {
              doc_id: stem,
              phase: tier_name,
              linked_prd_id: prd_match ? prd_match[1] : null,
              file_path: md_path
            });

            for (let c = 0; c < md_sections.length; c += 1) {
              const sec = md_sections[c];
              const combined = `${stem} ${sec.section_heading}\n${sec.text}`;
              chunks.push({
                id: `md:${sec.id}`,
                source_kind: 'markdown',
                type: 'markdown_section',
                collection: tier_name,
                doc_id: sec.metadata.doc_id,
                linked_prd_id: sec.metadata.linked_prd_id,
                phase: tier_name,
                title: sec.section_heading,
                text: sec.text,
                tokens: tokenise_rag_text(combined),
                embedding: compute_local_embedding(combined)
              });
              markdown_chunks += 1;
            }
          }
        }
      }
    }

    this.rag_index_chunks = chunks;
    const target_index_path = rag_options.index_path || this.rag_index_path;
    if (target_index_path) {
      this.rag_index_path = target_index_path;
      const parent_dir = path.dirname(target_index_path);
      if (!fs.existsSync(parent_dir)) {
        fs.mkdirSync(parent_dir, { recursive: true });
      }
      fs.writeFileSync(target_index_path, JSON.stringify({
        version: '0.1.0',
        indexed_at: new Date().toISOString(),
        total_chunks: chunks.length,
        entity_chunks,
        markdown_chunks,
        chunks
      }, null, 2), 'utf-8');
    }

    return {
      total_chunks: chunks.length,
      entity_chunks,
      markdown_chunks,
      index_path: target_index_path || null
    };
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: executes hybrid dense + bm25 reciprocal rank fusion search over the doc store
   * verbose: combines cosine similarity over local embeddings and bm25 lexical scores using
   * reciprocal rank fusion (rrf) with optional metadata filtering (type, linked_prd_id, phase).
   * 
   * section: arguments
   * - query (string): search query string
   * - search_options (object, optional): search configuration (top_k, filter, rrf_k)
   * 
   * section: return value
   * - hits (Array<object>): ranked search results with rrf_score, bm25_score, and vector_score
   * 
   * section: example
   * const hits = store.search_doc_store('modern es6 memory', { top_k: 5 });
   */
  search_doc_store(query, search_options = {}) {
    if (this.rag_index_chunks.length === 0) {
      if (this.rag_index_path && fs.existsSync(this.rag_index_path)) {
        try {
          const loaded = JSON.parse(fs.readFileSync(this.rag_index_path, 'utf-8'));
          if (loaded && Array.isArray(loaded.chunks)) {
            this.rag_index_chunks = loaded.chunks;
          }
        } catch (_err) {
          // rebuild below
        }
      }
      if (this.rag_index_chunks.length === 0) {
        this.index_store_for_rag();
      }
    }

    const filter = search_options.filter || null;
    const candidates = this.rag_index_chunks.filter((chunk) => {
      if (!filter) return true;
      if (filter.type && chunk.type !== filter.type) return false;
      if (filter.collection && chunk.collection !== filter.collection) return false;
      if (filter.linked_prd_id && chunk.linked_prd_id !== filter.linked_prd_id) return false;
      if (filter.phase && chunk.phase !== filter.phase) return false;
      if (filter.doc_id && chunk.doc_id !== filter.doc_id) return false;
      return true;
    });

    if (candidates.length === 0) {
      return [];
    }

    const query_tokens = tokenise_rag_text(query);
    const query_embedding = compute_local_embedding(query);
    const n_docs = candidates.length;
    let total_len = 0;
    for (let i = 0; i < n_docs; i += 1) {
      total_len += (candidates[i].tokens ? candidates[i].tokens.length : 1);
    }
    const avg_dl = (total_len / n_docs) || 1;
    const k1 = 1.5;
    const b = 0.75;

    const scored = candidates.map((chunk) => {
      const doc_tokens = chunk.tokens || [];
      const dl = doc_tokens.length || 1;
      let bm25 = 0;

      for (let q = 0; q < query_tokens.length; q += 1) {
        const term = query_tokens[q];
        let tf = 0;
        for (let t = 0; t < doc_tokens.length; t += 1) {
          if (doc_tokens[t] === term) tf += 1;
        }
        if (tf > 0) {
          let df = 0;
          for (let d = 0; d < n_docs; d += 1) {
            const c_tokens = candidates[d].tokens || [];
            if (c_tokens.includes(term)) df += 1;
          }
          const idf = Math.log(1 + (n_docs - df + 0.5) / (df + 0.5));
          const num = tf * (k1 + 1);
          const den = tf + k1 * (1 - b + b * (dl / avg_dl));
          bm25 += idf * (num / den);
        }
      }

      const vec_score = cosine_similarity(query_embedding, chunk.embedding || []);
      return {
        chunk,
        bm25_score: bm25,
        vector_score: vec_score
      };
    });

    const by_bm25 = scored.slice().sort((x, y) => y.bm25_score - x.bm25_score);
    const by_vec = scored.slice().sort((x, y) => y.vector_score - x.vector_score);
    const rrf_k = search_options.rrf_k || 60;

    const fused = scored.map((entry) => {
      const bm25_rank = by_bm25.findIndex((item) => item.chunk.id === entry.chunk.id) + 1;
      const vec_rank = by_vec.findIndex((item) => item.chunk.id === entry.chunk.id) + 1;
      const rrf_score = (1 / (rrf_k + bm25_rank)) + (1 / (rrf_k + vec_rank));
      return {
        id: entry.chunk.id,
        doc_id: entry.chunk.doc_id,
        type: entry.chunk.type,
        collection: entry.chunk.collection,
        linked_prd_id: entry.chunk.linked_prd_id,
        phase: entry.chunk.phase,
        title: entry.chunk.title,
        text: entry.chunk.text,
        bm25_score: Number(entry.bm25_score.toFixed(6)),
        vector_score: Number(entry.vector_score.toFixed(6)),
        rrf_score: Number(rrf_score.toFixed(6))
      };
    });

    fused.sort((x, y) => (y.rrf_score - x.rrf_score) || (y.bm25_score - x.bm25_score));
    const top_k = search_options.top_k || 10;
    return fused.slice(0, top_k);
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: synchronises structured store entities and worker notes into a mastra knowledge graph
   * verbose: creates scoped knowledge nodes for prds, adrs, interfaces, stories, and threat
   * models with [[wiki-link]] mentions and appends attributed specialist worker notes.
   * 
   * section: arguments
   * - sync_options (object, optional): configuration including knowledge, linked_prd_id, and notes
   * 
   * section: return value
   * - report (object): synchronisation summary with knowledge instance, nodes_synced, and notes_appended
   * 
   * section: example
   * const res = await store.sync_to_knowledge({ linked_prd_id: 'prd-03' });
   */
  async sync_to_knowledge(sync_options = {}) {
    const knowledge = sync_options.knowledge || resolve_harness_knowledge({
      storage_type: sync_options.storage_type || 'in-memory',
      storage_dir: sync_options.storage_dir
    });

    const target_prd_id = sync_options.linked_prd_id || null;
    const prds = this.list_entities(
      DocumentEntityTypes.PRD,
      target_prd_id ? (p) => p.id === target_prd_id : null
    );

    let nodes_synced = 0;
    let notes_appended = 0;
    const created_nodes = [];

    for (let p = 0; p < prds.length; p += 1) {
      const prd_ent = prds[p];
      const scope = ['org:sdlc', `resource:${prd_ent.id}`];
      const tree = this.query_by_prd(prd_ent.id);

      for (let a = 0; a < tree.adrs.length; a += 1) {
        const adr_ent = tree.adrs[a];
        const adr_node = await knowledge.createNode({
          scope,
          name: adr_ent.id,
          kind: 'adr',
          description: String(adr_ent.title || adr_ent.id).slice(0, 200),
          content: `${adr_ent.context || ''}\n${adr_ent.decision || ''}`
        });
        created_nodes.push({ id: adr_ent.id, scope, node: adr_node });
        nodes_synced += 1;
      }

      const adr_links = tree.adrs.map((a) => `[[${a.id}]]`).join(' ');
      const req_summary = (prd_ent.functional_requirements || [])
        .map((r) => `${r.id}: ${r.title} - ${r.description}`)
        .join('\n');

      const prd_node = await knowledge.createNode({
        scope,
        name: prd_ent.id,
        kind: 'prd',
        description: String(prd_ent.title || prd_ent.id).slice(0, 200),
        content: `${req_summary}\n${adr_links}`.trim(),
        resolutionScope: scope
      });
      created_nodes.push({ id: prd_ent.id, scope, node: prd_node });
      nodes_synced += 1;
    }

    const incoming_notes = Array.isArray(sync_options.notes) ? sync_options.notes : [];
    for (let n = 0; n < incoming_notes.length; n += 1) {
      const note = incoming_notes[n];
      const match = created_nodes.find((cn) => cn.id === note.target_id) || created_nodes[0];
      if (match) {
        await knowledge.appendKnowledge({
          scope: match.scope,
          node: match.node,
          text: note.text,
          sourceThreadId: note.source_thread_id || 'sdlc-sync',
          resolutionScope: match.scope,
          defaultScope: match.scope,
          metadata: {
            author: note.author || 'sdlc-supervisor'
          }
        });
        notes_appended += 1;
      }
    }

    return {
      knowledge,
      nodes_synced,
      notes_appended
    };
  }
}

/**
 * function: create_document_entity_store
 * tldr: convenience constructor returning a new DocumentEntityStore
 */
export function create_document_entity_store(options = {}) {
  return new DocumentEntityStore(options);
}
