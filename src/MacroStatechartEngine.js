/**
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: genuine xstate v5 sovereign project and work-item statechart governance engine
 * verbose: implements deterministic xstate v5 state machines governing both the sovereign
 * project lifecycle (inception, active development, maintenance, deprecation, retirement)
 * and tactical work-item pathways (feature, fix, hotfix, refactor, security patch, dep upgrade).
 * 
 * section: arguments
 * - options (object, optional): configuration options including initial_phase, project_state, session_id
 * 
 * section: return value
 * - statechart (object): macro statechart governance engine instance powered by xstate v5 actors
 * 
 * section: example
 * import { create_macro_statechart } from './MacroStatechartEngine.js';
 * const statechart = create_macro_statechart({ project_state: 'active_development' });
 * const item = statechart.start_work_item({ type: 'feature', name: 'user-auth' });
 */

import { createMachine, createActor, assign } from 'xstate';

/**
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: canonical xstate v5 macro statechart machine definition schema
 * verbose: configuration object describing 10 sequential agile lifecycle phases, review gates, and invariants.
 * 
 * section: arguments
 * - initial_phase (string, optional): starting phase identifier
 * 
 * section: return value
 * - config (object): xstate v5 machine configuration schema
 * 
 * section: example
 * import { get_macro_machine_config } from './MacroStatechartEngine.js';
 * const config = get_macro_machine_config('phase_00_inception');
 */
export function get_macro_machine_config(initial_phase = 'phase_00_inception') {
  return {
    id: 'sdlc-macro-lifecycle',
    initial: initial_phase,
    context: {
      active_gate: null,
      history: [initial_phase]
    },
    states: {
      phase_00_inception: {
        on: {
          phase_01_specifications: { target: 'phase_01_specifications' },
          TRANSITION: {
            guard: ({ event }) => event.target_phase === 'phase_01_specifications',
            target: 'phase_01_specifications'
          }
        }
      },
      phase_01_specifications: {
        on: {
          phase_02_architecture: { target: 'phase_02_architecture' },
          TRANSITION: {
            guard: ({ event }) => event.target_phase === 'phase_02_architecture',
            target: 'phase_02_architecture'
          }
        }
      },
      phase_02_architecture: {
        on: {
          gate_1_evaluating: { target: 'gate_1_evaluating' },
          TRANSITION: {
            guard: ({ event }) => event.target_phase === 'gate_1_evaluating',
            target: 'gate_1_evaluating'
          }
        }
      },
      gate_1_evaluating: {
        entry: assign({ active_gate: 'gate_1' }),
        on: {
          phase_03_tdd_red: { target: 'phase_03_tdd_red' },
          gate_blocked: { target: 'gate_blocked' },
          TRANSITION: {
            guard: ({ event }) => ['phase_03_tdd_red', 'gate_blocked'].includes(event.target_phase),
            target: 'phase_03_tdd_red'
          }
        }
      },
      phase_03_tdd_red: {
        entry: assign({ active_gate: null }),
        on: {
          phase_04_tdd_green: { target: 'phase_04_tdd_green' },
          TRANSITION: {
            guard: ({ event }) => event.target_phase === 'phase_04_tdd_green',
            target: 'phase_04_tdd_green'
          }
        }
      },
      phase_04_tdd_green: {
        on: {
          phase_05_refactor: { target: 'phase_05_refactor' },
          TRANSITION: {
            guard: ({ event }) => event.target_phase === 'phase_05_refactor',
            target: 'phase_05_refactor'
          }
        }
      },
      phase_05_refactor: {
        on: {
          gate_2_evaluating: { target: 'gate_2_evaluating' },
          TRANSITION: {
            guard: ({ event }) => event.target_phase === 'gate_2_evaluating',
            target: 'gate_2_evaluating'
          }
        }
      },
      gate_2_evaluating: {
        entry: assign({ active_gate: 'gate_2' }),
        on: {
          phase_06_security_review: { target: 'phase_06_security_review' },
          gate_blocked: { target: 'gate_blocked' },
          TRANSITION: {
            guard: ({ event }) => ['phase_06_security_review', 'gate_blocked'].includes(event.target_phase),
            target: 'phase_06_security_review'
          }
        }
      },
      phase_06_security_review: {
        entry: assign({ active_gate: null }),
        on: {
          phase_07_qa_verification: { target: 'phase_07_qa_verification' },
          TRANSITION: {
            guard: ({ event }) => event.target_phase === 'phase_07_qa_verification',
            target: 'phase_07_qa_verification'
          }
        }
      },
      phase_07_qa_verification: {
        on: {
          gate_3_evaluating: { target: 'gate_3_evaluating' },
          TRANSITION: {
            guard: ({ event }) => event.target_phase === 'gate_3_evaluating',
            target: 'gate_3_evaluating'
          }
        }
      },
      gate_3_evaluating: {
        entry: assign({ active_gate: 'gate_3' }),
        on: {
          phase_08_release: { target: 'phase_08_release' },
          gate_blocked: { target: 'gate_blocked' },
          TRANSITION: {
            guard: ({ event }) => ['phase_08_release', 'gate_blocked'].includes(event.target_phase),
            target: 'phase_08_release'
          }
        }
      },
      phase_08_release: {
        entry: assign({ active_gate: null }),
        on: {
          gate_4_evaluating: { target: 'gate_4_evaluating' },
          TRANSITION: {
            guard: ({ event }) => event.target_phase === 'gate_4_evaluating',
            target: 'gate_4_evaluating'
          }
        }
      },
      gate_4_evaluating: {
        entry: assign({ active_gate: 'gate_4' }),
        on: {
          phase_09_continuous_learning: { target: 'phase_09_continuous_learning' },
          gate_blocked: { target: 'gate_blocked' },
          TRANSITION: {
            guard: ({ event }) => ['phase_09_continuous_learning', 'gate_blocked'].includes(event.target_phase),
            target: 'phase_09_continuous_learning'
          }
        }
      },
      phase_09_continuous_learning: {
        entry: assign({ active_gate: null }),
        on: {
          idle: { target: 'idle' },
          phase_01_specifications: { target: 'phase_01_specifications' },
          TRANSITION: [
            {
              guard: ({ event }) => event.target_phase === 'idle',
              target: 'idle'
            },
            {
              guard: ({ event }) => event.target_phase === 'phase_01_specifications',
              target: 'phase_01_specifications'
            }
          ]
        }
      },
      gate_blocked: {},
      idle: {
        on: {
          phase_00_inception: { target: 'phase_00_inception' },
          phase_01_specifications: { target: 'phase_01_specifications' },
          TRANSITION: [
            {
              guard: ({ event }) => event.target_phase === 'phase_00_inception',
              target: 'phase_00_inception'
            },
            {
              guard: ({ event }) => event.target_phase === 'phase_01_specifications',
              target: 'phase_01_specifications'
            }
          ]
        }
      }
    }
  };
}

/**
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: sovereign project lifecycle machine definition schema
 * verbose: models high-level project states: inception, active development, maintenance, deprecation, retirement.
 * 
 * section: arguments
 * - initial_state (string, optional): starting sovereign state, defaults to 'active_development'
 * 
 * section: return value
 * - config (object): xstate v5 sovereign project machine schema
 * 
 * section: example
 * const config = get_sovereign_project_config('uninitialised');
 */
export function get_sovereign_project_config(initial_state = 'active_development') {
  return {
    id: 'project-sovereign-lifecycle',
    initial: initial_state,
    context: {
      project_name: null,
      charter: null,
      history: [initial_state]
    },
    states: {
      uninitialised: {
        on: {
          INITIATE_PROJECT: { target: 'project_inception' }
        }
      },
      project_inception: {
        on: {
          GATE_0_PASSED: { target: 'active_development' }
        }
      },
      active_development: {
        on: {
          ENTER_MAINTENANCE: { target: 'maintenance_mode' },
          DEPRECATE_PROJECT: { target: 'deprecation' }
        }
      },
      maintenance_mode: {
        on: {
          REACTIVATE: { target: 'active_development' },
          DEPRECATE_PROJECT: { target: 'deprecation' }
        }
      },
      deprecation: {
        on: {
          COMMENCE_RETIREMENT: { target: 'project_retirement' }
        }
      },
      project_retirement: {
        on: {
          GATE_RETIREMENT_PASSED: { target: 'archived' }
        }
      },
      archived: {
        type: 'final'
      }
    }
  };
}

/**
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: tactical work-item state machine definition schema
 * verbose: compiles deterministic statecharts for feature, fix, hotfix, refactor, and security patch pathways.
 * 
 * section: arguments
 * - item_type (string): work-item type identifier (feature, fix, hotfix, refactor, security_patch, etc.)
 * 
 * section: return value
 * - config (object): xstate v5 work-item machine configuration
 * 
 * section: example
 * const config = get_work_item_machine_config('fix');
 */
export function get_work_item_machine_config(item_type = 'feature') {
  if (item_type === 'fix') {
    return {
      id: 'fix-lifecycle',
      initial: 'defect_intake',
      states: {
        defect_intake: { on: { NEXT: { target: 'reproduction_test' } } },
        reproduction_test: { on: { NEXT: { target: 'patch_implementation' } } },
        patch_implementation: { on: { NEXT: { target: 'regression_suite' } } },
        regression_suite: { on: { NEXT: { target: 'gate_2_evaluating' } } },
        gate_2_evaluating: { on: { GATE_PASSED: { target: 'release' } } },
        release: { on: { NEXT: { target: 'completed' } } },
        completed: { type: 'final' }
      }
    };
  }

  if (item_type === 'hotfix') {
    return {
      id: 'hotfix-lifecycle',
      initial: 'incident_triage',
      states: {
        incident_triage: { on: { NEXT: { target: 'reproduction' } } },
        reproduction: { on: { NEXT: { target: 'emergency_patch' } } },
        emergency_patch: { on: { NEXT: { target: 'smoke_test' } } },
        smoke_test: { on: { NEXT: { target: 'emergency_gate' } } },
        emergency_gate: { on: { GATE_PASSED: { target: 'release' } } },
        release: { on: { NEXT: { target: 'mandatory_post_mortem' } } },
        mandatory_post_mortem: { on: { NEXT: { target: 'completed' } } },
        completed: { type: 'final' }
      }
    };
  }

  if (item_type === 'refactor') {
    return {
      id: 'refactor-lifecycle',
      initial: 'baseline_audit',
      states: {
        baseline_audit: { on: { NEXT: { target: 'immutability_lock' } } },
        immutability_lock: { on: { NEXT: { target: 'transformation' } } },
        transformation: { on: { NEXT: { target: 'verification' } } },
        verification: { on: { NEXT: { target: 'metrics_check' } } },
        metrics_check: { on: { NEXT: { target: 'gate_2_evaluating' } } },
        gate_2_evaluating: { on: { GATE_PASSED: { target: 'completed' } } },
        completed: { type: 'final' }
      }
    };
  }

  if (item_type === 'security_patch') {
    return {
      id: 'security-patch-lifecycle',
      initial: 'vulnerability_analysis',
      states: {
        vulnerability_analysis: { on: { NEXT: { target: 'cve_reproduction' } } },
        cve_reproduction: { on: { NEXT: { target: 'patch' } } },
        patch: { on: { NEXT: { target: 'security_scan' } } },
        security_scan: { on: { NEXT: { target: 'gate_3_evaluating' } } },
        gate_3_evaluating: { on: { GATE_PASSED: { target: 'release' } } },
        release: { on: { NEXT: { target: 'completed' } } },
        completed: { type: 'final' }
      }
    };
  }

  if (item_type === 'dependency_upgrade') {
    return {
      id: 'dependency-upgrade-lifecycle',
      initial: 'dependency_scan',
      states: {
        dependency_scan: { on: { NEXT: { target: 'version_bump' } } },
        version_bump: { on: { NEXT: { target: 'compatibility_test' } } },
        compatibility_test: { on: { NEXT: { target: 'gate_2_evaluating' } } },
        gate_2_evaluating: { on: { GATE_PASSED: { target: 'release' } } },
        release: { on: { NEXT: { target: 'completed' } } },
        completed: { type: 'final' }
      }
    };
  }

  if (item_type === 'ingest') {
    return {
      id: 'ingest-lifecycle',
      initial: 'discovery',
      states: {
        discovery: { on: { NEXT: { target: 'audit' } } },
        audit: { on: { NEXT: { target: 'baseline_lock' } } },
        baseline_lock: { on: { NEXT: { target: 'gate_ingest_evaluating' } } },
        gate_ingest_evaluating: { on: { GATE_PASSED: { target: 'completed' } } },
        completed: { type: 'final' }
      }
    };
  }

  if (item_type === 'doc_sync') {
    return get_doc_store_sync_machine_config('scanning_filesystem');
  }

  // default: full 10-phase feature lifecycle
  return {
    id: 'feature-lifecycle',
    initial: 'inception',
    states: {
      inception: { on: { NEXT: { target: 'specification' } } },
      specification: { on: { NEXT: { target: 'architecture' } } },
      architecture: { on: { NEXT: { target: 'gate_1_evaluating' } } },
      gate_1_evaluating: { on: { GATE_PASSED: { target: 'tdd_red' } } },
      tdd_red: { on: { NEXT: { target: 'tdd_green' } } },
      tdd_green: { on: { NEXT: { target: 'refactor' } } },
      refactor: { on: { NEXT: { target: 'gate_2_evaluating' } } },
      gate_2_evaluating: { on: { GATE_PASSED: { target: 'security_qa' } } },
      security_qa: { on: { NEXT: { target: 'gate_3_evaluating' } } },
      gate_3_evaluating: { on: { GATE_PASSED: { target: 'release' } } },
      release: { on: { NEXT: { target: 'gate_4_evaluating' } } },
      gate_4_evaluating: { on: { GATE_PASSED: { target: 'continuous_learning' } } },
      continuous_learning: { on: { NEXT: { target: 'completed' } } },
      completed: { type: 'final' }
    }
  };
}

/**
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: creates a compiled xstate v5 state machine instance
 * verbose: compiles the sdlc macro lifecycle machine using xstate createMachine.
 * 
 * section: arguments
 * - options (object, optional): configuration options
 * 
 * section: return value
 * - machine (StateMachine): compiled xstate v5 state machine
 * 
 * section: example
 * const machine = create_sdlc_macro_machine();
 */
export function create_sdlc_macro_machine(options = {}) {
  const initial = options.initial_phase || 'phase_00_inception';
  return createMachine(get_macro_machine_config(initial));
}

/**
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: creates a deterministic macro statechart for sdlc lifecycle governance powered by xstate v5
 * verbose: governs sovereign project states, tactical work-item pathways, and reviews gates.
 * 
 * section: arguments
 * - options (object, optional): configuration options
 * 
 * section: return value
 * - statechart (object): macro statechart instance
 * 
 * section: example
 * const statechart = create_macro_statechart();
 * const phase = statechart.get_phase();
 */
export function create_macro_statechart(options = {}) {
  const initial_phase = options.initial_phase || 'phase_00_inception';
  const initial_project_state = options.project_state || 'active_development';
  const logger = options.logger || null;

  const legacy_machine = create_sdlc_macro_machine(options);
  const legacy_actor = createActor(legacy_machine).start();

  const sovereign_machine = createMachine(get_sovereign_project_config(initial_project_state));
  const sovereign_actor = createActor(sovereign_machine).start();

  const work_item_entries = [];
  let focused_work_item_name = null;

  function find_work_item_entry(name) {
    if (!name) return null;
    for (let i = 0; i < work_item_entries.length; i += 1) {
      if (work_item_entries[i].name === name) {
        return work_item_entries[i];
      }
    }
    return null;
  }

  function upsert_work_item_entry(spec) {
    const item_type = spec.type || 'feature';
    const item_name = spec.name || 'unnamed-work-item';
    const raw_config = get_work_item_machine_config(item_type);
    const machine_config = spec.phase
      ? { ...raw_config, initial: spec.phase }
      : raw_config;
    const machine = createMachine(machine_config);
    const actor = createActor(machine).start();
    const now = Date.now();

    const existing = find_work_item_entry(item_name);
    if (existing) {
      existing.type = item_type;
      existing.actor = actor;
      existing.payload = spec.payload || existing.payload || {};
      existing.updated_at = now;
      return existing;
    }

    const entry = {
      name: item_name,
      type: item_type,
      actor,
      payload: spec.payload || {},
      started_at: spec.started_at || now,
      updated_at: spec.updated_at || now
    };
    work_item_entries.push(entry);
    return entry;
  }

  function get_focused_entry() {
    const by_name = find_work_item_entry(focused_work_item_name);
    if (by_name) return by_name;
    if (work_item_entries.length > 0) {
      return work_item_entries[work_item_entries.length - 1];
    }
    return null;
  }

  if (Array.isArray(options.work_items)) {
    for (let i = 0; i < options.work_items.length; i += 1) {
      const wi = options.work_items[i];
      if (wi && wi.type && wi.name) {
        const entry = upsert_work_item_entry(wi);
        if (wi.focused) {
          focused_work_item_name = entry.name;
        }
      }
    }
  }

  if (options.active_work_item && options.active_work_item.type) {
    const entry = upsert_work_item_entry({
      ...options.active_work_item,
      name: options.active_work_item.name || 'unnamed-work-item'
    });
    focused_work_item_name = entry.name;
  } else if (!focused_work_item_name && work_item_entries.length > 0) {
    focused_work_item_name = work_item_entries[work_item_entries.length - 1].name;
  }

  const history = [initial_phase];

  if (logger) {
    logger.info({
      event: 'statechart:initialised',
      initial_phase,
      project_state: sovereign_actor.getSnapshot().value
    });
  }

  return {
    get_phase() {
      const focused = get_focused_entry();
      if (focused && focused.actor) {
        const item_val = focused.actor.getSnapshot().value;
        if (item_val !== 'completed') {
          return item_val;
        }
      }
      return legacy_actor.getSnapshot().value;
    },

    get_macro_phase() {
      return legacy_actor.getSnapshot().value;
    },

    get_project_state() {
      return sovereign_actor.getSnapshot().value;
    },

    get_active_work_item() {
      const focused = get_focused_entry();
      if (!focused || !focused.actor) {
        return null;
      }
      const phase = focused.actor.getSnapshot().value;
      return {
        type: focused.type,
        name: focused.name,
        phase,
        status: phase === 'completed' ? 'completed' : 'active',
        payload: focused.payload || {}
      };
    },

    get_work_item(name = null) {
      const entry = name ? find_work_item_entry(name) : get_focused_entry();
      if (!entry || !entry.actor) {
        return null;
      }
      const phase = entry.actor.getSnapshot().value;
      return {
        type: entry.type,
        name: entry.name,
        phase,
        status: phase === 'completed' ? 'completed' : 'active',
        focused: entry.name === focused_work_item_name,
        payload: entry.payload || {},
        started_at: entry.started_at,
        updated_at: entry.updated_at
      };
    },

    list_work_items(filter = {}) {
      const result = [];
      for (let i = 0; i < work_item_entries.length; i += 1) {
        const entry = work_item_entries[i];
        const phase = entry.actor.getSnapshot().value;
        const status = phase === 'completed' ? 'completed' : 'active';
        if (filter.type && entry.type !== filter.type) {
          continue;
        }
        if (filter.status && status !== filter.status) {
          continue;
        }
        result.push({
          name: entry.name,
          type: entry.type,
          phase,
          status,
          focused: entry.name === focused_work_item_name,
          payload: entry.payload || {},
          started_at: entry.started_at,
          updated_at: entry.updated_at
        });
      }
      return result;
    },

    switch_work_item(name) {
      const entry = find_work_item_entry(name);
      if (!entry) {
        throw new Error(`work_item_not_found: no work item registered with name '${name}'`);
      }
      focused_work_item_name = entry.name;
      if (logger) {
        logger.info({
          event: 'work_item:switched',
          name: entry.name,
          type: entry.type,
          phase: entry.actor.getSnapshot().value
        });
      }
      return this.get_work_item(entry.name);
    },

    focus_work_item(name) {
      return this.switch_work_item(name);
    },

    get_gate() {
      const current = this.get_phase();
      if (typeof current === 'string' && current.startsWith('gate_') && current.endsWith('_evaluating')) {
        return current.replace('_evaluating', '');
      }
      return null;
    },

    get_history() {
      return history.slice();
    },

    get_actor() {
      return legacy_actor;
    },

    get_machine() {
      return legacy_machine;
    },

    start_project(params = {}) {
      if (sovereign_actor.getSnapshot().value !== 'uninitialised') {
        throw new Error(`invalid_project_state: project already initialised in ${sovereign_actor.getSnapshot().value}`);
      }
      sovereign_actor.send({ type: 'INITIATE_PROJECT' });
      const current = sovereign_actor.getSnapshot().value;
      if (logger) {
        logger.info({ event: 'project:initiated', project_name: params.project_name, state: current });
      }
      return current;
    },

    approve_inception(params = {}) {
      if (sovereign_actor.getSnapshot().value !== 'project_inception') {
        throw new Error(`invalid_project_state: project not in project_inception (currently '${sovereign_actor.getSnapshot().value}')`);
      }
      sovereign_actor.send({ type: 'GATE_0_PASSED' });
      const current = sovereign_actor.getSnapshot().value;
      if (logger) {
        logger.info({ event: 'project:inception_approved', state: current });
      }
      return current;
    },

    enter_maintenance(reason = 'routine maintenance') {
      sovereign_actor.send({ type: 'ENTER_MAINTENANCE' });
      const current = sovereign_actor.getSnapshot().value;
      if (logger) {
        logger.info({ event: 'project:maintenance_entered', reason, state: current });
      }
      return current;
    },

    reactivate_project() {
      if (sovereign_actor.getSnapshot().value !== 'maintenance_mode') {
        throw new Error(`invalid_project_state: project not in maintenance_mode (currently '${sovereign_actor.getSnapshot().value}')`);
      }
      sovereign_actor.send({ type: 'REACTIVATE' });
      const current = sovereign_actor.getSnapshot().value;
      if (logger) {
        logger.info({ event: 'project:reactivated', state: current });
      }
      return current;
    },

    deprecate_project(params = {}) {
      sovereign_actor.send({ type: 'DEPRECATE_PROJECT' });
      const current = sovereign_actor.getSnapshot().value;
      if (logger) {
        logger.info({ event: 'project:deprecated', sunset_date: params.sunset_date, state: current });
      }
      return current;
    },

    commence_retirement(params = {}) {
      sovereign_actor.send({ type: 'COMMENCE_RETIREMENT' });
      const current = sovereign_actor.getSnapshot().value;
      if (logger) {
        logger.info({ event: 'project:retirement_commenced', reason: params.reason, state: current });
      }
      return current;
    },

    complete_retirement(params = {}) {
      if (sovereign_actor.getSnapshot().value !== 'project_retirement') {
        throw new Error(`invalid_project_state: project not in project_retirement (currently '${sovereign_actor.getSnapshot().value}')`);
      }
      sovereign_actor.send({ type: 'GATE_RETIREMENT_PASSED' });
      const current = sovereign_actor.getSnapshot().value;
      if (logger) {
        logger.info({ event: 'project:retired_and_archived', state: current });
      }
      return current;
    },

    start_work_item(params = {}) {
      const sovereign_state = sovereign_actor.getSnapshot().value;
      const item_type = params.type || 'feature';
      const item_name = params.name || 'unnamed-work-item';

      if (['archived', 'project_retirement'].includes(sovereign_state)) {
        throw new Error(`project_retired: cannot start work item in terminal state '${sovereign_state}'`);
      }

      if (sovereign_state === 'maintenance_mode' && item_type === 'feature') {
        throw new Error('maintenance_mode_active: new features are blocked in maintenance mode');
      }

      const entry = upsert_work_item_entry({
        type: item_type,
        name: item_name,
        phase: params.initial_phase || null,
        payload: params.payload || {}
      });

      if (params.focus !== false) {
        focused_work_item_name = entry.name;
      }

      const initial_step = entry.actor.getSnapshot().value;
      history.push(`${item_type}:${initial_step}`);

      if (logger) {
        logger.info({
          event: 'work_item:started',
          type: item_type,
          name: item_name,
          initial_phase: initial_step,
          focused: focused_work_item_name === item_name
        });
      }

      return {
        type: item_type,
        name: item_name,
        phase: initial_step
      };
    },

    advance_work_item(event = { type: 'NEXT' }, target_name = null) {
      const resolved_name = target_name || event?.work_item || event?.epic_id || null;
      const entry = resolved_name ? find_work_item_entry(resolved_name) : get_focused_entry();
      if (!entry || !entry.actor) {
        throw new Error('no_active_work_item: cannot advance without an active work item');
      }

      const before = entry.actor.getSnapshot().value;
      entry.actor.send(event);
      const after = entry.actor.getSnapshot().value;

      if (before === after && event.type !== 'GATE_PASSED') {
        throw new Error(`invalid_work_item_transition: cannot advance from '${before}' with event '${event.type}'`);
      }

      entry.updated_at = Date.now();
      history.push(`${entry.type}:${after}`);

      if (logger) {
        logger.info({
          event: 'work_item:advanced',
          name: entry.name,
          from: before,
          to: after,
          type: entry.type
        });
      }

      return after;
    },

    transition(event) {
      const target = event?.target_phase;
      const current_phase = legacy_actor.getSnapshot().value;

      if (logger) {
        logger.debug({
          event: 'statechart:transition:request',
          from: current_phase,
          target
        });
      }

      legacy_actor.send({
        type: 'TRANSITION',
        target_phase: target
      });

      const next_phase = legacy_actor.getSnapshot().value;
      if (next_phase === current_phase && target !== current_phase) {
        if (logger) {
          logger.warn({
            event: 'statechart:transition:rejected',
            from: current_phase,
            target,
            reason: 'invalid_phase_transition'
          });
        }
        throw new Error(`invalid_phase_transition: cannot transition from ${current_phase} to ${target}`);
      }

      if (logger) {
        logger.info({
          event: 'statechart:transition:success',
          from: current_phase,
          to: next_phase,
          active_gate: typeof next_phase === 'string' && next_phase.startsWith('gate_')
            ? next_phase.replace('_evaluating', '')
            : null
        });
      }

      history.push(next_phase);
      return next_phase;
    }
  };
}

/**
 * section: version number
 * version: 0.1.0
 *
 * section: documentation
 * tldr: xstate v5 machine configuration for bidirectional .sdlc/store and docs/ filesystem synchronisation
 * verbose: defines the deterministic 7-state synchronisation statechart (idle -> scanning_filesystem ->
 * migrating_to_store -> exporting_to_filesystem -> reindexing_rag_and_knowledge -> verifying_sync_gate ->
 * completed / sync_blocked) governing reconciliation between .sdlc/store/ entities and docs/ markdown.
 *
 * section: arguments
 * - initial_state (string, optional): starting state (defaults to 'idle')
 *
 * section: return value
 * - config (object): xstate v5 state machine definition
 *
 * section: example
 * const cfg = get_doc_store_sync_machine_config();
 */
export function get_doc_store_sync_machine_config(initial_state = 'idle') {
  return {
    id: 'doc-store-sync-lifecycle',
    initial: initial_state,
    context: {
      direction: 'bidirectional',
      migrated_count: 0,
      exported_count: 0,
      rag_chunks_indexed: 0,
      knowledge_nodes_synced: 0
    },
    states: {
      idle: {
        on: {
          START_SYNC: { target: 'scanning_filesystem' },
          NEXT: { target: 'scanning_filesystem' }
        }
      },
      scanning_filesystem: {
        on: {
          SCAN_COMPLETE: { target: 'migrating_to_store' },
          SKIP_TO_EXPORT: { target: 'exporting_to_filesystem' },
          NEXT: { target: 'migrating_to_store' }
        }
      },
      migrating_to_store: {
        on: {
          MIGRATE_COMPLETE: { target: 'exporting_to_filesystem' },
          SKIP_EXPORT: { target: 'reindexing_rag_and_knowledge' },
          NEXT: { target: 'exporting_to_filesystem' }
        }
      },
      exporting_to_filesystem: {
        on: {
          EXPORT_COMPLETE: { target: 'reindexing_rag_and_knowledge' },
          NEXT: { target: 'reindexing_rag_and_knowledge' }
        }
      },
      reindexing_rag_and_knowledge: {
        on: {
          REINDEX_COMPLETE: { target: 'verifying_sync_gate' },
          NEXT: { target: 'verifying_sync_gate' }
        }
      },
      verifying_sync_gate: {
        on: {
          GATE_PASSED: { target: 'completed' },
          SYNC_VERIFIED: { target: 'completed' },
          SYNC_FAILED: { target: 'sync_blocked' },
          NEXT: { target: 'completed' }
        }
      },
      sync_blocked: {
        on: {
          RETRY_SYNC: { target: 'scanning_filesystem' }
        }
      },
      completed: {
        type: 'final'
      }
    }
  };
}

/**
 * section: version number
 * version: 0.1.0
 *
 * section: documentation
 * tldr: creates an xstate v5 actor governing bidirectional .sdlc/store and filesystem docs/ synchronisation
 * verbose: instantiates and starts the doc-store-sync-lifecycle xstate v5 actor, tracking every state
 * transition in trace history while executing migration, markdown export, hybrid rag re-indexing,
 * and knowledge graph synchronisation.
 *
 * section: arguments
 * - options (object, optional): { initial_state }
 *
 * section: return value
 * - sync_statechart (object): { id, actor, get_state, get_trace, send, run_sync }
 *
 * section: example
 * const sync_chart = create_doc_store_sync_statechart();
 * const report = await sync_chart.run_sync({ store, docs_dir, migrate_fn });
 */
export function create_doc_store_sync_statechart(options = {}) {
  const config = get_doc_store_sync_machine_config(options.initial_state || 'idle');
  const machine = createMachine(config);
  const actor = createActor(machine);
  actor.start();

  const trace = [actor.getSnapshot().value];

  function send(event) {
    const evt = typeof event === 'string' ? { type: event } : event;
    actor.send(evt);
    const current = actor.getSnapshot().value;
    if (trace[trace.length - 1] !== current) {
      trace.push(current);
    }
    return current;
  }

  async function run_sync(sync_params = {}) {
    const {
      store,
      docs_dir,
      migrate_fn,
      direction = 'bidirectional',
      sync_knowledge = true
    } = sync_params;

    if (!store) {
      throw new Error('missing_store: run_sync requires a DocumentEntityStore instance');
    }

    // 1. idle -> scanning_filesystem
    if (actor.getSnapshot().value === 'idle') {
      send('START_SYNC');
    }

    let migration_report = {
      prds: 0,
      stories: 0,
      adrs: 0,
      interfaces: 0,
      threat_models: 0,
      test_reports: 0,
      releases: 0,
      retrospectives: 0,
      total_migrated: 0
    };
    let export_report = {
      exported_count: 0,
      files: []
    };

    // 2. scanning_filesystem -> migrating_to_store (or skip to export)
    if (direction === 'export') {
      send('SKIP_TO_EXPORT');
    } else {
      send('SCAN_COMPLETE');
      if (typeof migrate_fn === 'function' && docs_dir) {
        migration_report = migrate_fn(docs_dir, store);
      }
      if (direction === 'import' || direction === 'migrate') {
        send('SKIP_EXPORT');
      } else {
        send('MIGRATE_COMPLETE');
      }
    }

    // 3. exporting_to_filesystem -> reindexing_rag_and_knowledge
    if (actor.getSnapshot().value === 'exporting_to_filesystem') {
      if (typeof store.export_documents === 'function' && docs_dir) {
        export_report = store.export_documents({ target_dir: docs_dir });
      }
      send('EXPORT_COMPLETE');
    }

    // 4. reindexing_rag_and_knowledge -> verifying_sync_gate
    let rag_report = { total_chunks: 0, entity_chunks: 0, markdown_chunks: 0 };
    if (typeof store.index_store_for_rag === 'function') {
      rag_report = store.index_store_for_rag({ docs_dir });
    }
    let knowledge_report = { nodes_synced: 0, notes_appended: 0 };
    if (sync_knowledge && typeof store.sync_to_knowledge === 'function') {
      try {
        const kn = await store.sync_to_knowledge();
        knowledge_report = {
          nodes_synced: kn.nodes_synced || 0,
          notes_appended: kn.notes_appended || 0
        };
      } catch (_err) {
        // ignore optional knowledge sync error
      }
    }
    send('REINDEX_COMPLETE');

    // 5. verifying_sync_gate -> completed
    send('SYNC_VERIFIED');

    return {
      ok: actor.getSnapshot().value === 'completed',
      statechart_id: config.id,
      final_state: actor.getSnapshot().value,
      direction,
      statechart_trace: trace.slice(),
      migration_report,
      export_report: {
        exported_count: export_report.exported_count || 0,
        files_count: (export_report.files || []).length
      },
      rag_report,
      knowledge_report,
      synced_at: new Date().toISOString()
    };
  }

  return {
    id: config.id,
    machine,
    actor,
    get_state() {
      return actor.getSnapshot().value;
    },
    get_trace() {
      return trace.slice();
    },
    send,
    run_sync
  };
}
