/**
 * =========================================================================
 * module: SdlcProcessArchitecture.js
 * =========================================================================
 *
 * section: version number
 * version: 0.1.0
 *
 * section: documentation
 * tldr: three-tier separation of concerns for sdlc process objects, process definitions, and project sdlc configurations
 * verbose: separates the sdlc lifecycle into three manipulable architectural levels:
 *   1. sdlc process objects (create_sdlc_process_objects): the primitive building blocks
 *      (phases, review gates, specialist roles, workflows, work-item types, artefact schemas, rules).
 *   2. sdlc process definitions (create_sdlc_process_definition, create_sdlc_process_registry):
 *      composable dag configurations of those building blocks that define an sdlc process
 *      (e.g. develop-feature, fix-defect, emergency-hotfix, or custom processes).
 *   3. project sdlc configuration (create_project_sdlc_config): project-level binding and
 *      policy overrides (enabled processes, stage overrides, gate thresholds, worker pool routing).
 *
 * section: arguments
 * - options (object, optional): configuration options for objects, definitions, and project config
 *
 * section: return value
 * - module exports (object): factory functions for all three sdlc configuration levels
 *
 * section: example
 * import {
 *   create_sdlc_process_objects,
 *   create_sdlc_process_registry,
 *   create_project_sdlc_config
 * } from './SdlcProcessArchitecture.js';
 * =========================================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  list_sdlc_phases,
  list_review_gates,
  list_work_item_types
} from './HarnessCatalog.js';
import { DocumentEntityTypes } from './DocumentEntitiesSchema.js';
import { HIGH_LEVEL_PROCESS_PROFILES } from './SdlcSupervisor.js';

const DEFAULT_ROLE_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: 'product-manager',
    name: 'product manager',
    controller_mode: 'discovery',
    default_workflows: ['pm-prd-authoring', 'pm-story-slicing'],
    description: 'authors prds, slices user stories, defines acceptance criteria, and approves pr merges'
  }),
  Object.freeze({
    id: 'system-architect',
    name: 'system architect',
    controller_mode: 'architecture',
    default_workflows: ['arch-adr-authoring', 'arch-interface-contract'],
    description: 'authors architectural decision records (adrs) and interface contracts'
  }),
  Object.freeze({
    id: 'software-engineer',
    name: 'software engineer',
    controller_mode: 'implementation',
    default_workflows: ['se-feature-implementation', 'se-defect-patch'],
    description: 'executes tdd red-green-refactor implementation cycles and defect patches'
  }),
  Object.freeze({
    id: 'security-engineer',
    name: 'security engineer',
    controller_mode: 'security',
    default_workflows: ['sec-threat-modeling'],
    description: 'conducts stride threat modelling, owasp audits, and security gate attestations'
  }),
  Object.freeze({
    id: 'qa-engineer',
    name: 'qa engineer',
    controller_mode: 'qa',
    default_workflows: ['qa-regression-audit'],
    description: 'executes regression suites, bdd verification, and test immutability audits'
  }),
  Object.freeze({
    id: 'devops-engineer',
    name: 'devops engineer',
    controller_mode: 'release',
    default_workflows: [
      'devops-release-packaging',
      'devops-retrospective-authoring',
      'devops-project-decommissioning'
    ],
    description: 'manages semantic releases, cryptographic gate receipts, and blameless retrospectives'
  }),
  Object.freeze({
    id: 'autonomous-engineer',
    name: 'autonomous engineer',
    controller_mode: 'autonomous',
    default_workflows: ['se-feature-implementation', 'se-defect-patch'],
    description: 'operates untethered workspace diagnostics and direct code repair'
  }),
  Object.freeze({
    id: 'sdlc-supervisor',
    name: 'sdlc supervisor',
    controller_mode: 'supervisor',
    default_workflows: [],
    description: 'tier 1 supervisory governor mediating statecharts, work board, and review gates'
  })
]);

const DEFAULT_WORKFLOW_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: 'pm-prd-authoring',
    role: 'product-manager',
    phase: 'inception',
    produces_artefact: DocumentEntityTypes.PRD,
    description: 'authors structured product requirements document (prd) entities'
  }),
  Object.freeze({
    id: 'pm-story-slicing',
    role: 'product-manager',
    phase: 'specification',
    produces_artefact: DocumentEntityTypes.USER_STORY,
    spawns_tasks: true,
    description: 'slices prd requirements into user stories and implementation tasks'
  }),
  Object.freeze({
    id: 'arch-adr-authoring',
    role: 'system-architect',
    phase: 'architecture',
    produces_artefact: DocumentEntityTypes.ADR,
    description: 'authors architectural decision records (adrs)'
  }),
  Object.freeze({
    id: 'arch-interface-contract',
    role: 'system-architect',
    phase: 'architecture',
    produces_artefact: DocumentEntityTypes.INTERFACE_CONTRACT,
    description: 'defines formal component and api interface contracts'
  }),
  Object.freeze({
    id: 'se-feature-implementation',
    role: 'software-engineer',
    phase: 'tdd_red',
    produces_artefact: DocumentEntityTypes.TASK,
    description: 'executes tdd red-green-refactor implementation cycle'
  }),
  Object.freeze({
    id: 'se-defect-patch',
    role: 'software-engineer',
    phase: 'reproduction_test',
    produces_artefact: DocumentEntityTypes.TASK,
    description: 'reproduces defect with failing test and applies minimal green patch'
  }),
  Object.freeze({
    id: 'sec-threat-modeling',
    role: 'security-engineer',
    phase: 'security_qa',
    produces_artefact: DocumentEntityTypes.THREAT_MODEL,
    description: 'conducts stride threat modelling and owasp security verification'
  }),
  Object.freeze({
    id: 'qa-regression-audit',
    role: 'qa-engineer',
    phase: 'security_qa',
    produces_artefact: DocumentEntityTypes.TEST_REPORT,
    description: 'executes regression test suite and verifies test immutability invariants'
  }),
  Object.freeze({
    id: 'devops-release-packaging',
    role: 'devops-engineer',
    phase: 'release',
    produces_artefact: DocumentEntityTypes.RELEASE_MANIFEST,
    description: 'packages semantic release manifest and seals cryptographic gate receipt'
  }),
  Object.freeze({
    id: 'devops-retrospective-authoring',
    role: 'devops-engineer',
    phase: 'continuous_learning',
    produces_artefact: DocumentEntityTypes.RETROSPECTIVE,
    description: 'authors blameless continuous learning retrospective'
  }),
  Object.freeze({
    id: 'devops-project-decommissioning',
    role: 'devops-engineer',
    phase: 'release',
    produces_artefact: DocumentEntityTypes.RELEASE_MANIFEST,
    description: 'archives component artefacts and seals decommissioning receipt'
  })
]);

function clone_deep(value) {
  if (value === null || value === undefined || typeof value !== 'object') {
    return value;
  }
  return JSON.parse(JSON.stringify(value));
}

/**
 * =========================================================================
 * level 1: ObjectCatalog hierarchy
 * =========================================================================
 *
 * section: version number
 * version: 0.2.0
 *
 * section: documentation
 * tldr: map-backed catalogs for the primitive sdlc process objects
 * verbose: ObjectCatalog is the shared base class providing id-keyed crud with deep-cloned
 * reads. PhaseCatalog, GateCatalog, RoleCatalog, WorkflowCatalog, WorkItemTypeCatalog, and
 * ArtefactTypeCatalog extend it to supply their own defaults via normalise().
 * =========================================================================
 */
export class ObjectCatalog {
  items = new Map();

  constructor(kind, seed = []) {
    this.kind = kind;
    for (const def of seed) {
      if (def && def.id) {
        this.items.set(def.id, clone_deep(def));
      }
    }
  }

  /** subclasses override to apply defaults to a registered definition */
  normalise(def) {
    return clone_deep(def);
  }

  list() {
    return [...this.items.values()].map(clone_deep);
  }

  get(id) {
    return this.items.has(id) ? clone_deep(this.items.get(id)) : null;
  }

  register(def) {
    if (!def || !def.id) {
      throw new Error(`invalid_${this.kind}_object: ${this.kind} definition requires an id`);
    }
    const next = this.normalise(def);
    this.items.set(next.id, next);
    return clone_deep(next);
  }

  update(id, patch = {}) {
    if (!this.items.has(id)) {
      throw new Error(`${this.kind}_not_found: '${id}'`);
    }
    const next = { ...this.items.get(id), ...clone_deep(patch), id };
    this.items.set(id, next);
    return clone_deep(next);
  }

  remove(id) {
    return this.items.delete(id);
  }
}

export class PhaseCatalog extends ObjectCatalog {
  constructor(seed) {
    super('phase', seed);
  }

  normalise(def) {
    return {
      id: def.id,
      name: def.name || def.id,
      description: def.description || '',
      order: def.order ?? this.items.size,
      gate: def.gate ?? null,
      ...clone_deep(def)
    };
  }

  list() {
    return super.list().sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  }
}

export class GateCatalog extends ObjectCatalog {
  constructor(seed) {
    super('gate', seed);
  }

  normalise(def) {
    return {
      id: def.id,
      name: def.name || def.id,
      evaluates: Array.isArray(def.evaluates) ? def.evaluates.slice() : [],
      description: def.description || '',
      invariants: Array.isArray(def.invariants) ? def.invariants.slice() : [],
      ...clone_deep(def)
    };
  }
}

export class RoleCatalog extends ObjectCatalog {
  constructor(seed) {
    super('role', seed);
  }

  normalise(def) {
    return {
      id: def.id,
      name: def.name || def.id,
      controller_mode: def.controller_mode || def.id,
      default_workflows: Array.isArray(def.default_workflows) ? def.default_workflows.slice() : [],
      description: def.description || '',
      ...clone_deep(def)
    };
  }
}

export class WorkflowCatalog extends ObjectCatalog {
  constructor(seed) {
    super('workflow', seed);
  }

  normalise(def) {
    return {
      id: def.id,
      role: def.role || 'software-engineer',
      phase: def.phase || 'implementation',
      produces_artefact: def.produces_artefact || DocumentEntityTypes.TASK,
      description: def.description || '',
      ...clone_deep(def)
    };
  }
}

export class WorkItemTypeCatalog extends ObjectCatalog {
  constructor(seed) {
    super('work_item_type', seed);
  }

  normalise(def) {
    return {
      id: def.id,
      name: def.name || def.id,
      description: def.description || '',
      stages: Array.isArray(def.stages) ? def.stages.slice() : [],
      ...clone_deep(def)
    };
  }
}

export class ArtefactTypeCatalog extends ObjectCatalog {
  constructor() {
    super('artefact_type');
    for (const [key, val] of Object.entries(DocumentEntityTypes)) {
      this.items.set(val, {
        id: val,
        constant_key: key,
        description: `structured sdlc document entity (${val})`
      });
    }
  }
}

/**
 * =========================================================================
 * level 1: SdlcProcessObjects
 * =========================================================================
 *
 * section: version number
 * version: 0.2.0
 *
 * section: documentation
 * tldr: level 1 registry and manipulator for primitive sdlc process objects
 * verbose: composes the catalogs above and exposes the foundational building blocks that make up
 * any sdlc process (phases, review gates, specialist roles, workflows, work-item types, artefact
 * types) with full crud manipulation methods.
 *
 * section: arguments
 * - options (object, optional): custom initial phases, gates, roles, workflows, or work_item_types
 *
 * section: example
 * const objects = new SdlcProcessObjects();
 * objects.register_gate({ id: 'gate_custom', name: 'custom gate', evaluates: ['architecture'], invariants: ['custom check'] });
 * =========================================================================
 */
export class SdlcProcessObjects {
  level = 'sdlc_process_objects';

  constructor(options = {}) {
    this.phases = new PhaseCatalog(Array.isArray(options.phases) ? options.phases : list_sdlc_phases());
    this.gates = new GateCatalog(Array.isArray(options.gates) ? options.gates : list_review_gates());
    this.roles = new RoleCatalog(Array.isArray(options.roles) ? options.roles : DEFAULT_ROLE_DEFINITIONS);
    this.workflows = new WorkflowCatalog(Array.isArray(options.workflows) ? options.workflows : DEFAULT_WORKFLOW_DEFINITIONS);
    this.work_item_types = new WorkItemTypeCatalog(
      Array.isArray(options.work_item_types) ? options.work_item_types : list_work_item_types()
    );
    this.artefact_types = new ArtefactTypeCatalog();
  }

  // --- phases ---
  list_phases() { return this.phases.list(); }
  get_phase(id) { return this.phases.get(id); }
  register_phase(phase_def) { return this.phases.register(phase_def); }
  update_phase(id, patch = {}) { return this.phases.update(id, patch); }
  remove_phase(id) { return this.phases.remove(id); }

  // --- review gates ---
  list_gates() { return this.gates.list(); }
  get_gate(id) { return this.gates.get(id); }
  register_gate(gate_def) { return this.gates.register(gate_def); }
  update_gate(id, patch = {}) { return this.gates.update(id, patch); }
  remove_gate(id) { return this.gates.remove(id); }

  // --- roles ---
  list_roles() { return this.roles.list(); }
  get_role(id) { return this.roles.get(id); }
  register_role(role_def) { return this.roles.register(role_def); }
  update_role(id, patch = {}) { return this.roles.update(id, patch); }
  remove_role(id) { return this.roles.remove(id); }

  // --- workflows ---
  list_workflows() { return this.workflows.list(); }
  get_workflow(id) { return this.workflows.get(id); }
  register_workflow(workflow_def) { return this.workflows.register(workflow_def); }
  update_workflow(id, patch = {}) { return this.workflows.update(id, patch); }
  remove_workflow(id) { return this.workflows.remove(id); }

  // --- work item types ---
  list_work_item_types() { return this.work_item_types.list(); }
  get_work_item_type(id) { return this.work_item_types.get(id); }
  register_work_item_type(type_def) { return this.work_item_types.register(type_def); }
  update_work_item_type(id, patch = {}) { return this.work_item_types.update(id, patch); }

  // --- artefact types ---
  list_artefact_types() { return this.artefact_types.list(); }
  get_artefact_type(id) { return this.artefact_types.get(id); }
  register_artefact_type(art_def) { return this.artefact_types.register(art_def); }

  // --- snapshot ---
  to_snapshot() {
    return {
      phases: this.list_phases(),
      gates: this.list_gates(),
      roles: this.list_roles(),
      workflows: this.list_workflows(),
      work_item_types: this.list_work_item_types(),
      artefact_types: this.list_artefact_types()
    };
  }
}

/**
 * function: create_sdlc_process_objects
 * tldr: convenience constructor returning a new SdlcProcessObjects
 */
export function create_sdlc_process_objects(options = {}) {
  return new SdlcProcessObjects(options);
}

/**
 * =========================================================================
 * level 2: SdlcProcessDefinition
 * =========================================================================
 *
 * section: version number
 * version: 0.2.0
 *
 * section: documentation
 * tldr: level 2 dag process definition composed of level 1 process objects
 * verbose: holds the ordered stages of one sdlc process and provides stage manipulation,
 * gate binding, validation against level 1 objects, and cloning.
 *
 * section: arguments
 * - spec (object): process definition spec (requires an id)
 * - process_objects (SdlcProcessObjects, optional): level 1 objects used for validation
 *
 * section: example
 * const def = new SdlcProcessDefinition({ id: 'my-process', stages: [] }, objects);
 * =========================================================================
 */
export class SdlcProcessDefinition {
  level = 'sdlc_process_definition';

  constructor(spec = {}, process_objects = null) {
    if (!spec || !spec.id) {
      throw new Error('invalid_process_definition: process definition requires an id');
    }
    this.process_objects = process_objects;
    this.state = {
      id: String(spec.id).trim(),
      name: spec.name || spec.id,
      domain: spec.domain || 'engineering',
      commit_type: spec.commit_type || 'feat',
      sdlc_profile: spec.sdlc_profile || 'custom-sdlc',
      work_item_type: spec.work_item_type || 'feature',
      description: spec.description || '',
      gates: Array.isArray(spec.gates) ? spec.gates.slice() : [],
      stages: Array.isArray(spec.stages)
        ? spec.stages.map((st) => ({
            suffix: st.suffix,
            title: st.title || st.suffix,
            role: st.role || 'software-engineer',
            workflow_id: st.workflow_id || 'se-feature-implementation',
            phase: st.phase || 'implementation',
            depends_on: Array.isArray(st.depends_on) ? st.depends_on.slice() : [],
            spawns_tasks: Boolean(st.spawns_tasks),
            gate_after: st.gate_after || null
          }))
        : []
    };
  }


  get_id() {
    return this.state.id;
  }

  get_profile() {
    return clone_deep(this.state);
  }

  update_metadata(patch = {}) {
    if (patch.name !== undefined) this.state.name = patch.name;
    if (patch.domain !== undefined) this.state.domain = patch.domain;
    if (patch.commit_type !== undefined) this.state.commit_type = patch.commit_type;
    if (patch.sdlc_profile !== undefined) this.state.sdlc_profile = patch.sdlc_profile;
    if (patch.work_item_type !== undefined) this.state.work_item_type = patch.work_item_type;
    if (patch.description !== undefined) this.state.description = patch.description;
    if (Array.isArray(patch.gates)) this.state.gates = patch.gates.slice();
    return this.get_profile();
  }

  list_stages() {
    return clone_deep(this.state.stages);
  }

  get_stage(suffix) {
    const found = this.state.stages.find((s) => s.suffix === suffix);
    return found ? clone_deep(found) : null;
  }

  add_stage(stage_def) {
    if (!stage_def || !stage_def.suffix) {
      throw new Error('invalid_stage: stage definition requires a suffix');
    }
    const existing_idx = this.state.stages.findIndex((s) => s.suffix === stage_def.suffix);
    const formatted = {
      suffix: stage_def.suffix,
      title: stage_def.title || stage_def.suffix,
      role: stage_def.role || 'software-engineer',
      workflow_id: stage_def.workflow_id || 'se-feature-implementation',
      phase: stage_def.phase || 'implementation',
      depends_on: Array.isArray(stage_def.depends_on) ? stage_def.depends_on.slice() : [],
      spawns_tasks: Boolean(stage_def.spawns_tasks),
      gate_after: stage_def.gate_after || null
    };
    if (existing_idx >= 0) {
      this.state.stages[existing_idx] = formatted;
    } else {
      this.state.stages.push(formatted);
    }
    return clone_deep(formatted);
  }

  insert_stage_after(after_suffix, stage_def) {
    if (!stage_def || !stage_def.suffix) {
      throw new Error('invalid_stage: stage definition requires a suffix');
    }
    const target_idx = this.state.stages.findIndex((s) => s.suffix === after_suffix);
    const deps = Array.isArray(stage_def.depends_on) && stage_def.depends_on.length > 0
      ? stage_def.depends_on.slice()
      : (after_suffix ? [after_suffix] : []);
    const formatted = {
      suffix: stage_def.suffix,
      title: stage_def.title || stage_def.suffix,
      role: stage_def.role || 'software-engineer',
      workflow_id: stage_def.workflow_id || 'se-feature-implementation',
      phase: stage_def.phase || 'implementation',
      depends_on: deps,
      spawns_tasks: Boolean(stage_def.spawns_tasks),
      gate_after: stage_def.gate_after || null
    };
    if (target_idx === -1) {
      this.state.stages.push(formatted);
    } else {
      this.state.stages.splice(target_idx + 1, 0, formatted);
    }
    return clone_deep(formatted);
  }

  update_stage(suffix, patch = {}) {
    const idx = this.state.stages.findIndex((s) => s.suffix === suffix);
    if (idx === -1) {
      throw new Error(`stage_not_found: '${suffix}' in process '${this.state.id}'`);
    }
    this.state.stages[idx] = {
      ...state.stages[idx],
      ...clone_deep(patch),
      suffix
    };
    return clone_deep(this.state.stages[idx]);
  }

  remove_stage(suffix, options = {}) {
    const idx = this.state.stages.findIndex((s) => s.suffix === suffix);
    if (idx === -1) return false;
    const removed = this.state.stages[idx];
    this.state.stages.splice(idx, 1);

    // rewire downstream dependencies so removing an intermediate stage does not orphan downstream stages
    const replacement_deps = options.rewire_dependencies !== false ? (removed.depends_on || []) : [];
    for (let i = 0; i < this.state.stages.length; i += 1) {
      const st = this.state.stages[i];
      if (Array.isArray(st.depends_on) && st.depends_on.includes(suffix)) {
        const filtered = st.depends_on.filter((d) => d !== suffix);
        for (let r = 0; r < replacement_deps.length; r += 1) {
          if (!filtered.includes(replacement_deps[r]) && replacement_deps[r] !== st.suffix) {
            filtered.push(replacement_deps[r]);
          }
        }
        st.depends_on = filtered;
      }
    }
    return true;
  }

  bind_gate(stage_suffix, gate_id) {
    const st = this.state.stages.find((s) => s.suffix === stage_suffix);
    if (!st) {
      throw new Error(`stage_not_found: '${stage_suffix}' in process '${this.state.id}'`);
    }
    st.gate_after = gate_id;
    if (gate_id && !this.state.gates.includes(gate_id)) {
      this.state.gates.push(gate_id);
    }
    return clone_deep(st);
  }

  unbind_gate(stage_suffix) {
    const st = this.state.stages.find((s) => s.suffix === stage_suffix);
    if (!st) return false;
    st.gate_after = null;
    return true;
  }

  validate(target_objects = this.process_objects) {
    const violations = [];
    const stage_map = {};
    for (let i = 0; i < this.state.stages.length; i += 1) {
      const st = this.state.stages[i];
      stage_map[st.suffix] = st;
    }

    if (target_objects) {
      if (this.state.work_item_type && !target_objects.get_work_item_type(this.state.work_item_type)) {
        violations.push(`unknown_work_item_type:${this.state.work_item_type}`);
      }
      for (let i = 0; i < this.state.stages.length; i += 1) {
        const st = this.state.stages[i];
        if (!target_objects.get_role(st.role)) {
          violations.push(`stage_${st.suffix}:unknown_role:${st.role}`);
        }
        if (!target_objects.get_workflow(st.workflow_id)) {
          violations.push(`stage_${st.suffix}:unknown_workflow:${st.workflow_id}`);
        }
        if (st.gate_after && !target_objects.get_gate(st.gate_after)) {
          violations.push(`stage_${st.suffix}:unknown_gate:${st.gate_after}`);
        }
      }
    }

    // check missing dependencies and cycles
    for (let i = 0; i < this.state.stages.length; i += 1) {
      const st = this.state.stages[i];
      const deps = st.depends_on || [];
      for (let d = 0; d < deps.length; d += 1) {
        if (!stage_map[deps[d]]) {
          violations.push(`stage_${st.suffix}:missing_dependency:${deps[d]}`);
        }
      }
    }

    const visited = {};
    const in_stack = {};
    function has_cycle(suffix) {
      if (in_stack[suffix]) return true;
      if (visited[suffix]) return false;
      visited[suffix] = true;
      in_stack[suffix] = true;
      const st = stage_map[suffix];
      const deps = st?.depends_on || [];
      for (let i = 0; i < deps.length; i += 1) {
        if (stage_map[deps[i]] && has_cycle(deps[i])) {
          return true;
        }
      }
      in_stack[suffix] = false;
      return false;
    }

    for (let i = 0; i < this.state.stages.length; i += 1) {
      if (has_cycle(this.state.stages[i].suffix)) {
        violations.push(`cycle_detected_at_stage:${this.state.stages[i].suffix}`);
        break;
      }
    }

    return {
      valid: violations.length === 0,
      process_id: this.state.id,
      stage_count: this.state.stages.length,
      violations
    };
  }

  clone(new_id, overrides = {}) {
    const cloned_spec = {
      ...this.get_profile(),
      ...clone_deep(overrides),
      id: new_id || `${this.state.id}-copy`
    };
    return new SdlcProcessDefinition(cloned_spec, this.process_objects);
  }
}

/**
 * function: create_sdlc_process_definition
 * tldr: convenience constructor returning a new SdlcProcessDefinition
 */
export function create_sdlc_process_definition(spec = {}, process_objects = null) {
  return new SdlcProcessDefinition(spec, process_objects);
}

/**
 * =========================================================================
 * level 2 registry: SdlcProcessRegistry
 * =========================================================================
 *
 * section: version number
 * version: 0.2.0
 *
 * section: documentation
 * tldr: map-backed registry of level 2 sdlc process definitions seeded with all 25 built-in processes
 * verbose: manages all sdlc process definitions, allowing callers to inspect, modify, clone,
 * validate, or register new sdlc processes composed of level 1 process objects.
 *
 * section: arguments
 * - options (object, optional): { process_objects, initial_profiles }
 *
 * section: example
 * const reg = new SdlcProcessRegistry({ process_objects });
 * const feat_def = reg.get_definition('develop-feature');
 * =========================================================================
 */
export class SdlcProcessRegistry {
  level = 'sdlc_process_registry';
  definitions = new Map();

  constructor(options = {}) {
    this.process_objects = options.process_objects || new SdlcProcessObjects(options);
    const initial_profiles = Array.isArray(options.initial_profiles)
      ? options.initial_profiles
      : HIGH_LEVEL_PROCESS_PROFILES;
    for (const prof of initial_profiles) {
      if (prof && prof.id) {
        this.definitions.set(prof.id, new SdlcProcessDefinition(prof, this.process_objects));
      }
    }
  }

  get_process_objects() {
    return this.process_objects;
  }

  list_definitions(domain = null) {
    const all = [...this.definitions.values()];
    if (!domain) {
      return all;
    }
    return all.filter((def) => def.get_profile().domain === domain);
  }

  list_profiles(domain = null) {
    return this.list_definitions(domain).map((def) => def.get_profile());
  }

  get_definition(id) {
    return this.definitions.get(id) ?? null;
  }

  get_profile(id) {
    const def = this.definitions.get(id);
    return def ? def.get_profile() : null;
  }

  register_definition(spec) {
    const def = spec && spec.level === 'sdlc_process_definition'
      ? spec
      : new SdlcProcessDefinition(spec, this.process_objects);
    this.definitions.set(def.get_id(), def);
    return def;
  }

  clone_definition(source_id, new_id, overrides = {}) {
    const source = this.definitions.get(source_id);
    if (!source) {
      throw new Error(`process_definition_not_found: '${source_id}'`);
    }
    const cloned = source.clone(new_id, overrides);
    this.definitions.set(cloned.get_id(), cloned);
    return cloned;
  }

  update_definition(id, mutator_or_patch) {
    const def = this.definitions.get(id);
    if (!def) {
      throw new Error(`process_definition_not_found: '${id}'`);
    }
    if (typeof mutator_or_patch === 'function') {
      mutator_or_patch(def);
    } else if (mutator_or_patch && typeof mutator_or_patch === 'object') {
      def.update_metadata(mutator_or_patch);
      if (Array.isArray(mutator_or_patch.add_stages)) {
        for (let i = 0; i < mutator_or_patch.add_stages.length; i += 1) {
          def.add_stage(mutator_or_patch.add_stages[i]);
        }
      }
      if (Array.isArray(mutator_or_patch.remove_stages)) {
        for (let i = 0; i < mutator_or_patch.remove_stages.length; i += 1) {
          def.remove_stage(mutator_or_patch.remove_stages[i]);
        }
      }
    }
    return def;
  }

  remove_definition(id) {
    return this.definitions.delete(id);
  }

  validate_all() {
    const results = [];
    for (const def of this.definitions.values()) {
      results.push(def.validate(this.process_objects));
    }
    return {
      valid: results.every((r) => r.valid),
      count: results.length,
      results
    };
  }
}

/**
 * function: create_sdlc_process_registry
 * tldr: convenience constructor returning a new SdlcProcessRegistry
 */
export function create_sdlc_process_registry(options = {}) {
  return new SdlcProcessRegistry(options);
}

/**
 * =========================================================================
 * level 3: ProjectSdlcConfig
 * =========================================================================
 *
 * section: version number
 * version: 0.2.0
 *
 * section: documentation
 * tldr: level 3 project-specific sdlc configuration and policy manipulator
 * verbose: binds a project to its configured sdlc process definitions (level 2) and primitive
 * sdlc objects (level 1). allows a project to enable/disable processes, apply project-specific
 * stage overrides (skipping/adding stages, changing concurrency or worker counts), configure
 * gate thresholds, and enforce worker pool routing for all submitted requests.
 * the state is deliberately kept as plain json so it round-trips to .sdlc/project-sdlc-config.json.
 *
 * section: arguments
 * - options (object, optional): { project_id, project_name, workspace_root, process_objects, process_registry, config_file }
 *
 * section: example
 * const proj_cfg = new ProjectSdlcConfig({ project_id: 'thing-next' });
 * proj_cfg.configure_process('develop-feature', { remove_stages: ['retro'], max_workers: 4 });
 * const effective = proj_cfg.resolve_effective_process('develop-feature');
 * =========================================================================
 */
export class ProjectSdlcConfig {
  level = 'project_sdlc_config';

  constructor(options = {}) {
    this.process_objects = options.process_objects || new SdlcProcessObjects(options);
    this.process_registry = options.process_registry || new SdlcProcessRegistry({
      ...options,
      process_objects: this.process_objects
    });

    const workspace_root = options.workspace_root || options.base_dir || process.cwd();
    const default_config_file = path.join(workspace_root, '.sdlc', 'project-sdlc-config.json');
    this.config_file = options.config_file !== undefined ? options.config_file : default_config_file;

    this.state = {
      project_id: options.project_id || options.project_name || 'sdlc-project-default',
      project_name: options.project_name || options.project_id || 'sdlc-project-default',
      default_process_id: options.default_process_id || 'develop-feature',
      disabled_processes: Array.isArray(options.disabled_processes) ? options.disabled_processes.slice() : [],
      process_overrides: clone_deep(options.process_overrides || {}),
      gate_policies: {
        gate_1_planning: { enabled: true, auto_advance: true },
        gate_2_implementation: { enabled: true, auto_advance: true, mutation_score_threshold: 80 },
        gate_3_qa_security: { enabled: true, auto_advance: true },
        gate_4_release: { enabled: true, auto_advance: true },
        gate_ingest: { enabled: true, auto_advance: true },
        ...(clone_deep(options.gate_policies || {}))
      },
      worker_pool_config: {
        route_all_requests_through_pool: options.route_all_requests_through_pool !== false,
        default_background_mode: Boolean(options.default_background_mode),
        role_counts: {
          'product-manager': 1,
          'system-architect': 1,
          'software-engineer': 2,
          'security-engineer': 1,
          'qa-engineer': 1,
          'devops-engineer': 1,
          ...(options.role_counts || {})
        },
        ...(clone_deep(options.worker_pool_config || {}))
      },
      chat_config: {
        default_agent: 'product-manager',
        default_controller_mode: 'discovery',
        delegate_requests_to_worker_pool: true,
        ...(clone_deep(options.chat_config || {}))
      }
    };

    if (options.auto_load === true && this.config_file && fs.existsSync(this.config_file)) {
      try {
        const loaded = JSON.parse(fs.readFileSync(this.config_file, 'utf-8'));
        if (loaded && typeof loaded === 'object') {
          Object.assign(this.state, loaded);
        }
      } catch (_err) {
        // ignore malformed file
      }
    }

  }

  get_process_objects() {
    return this.process_objects;
  }

  get_process_registry() {
    return this.process_registry;
  }

  get_config() {
    return clone_deep(this.state);
  }

  update_config(patch = {}) {
    if (patch.project_id !== undefined) this.state.project_id = patch.project_id;
    if (patch.project_name !== undefined) this.state.project_name = patch.project_name;
    if (patch.default_process_id !== undefined) this.state.default_process_id = patch.default_process_id;
    if (Array.isArray(patch.disabled_processes)) this.state.disabled_processes = patch.disabled_processes.slice();
    if (patch.gate_policies && typeof patch.gate_policies === 'object') {
      this.state.gate_policies = {
        ...state.gate_policies,
        ...clone_deep(patch.gate_policies)
      };
    }
    if (patch.worker_pool_config && typeof patch.worker_pool_config === 'object') {
      this.state.worker_pool_config = {
        ...state.worker_pool_config,
        ...clone_deep(patch.worker_pool_config),
        role_counts: {
          ...state.worker_pool_config.role_counts,
          ...(patch.worker_pool_config.role_counts || {})
        }
      };
    }
    if (patch.chat_config && typeof patch.chat_config === 'object') {
      this.state.chat_config = {
        ...state.chat_config,
        ...clone_deep(patch.chat_config)
      };
    }
    return this.get_config();
  }

  enable_process(process_id) {
    this.state.disabled_processes = this.state.disabled_processes.filter((id) => id !== process_id);
    return true;
  }

  disable_process(process_id) {
    if (!this.state.disabled_processes.includes(process_id)) {
      this.state.disabled_processes.push(process_id);
    }
    return true;
  }

  is_process_enabled(process_id) {
    return !this.state.disabled_processes.includes(process_id);
  }

  configure_process(process_id, override_spec = {}) {
    const existing = this.state.process_overrides[process_id] || {};
    this.state.process_overrides[process_id] = {
      ...existing,
      ...clone_deep(override_spec)
    };
    return clone_deep(this.state.process_overrides[process_id]);
  }

  reset_process_override(process_id) {
    delete this.state.process_overrides[process_id];
    return true;
  }

  get_process_override(process_id) {
    return this.state.process_overrides[process_id]
      ? clone_deep(this.state.process_overrides[process_id])
      : null;
  }

  set_gate_policy(gate_id, policy = {}) {
    this.state.gate_policies[gate_id] = {
      ...(this.state.gate_policies[gate_id] || { enabled: true, auto_advance: true }),
      ...clone_deep(policy)
    };
    return clone_deep(this.state.gate_policies[gate_id]);
  }

  get_gate_policy(gate_id) {
    return this.state.gate_policies[gate_id] ? clone_deep(this.state.gate_policies[gate_id]) : null;
  }

  set_worker_pool_config(patch = {}) {
    this.state.worker_pool_config = {
      ...state.worker_pool_config,
      ...clone_deep(patch),
      role_counts: {
        ...state.worker_pool_config.role_counts,
        ...(patch.role_counts || {})
      }
    };
    return clone_deep(this.state.worker_pool_config);
  }

  get_worker_pool_config() {
    return clone_deep(this.state.worker_pool_config);
  }

  resolve_effective_process(process_id) {
    const target_id = process_id || this.state.default_process_id || 'develop-feature';
    if (!this.is_process_enabled(target_id)) {
      throw new Error(`process_disabled_in_project: process '${target_id}' is disabled in project '${this.state.project_id}'`);
    }
    const base_def = this.process_registry.get_definition(target_id);
    if (!base_def) {
      return null;
    }

    const working_def = base_def.clone(target_id);
    const override = this.state.process_overrides[target_id];
    if (override && typeof override === 'object') {
      working_def.update_metadata(override);
      if (Array.isArray(override.remove_stages)) {
        for (let i = 0; i < override.remove_stages.length; i += 1) {
          working_def.remove_stage(override.remove_stages[i]);
        }
      }
      if (Array.isArray(override.add_stages)) {
        for (let i = 0; i < override.add_stages.length; i += 1) {
          const st = override.add_stages[i];
          if (st.after_suffix) {
            working_def.insert_stage_after(st.after_suffix, st);
          } else {
            working_def.add_stage(st);
          }
        }
      }
      if (override.stage_patches && typeof override.stage_patches === 'object') {
        for (const [sfx, st_patch] of Object.entries(override.stage_patches)) {
          if (working_def.get_stage(sfx)) {
            working_def.update_stage(sfx, st_patch);
          }
        }
      }
    }

    const profile = working_def.get_profile();
    return {
      ...profile,
      project_id: this.state.project_id,
      concurrency_mode: override?.concurrency_mode || profile.concurrency_mode || undefined,
      max_workers: override?.max_workers || profile.max_workers || undefined,
      gate_policies: clone_deep(this.state.gate_policies),
      validation: working_def.validate(this.process_objects)
    };
  }

  list_effective_processes(domain = null) {
    const defs = this.process_registry.list_definitions(domain);
    const list = [];
    for (let i = 0; i < defs.length; i += 1) {
      const id = defs[i].get_id();
      if (this.is_process_enabled(id)) {
        list.push(this.resolve_effective_process(id));
      }
    }
    return list;
  }

  save(target_path = this.config_file) {
    if (!target_path) {
      throw new Error('missing_config_path: target_path is required to save project sdlc config');
    }
    const dir = path.dirname(target_path);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(target_path, JSON.stringify(this.state, null, 2), 'utf-8');
    return target_path;
  }

  load(source_path = this.config_file) {
    if (!source_path || !fs.existsSync(source_path)) {
      throw new Error(`project_config_not_found: '${source_path}'`);
    }
    const parsed = JSON.parse(fs.readFileSync(source_path, 'utf-8'));
    this.update_config(parsed);
    if (parsed.process_overrides) {
      this.state.process_overrides = clone_deep(parsed.process_overrides);
    }
    return this.get_config();
  }
}

/**
 * function: create_project_sdlc_config
 * tldr: convenience constructor returning a new ProjectSdlcConfig
 */
export function create_project_sdlc_config(options = {}) {
  return new ProjectSdlcConfig(options);
}
