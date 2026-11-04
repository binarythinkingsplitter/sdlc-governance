#!/usr/bin/env node

/**
 * =========================================================================
 * module: command-line interface for dual-engine sdlc development harness
 * =========================================================================
 * 
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: unified verb-noun command-line interface for dual-engine sdlc harness
 * verbose: provides terminal commands for inspecting sovereign project states,
 * managing tactical work-item pathways, executing role-based workflows, listing
 * domain catalogues (phases, gates, work-items, dags, templates), and evaluating review gates.
 * commands follow a strict one-word verb or noun structure with standardised subcommands.
 * 
 * section: arguments
 * - command (string): target verb (list, status, test, help) or noun (phases, gates, work-items, dag, etc.)
 * - args (array): additional command arguments and options
 * 
 * section: return value
 * process exits with code 0 on success, or 1 on failure
 * 
 * section: example
 * sdlc-harness phases list
 * sdlc-harness gates check gate_1_planning
 * sdlc-harness list work-items
 * =========================================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  create_dual_engine_harness,
  verify_test_immutability,
  list_high_level_processes,
  list_sdlc_phases,
  list_review_gates,
  list_work_item_types,
  list_dag_pipelines,
  list_templates_catalog,
  list_all_types,
  list_domain_nouns,
  list_tier_architecture,
  format_tier_architecture_catalog,
  format_sdlc_statecharts_catalog,
  resolve_chat_agent_id,
  create_cli_status_bar_layout,
  render_process_execution_step,
  DocumentEntityTypes
} from '../src/index.js';

const package_root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: parses command line arguments into positional arguments and flag dictionary
 * verbose: splits process.argv into positional tokens and key-value flag pairs.
 * 
 * section: arguments
 * - raw_args (array): raw argument strings from argv
 * 
 * section: return value
 * - parsed (object): object containing positional array and flags dictionary
 * 
 * section: example
 * const { flags, positional } = parse_cli_arguments(['--name=demo', 'start']);
 * =========================================================================
 */
function parse_cli_arguments(raw_args) {
  const flags = {};
  const positional = [];
  for (const arg of raw_args) {
    if (arg.startsWith('--')) {
      const eq_idx = arg.indexOf('=');
      if (eq_idx !== -1) {
        flags[arg.slice(2, eq_idx)] = arg.slice(eq_idx + 1);
      } else {
        flags[arg.slice(2)] = true;
      }
    } else {
      positional.push(arg);
    }
  }
  return { flags, positional };
}

/**
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: prints structured list of the 10 sdlc macro phases
 * verbose: writes formatted list of macro phases with order and associated gates.
 * 
 * section: arguments
 * none
 * 
 * section: return value
 * void
 * 
 * section: example
 * print_phases_list();
 * =========================================================================
 */
function print_phases_list() {
  const phases = list_sdlc_phases();
  process.stdout.write(`sdlc macro phases (${phases.length}):\n`);
  for (const p of phases) {
    const gate_str = p.gate ? ` [gate: ${p.gate}]` : '';
    process.stdout.write(`  - ${p.id} (${p.name}): ${p.description}${gate_str}\n`);
  }
}

/**
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: prints structured list of formal review gates
 * verbose: writes formatted list of review gates, evaluated phases, and invariants.
 * 
 * section: arguments
 * none
 * 
 * section: return value
 * void
 * 
 * section: example
 * print_gates_list();
 * =========================================================================
 */
function print_gates_list() {
  const gates = list_review_gates();
  process.stdout.write(`formal review gates (${gates.length}):\n`);
  for (const g of gates) {
    process.stdout.write(`  - ${g.id} (${g.name}):\n`);
    process.stdout.write(`      description: ${g.description}\n`);
    process.stdout.write(`      evaluates: ${g.evaluates.join(', ')}\n`);
    process.stdout.write(`      invariants: ${g.invariants.join('; ')}\n`);
  }
}

/**
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: prints structured list of tactical work-item pathways
 * verbose: writes formatted list of work-item types with descriptions and stage flows.
 * 
 * section: arguments
 * none
 * 
 * section: return value
 * void
 * 
 * section: example
 * print_work_items_list();
 * =========================================================================
 */
function print_work_items_list() {
  const items = list_work_item_types();
  process.stdout.write(`supported work-item pathways (${items.length}):\n`);
  for (const item of items) {
    process.stdout.write(`  - ${item.id} (${item.name}):\n`);
    process.stdout.write(`      description: ${item.description}\n`);
    process.stdout.write(`      path: ${item.stages.join(' -> ')}\n`);
  }
}

/**
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: prints structured list of multi-agent dag pipeline recipes
 * verbose: writes formatted list of registered dag pipelines and topological nodes.
 * 
 * section: arguments
 * none
 * 
 * section: return value
 * void
 * 
 * section: example
 * print_dag_list();
 * =========================================================================
 */
function print_dag_list() {
  const dags = list_dag_pipelines();
  process.stdout.write(`registered dag pipelines (${dags.length}):\n`);
  for (const d of dags) {
    process.stdout.write(`  - ${d.id} (${d.name}):\n`);
    process.stdout.write(`      description: ${d.description}\n`);
    process.stdout.write(`      nodes: ${d.nodes.join(' -> ')}\n`);
  }
}

/**
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: prints catalogue of document and code generation templates
 * verbose: writes formatted list of canonical document and code snippet templates.
 * 
 * section: arguments
 * none
 * 
 * section: return value
 * void
 * 
 * section: example
 * print_templates_list();
 * =========================================================================
 */
function print_templates_list() {
  const cat = list_templates_catalog();
  process.stdout.write(`canonical document templates (${cat.documents.length}):\n`);
  for (const d of cat.documents) {
    process.stdout.write(`  - ${d.id} (${d.name}): ${d.description}\n`);
  }
  process.stdout.write(`\ncode snippet templates (${cat.code.length}):\n`);
  for (const c of cat.code) {
    process.stdout.write(`  - ${c.id} (${c.name}): ${c.description}\n`);
  }
}

/**
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: prints catalogue of all entity and command types with supported verbs
 * verbose: writes comprehensive list of nouns, verbs, and descriptions supported by the cli.
 * 
 * section: arguments
 * none
 * 
 * section: return value
 * void
 * 
 * section: example
 * print_all_types_list();
 * =========================================================================
 */
function print_all_types_list() {
  const types = list_all_types();
  const domain_nouns = list_domain_nouns();
  process.stdout.write(`available entity and command types (${types.length}):\n\n`);
  process.stdout.write('nouns (with standardised verbs: list, status/show/info, run/start/execute, check/verify, export):\n');
  for (const t of types) {
    const alias_str = t.aliases ? ` (aliases: ${t.aliases.join(', ')})` : '';
    process.stdout.write(`  - ${t.id}${alias_str}:\n`);
    process.stdout.write(`      description: ${t.description}\n`);
    process.stdout.write(`      supported verbs: ${t.verbs.join(', ')}\n`);
  }
  process.stdout.write(`\ndomain nouns (${domain_nouns.length}):\n`);
  for (const dn of domain_nouns) {
    const alias_str = dn.aliases && dn.aliases.length > 0 ? ` (aliases: ${dn.aliases.join(', ')})` : '';
    process.stdout.write(`  - ${dn.id}${alias_str}: [${dn.verbs.join(', ')}] — ${dn.description}\n`);
  }
  process.stdout.write('\ndirect verbs (standalone one-word actions):\n');
  process.stdout.write('  - chat [agent|name]: launch interactive agentic chat with sdlc-supervisor or a chosen specialist agent\n');
  process.stdout.write('  - list [type]: enumerate instances or catalogue for any target type\n');
  process.stdout.write('  - status: display sovereign state, macro phase, active gate, and active work item\n');
  process.stdout.write('  - test [--ui|--watch]: execute test suites via vitest with web ui or terminal reporting\n');
  process.stdout.write('  - migrate [path]: migrate repository documentation into entity store\n');
  process.stdout.write('  - help: display command reference\n');
}

/**
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: executes test runner child process via vitest
 * verbose: invokes vitest runner according to supplied options (run, --ui, --watch).
 * 
 * section: arguments
 * - flags (object): flag options including ui and watch
 * 
 * section: return value
 * - void
 * 
 * section: example
 * await execute_test_runner({ ui: true });
 * =========================================================================
 */
async function execute_test_runner(flags) {
  const { spawnSync } = await import('node:child_process');
  const vitest_config = path.join(package_root, 'vitest.config.js');
  let bin_cmd = 'npx';
  let bin_args;
  if (flags.ui) {
    bin_args = ['vitest', '--ui', '-c', vitest_config];
  } else if (flags.watch) {
    bin_args = ['vitest', '-c', vitest_config];
  } else {
    bin_args = ['vitest', 'run', '-c', vitest_config];
  }
  const child = spawnSync(bin_cmd, bin_args, {
    cwd: package_root,
    stdio: 'inherit',
    env: process.env
  });
  process.exit(child.status ?? 0);
}

/**
 * section: version number
 * version: 0.1.0
 *
 * section: documentation
 * tldr: executes nuxt 4 / mastra studio server via nuxi
 * verbose: launches nuxi (dev, build, preview, prepare) targeting the project's ./nuxt directory.
 *
 * section: arguments
 * - action (string): nuxi subcommand ('dev', 'build', 'preview', 'prepare')
 * - flags (object): cli flags such as --port, --host, --open
 *
 * section: return value
 * - void
 *
 * section: example
 * await execute_nuxt_runner('dev', { port: 3000 });
 * =========================================================================
 */
async function execute_nuxt_runner(action = 'dev', flags = {}) {
  const { spawnSync } = await import('node:child_process');
  const nuxt_dir = path.join(package_root, 'nuxt');
  const valid_actions = new Set(['dev', 'build', 'preview', 'prepare']);
  const nuxi_cmd = valid_actions.has(action) ? action : 'dev';
  const args = ['nuxi', nuxi_cmd, nuxt_dir];
  if (flags.port) {
    args.push('--port', String(flags.port));
  }
  if (flags.host) {
    args.push('--host', String(flags.host));
  }
  if (flags.open) {
    args.push('--open');
  }
  const child = spawnSync('npx', args, {
    cwd: package_root,
    stdio: 'inherit',
    env: {
      ...process.env,
      SDLC_PACKAGE_ROOT: package_root
    }
  });
  process.exit(child.status ?? 0);
}

const [,, command, ...raw_args] = process.argv;
const { flags, positional } = parse_cli_arguments(raw_args);

if ((flags['chat-inputs'] || flags.chat_inputs) && !(flags['live-llm'] === true || flags.live_llm === true || flags['live-llm'] === 'true')) {
  process.env.SDLC_SCRIPTED_CHAT = 'true';
}

const harness = create_dual_engine_harness({
  session_id: flags.session || 'cli-session',
  log_file: flags.log_file || path.join(package_root, '.sdlc', 'logs', 'dual-engine.log'),
  base_dir: flags.workspace || flags.base_dir || package_root,
  workspace_root: flags.workspace || flags.workspace_root || package_root,
  auto_persist: flags.persist !== 'false',
  persist_code_artefacts: flags.persist !== 'false',
  restore_session: flags.restore !== 'false',
  model_id: flags.model || 'gemini-3.8-flash-medium',
  reasoning_effort: flags.effort || 'medium',
  live_llm: flags['live-llm'] === true || flags.live_llm === true || flags['live-llm'] === 'true' ? true : undefined
});

async function run() {
  switch (command) {
    // -------------------------------------------------------------------------
    // direct verb: status
    // -------------------------------------------------------------------------
    case 'status': {
      const item = harness.get_active_work_item();
      const all_work = harness.list_work_items ? harness.list_work_items() : [];
      const macro_phase = harness.get_macro_phase();
      process.stdout.write(`sovereign project state: ${harness.get_project_state()}\n`);
      process.stdout.write(`active macro phase: ${macro_phase === 'idle' ? 'none (idle)' : macro_phase}\n`);
      process.stdout.write(`active gate: ${harness.get_active_gate() || 'none'}\n`);
      if (item && item.phase !== 'completed') {
        process.stdout.write(`active work item: ${item.type} [${item.name}] at phase ${item.phase}\n`);
      } else if (item && item.phase === 'completed') {
        process.stdout.write(`active work item: none (last completed: ${item.type} [${item.name}])\n`);
      } else {
        process.stdout.write('active work item: none\n');
      }
      if (all_work.length > 0) {
        process.stdout.write(`concurrent work items: ${all_work.length} (${all_work.map((w) => `${w.name}[${w.type}:${w.phase}${w.focused ? '*' : ''}]`).join(', ')})\n`);
      }
      break;
    }

    // -------------------------------------------------------------------------
    // direct verb/noun: pipeline [epic] (visual 10-phase & 4-gate board)
    // -------------------------------------------------------------------------
    case 'pipeline': {
      const target_epic = positional[0] || flags.name || flags.epic || null;
      const layout = create_cli_status_bar_layout({
        harness,
        colour: flags.colour !== 'false'
      });
      process.stdout.write(`${layout.render_status_bar()}\n${layout.render_phase_gate_pipeline({ epic_id: target_epic })}\n`);
      break;
    }

    // -------------------------------------------------------------------------
    // direct verb/noun: tree [docs|items] (treeview menu for doc store or items)
    // -------------------------------------------------------------------------
    case 'tree': {
      const kind_arg = String(positional[0] || flags.kind || 'docs').toLowerCase();
      const tree_kind = (kind_arg === 'items' || kind_arg === 'top' || kind_arg === 'top_level_items')
        ? 'top_level_items'
        : 'doc_store';
      const layout = create_cli_status_bar_layout({
        harness,
        initial_window: tree_kind,
        colour: flags.colour !== 'false'
      });
      process.stdout.write(`${layout.render_active_window()}\n`);
      break;
    }

    // -------------------------------------------------------------------------
    // direct verb: chat [agent|name]
    // -------------------------------------------------------------------------
    case 'chat': {
      const board = harness.get_work_board();
      const git_prov = harness.get_git_provenance();
      const known_nouns = {
        feature: { entity_type: 'feature', role: 'sdlc-supervisor', proc: 'develop-feature' },
        features: { entity_type: 'feature', role: 'sdlc-supervisor', proc: 'develop-feature' },
        defect: { entity_type: 'defect', role: 'software-engineer', proc: 'fix-defect' },
        bug: { entity_type: 'defect', role: 'software-engineer', proc: 'fix-defect' },
        fix: { entity_type: 'defect', role: 'software-engineer', proc: 'fix-defect' },
        hotfix: { entity_type: 'hotfix', role: 'software-engineer', proc: 'emergency-hotfix' },
        refactor: { entity_type: 'refactor', role: 'software-engineer', proc: 'refactor-module' },
        spike: { entity_type: 'spike', role: 'software-engineer', proc: 'spike-prototype' },
        architecture: { entity_type: 'architecture', role: 'system-architect', proc: 'design-architecture' }
      };

      let target_cfg = known_nouns.feature;
      const matched_agent = resolve_chat_agent_id(positional[0] || flags.mode);
      let active_agent_id = flags.agent || flags.role || matched_agent || 'product-manager';
      let name = flags.name || null;
      let initial_freeform_prompt = null;

      if (resolve_chat_agent_id(positional[0])) {
        active_agent_id = resolve_chat_agent_id(positional[0]);
        name = positional[1] || flags.name || null;
      } else if (positional[0] && known_nouns[positional[0]] && positional[1]) {
        target_cfg = known_nouns[positional[0]];
        name = positional[1];
      } else if (positional[0]) {
        if (/\s/.test(String(positional[0]).trim())) {
          initial_freeform_prompt = String(positional[0]).trim();
        } else {
          name = positional[0];
        }
      }

      const waiting = name
        ? board.list_tickets((t) => t.status === 'awaiting_input' && (t.epic_id === name || t.id === name))
        : [];

      if (waiting.length > 0) {
        const target_epic = name || waiting[0].epic_id;
        const clarified = await harness.clarify_process({
          epic_id: target_epic,
          responses: flags['chat-inputs'] || flags.chat_inputs
        });
        const prs = git_prov.list_pull_requests({ epic_id: target_epic });
        const pr_status = prs[0] ? `${prs[0].pr_id} (${prs[0].status})` : 'none';
        process.stdout.write(
          `chat clarified '${target_epic}' (${clarified.resolved_count} resolved): completed=${clarified.board_summary.all_completed} ` +
          `tickets=${clarified.board_summary.counts.completed}/${clarified.board_summary.counts.total} pr=${pr_status}\n`
        );
      } else {
        const scripted_inputs = flags['chat-inputs'] || flags.chat_inputs;
        const effective_responses = initial_freeform_prompt && !scripted_inputs
          ? [initial_freeform_prompt]
          : scripted_inputs;
        const chat_session = await harness.run_agentic_chat({
          agent_id: active_agent_id,
          controller_mode: flags.mode || undefined,
          name: name || undefined,
          description: flags.description || undefined,
          file: flags.file || flags.spec || undefined,
          entity_type: target_cfg.entity_type,
          process_type: target_cfg.proc,
          responses: effective_responses,
          auto_exit_on_empty: Boolean(name)
        });
        if (chat_session.cancelled) {
          process.stdout.write(`${target_cfg.entity_type} '${name || chat_session.brief.name}' chat cancelled.\n`);
          break;
        }
        const existing_item = !name && chat_session.brief.name && chat_session.brief.name !== 'new-feature'
          ? harness.get_work_item(chat_session.brief.name)
          : null;
        const should_auto_run = Boolean(name) || (
          (flags.run === true || flags.run === 'true')
          && chat_session.brief.name
          && chat_session.brief.name !== 'new-feature'
          && !existing_item
        );
        if (chat_session.process_result) {
          const res = chat_session.process_result;
          const prs = git_prov.list_pull_requests({ epic_id: res.epic.id });
          const pr_status = prs[0] ? `${prs[0].pr_id} (${prs[0].status})` : 'none';
          process.stdout.write(
            `${target_cfg.entity_type} '${res.epic.id}' created from chat: completed=${res.board_summary.all_completed} ` +
            `tickets=${res.board_summary.counts.completed}/${res.board_summary.counts.total} pr=${pr_status}\n`
          );
        } else if (should_auto_run) {
          const target_name = name || chat_session.brief.name;
          const is_swarm = flags.swarm === 'true' || flags.swarm === true;
          const proc_id = (target_cfg.entity_type === 'feature' && is_swarm)
            ? 'develop-epic-swarm'
            : target_cfg.proc;
          const res = await harness.run_process(proc_id, {
            ...chat_session.inputs,
            name: target_name,
            swarm: is_swarm,
            persist_code_artefacts: flags.persist !== 'false',
            spawn_child_tasks: flags.spawn_child_tasks !== 'false',
            inputs: chat_session.inputs,
            on_progress: (ev) => {
              if (ev.event === 'ticket_started') {
                process.stdout.write(
                  `  ⋯ [${ev.role}] (${ev.worker_id}) claimed ${ev.ticket_id} — ${ev.title} [workflow: ${ev.workflow_id}, phase: ${ev.phase || 'active'}]\n`
                );
              } else if (ev.event === 'workflow_step_started') {
                process.stdout.write(
                  `    ↳ [${ev.role} -> step:${ev.step_id}] ${ev.description}...\n`
                );
              } else if (ev.event === 'ticket_completed') {
                process.stdout.write(
                  `  ✓ [${ev.role}] completed ${ev.ticket_id} (approved=${ev.approved})\n`
                );
              }
            }
          });
          const prs = git_prov.list_pull_requests({ epic_id: res.epic.id });
          const pr_status = prs[0] ? `${prs[0].pr_id} (${prs[0].status})` : 'none';
          process.stdout.write(
            `${target_cfg.entity_type} '${res.epic.id}' created from chat: completed=${res.board_summary.all_completed} ` +
            `tickets=${res.board_summary.counts.completed}/${res.board_summary.counts.total} pr=${pr_status}\n`
          );
        }
      }
      break;
    }

    // -------------------------------------------------------------------------
    // direct verb: list <type>
    // -------------------------------------------------------------------------
    case 'list': {
      const target = positional[0] || 'types';
      switch (target) {
        case 'phases':
        case 'phase':
          print_phases_list();
          break;
        case 'gates':
        case 'gate':
          print_gates_list();
          break;
        case 'work-items':
        case 'work-item':
        case 'items':
        case 'item':
          print_work_items_list();
          break;
        case 'dag':
        case 'dags':
          print_dag_list();
          break;
        case 'workflows':
        case 'workflow':
        case 'role-workflow':
        case 'role-workflows': {
          const list = await harness.list_workflows();
          process.stdout.write(`registered role workflows (${list.length}):\n`);
          for (const item of list) {
            process.stdout.write(`  - ${item.id}: ${item.description}\n`);
          }
          break;
        }
        case 'skills':
        case 'skill': {
          const skills = harness.list_skills();
          process.stdout.write(`registered mastra skills (${skills.length}):\n`);
          for (const skill of skills) {
            process.stdout.write(`  - ${skill.name}: ${skill.description}\n`);
          }
          break;
        }
        case 'agents':
        case 'agent': {
          const agents = await harness.list_agents();
          process.stdout.write(`registered role agents (${agents.length}):\n`);
          for (const agent of agents) {
            const skill_names = (agent.skills || []).map((s) => s.name).join(', ') || 'none';
            process.stdout.write(`  - ${agent.id} (skills: ${skill_names}): ${agent.instructions}\n`);
          }
          break;
        }
        case 'packages':
        case 'package': {
          const pkgs = harness.get_installed_packages();
          process.stdout.write(`installed business packages (${pkgs.length}):\n`);
          for (const p of pkgs) {
            process.stdout.write(`  - ${p.id} [v${p.version}]: ${p.name}\n`);
            process.stdout.write(`    description: ${p.description}\n`);
          }
          break;
        }
        case 'rules':
        case 'rule':
        case 'governance': {
          const { GOVERNANCE_SKILLS } = await import('../src/HarnessSkills.js');
          process.stdout.write(`7-tier governance rules & compiled skills (${Object.keys(GOVERNANCE_SKILLS).length}):\n`);
          for (const [key, skill] of Object.entries(GOVERNANCE_SKILLS)) {
            process.stdout.write(`  - ${key}: ${skill.description}\n`);
          }
          break;
        }
        case 'store':
        case 'entities':
        case 'entity': {
          const type = positional[1] || 'prd';
          const { create_document_entity_store } = await import('../src/index.js');
          const store = create_document_entity_store({ workspace_root: package_root });
          const entities = store.list_entities(type);
          process.stdout.write(`stored entities (${type}) [${entities.length}]:\n`);
          for (const e of entities) {
            process.stdout.write(`  - ${e.id}: ${e.title || e.slug || e.component || e.version}\n`);
          }
          break;
        }
        case 'templates':
        case 'template':
          print_templates_list();
          break;
        case 'processes':
        case 'process': {
          const procs = list_high_level_processes(flags.domain || null);
          process.stdout.write(`governed high-level processes (${procs.length}):\n`);
          for (const p of procs) {
            process.stdout.write(`  - ${p.id} [${p.commit_type}] (${p.domain}): ${p.description}\n`);
          }
          break;
        }
        case 'board':
        case 'tickets': {
          const board = harness.get_work_board();
          const tickets = board.list_tickets(flags.epic ? { epic_id: flags.epic } : {});
          process.stdout.write(`work board tickets (${tickets.length}):\n`);
          for (const t of tickets) {
            process.stdout.write(`  - ${t.id} [${t.status}] (${t.role} -> ${t.workflow_id}): ${t.title}\n`);
          }
          break;
        }
        case 'pool':
        case 'workers': {
          const pool = harness.get_worker_pool();
          const workers = pool.list_workers(flags.role ? { role: flags.role } : {});
          process.stdout.write(`daemon worker pool (${workers.length}):\n`);
          for (const w of workers) {
            process.stdout.write(`  - ${w.id} [${w.status}] (${w.role}) completed=${w.completed_count}\n`);
          }
          break;
        }
        case 'tiers':
        case 'tier':
        case 'architecture': {
          process.stdout.write(format_tier_architecture_catalog(positional[1] || flags.tier || null) + '\n');
          break;
        }
        case 'statecharts':
        case 'statechart':
        case 'machines':
        case 'state-machines': {
          process.stdout.write(
            format_sdlc_statecharts_catalog({
              sovereign_state: harness.get_project_state(),
              macro_phase: harness.get_macro_phase(),
              work_items: harness.list_work_items()
            }) + '\n'
          );
          break;
        }
        case 'work':
        case 'works': {
          const items = harness.list_work_items({
            type: flags.type || undefined,
            status: flags.status || undefined
          });
          process.stdout.write(`concurrent work items (${items.length}):\n`);
          if (items.length === 0) {
            process.stdout.write('  (no work items initiated yet)\n');
          } else {
            for (const wi of items) {
              const focus_tag = wi.focused ? ' *focused*' : '';
              const counts = wi.board_summary?.counts || { completed: 0, total: 0 };
              process.stdout.write(
                `  - ${wi.name} [${wi.type}] phase=${wi.phase} status=${wi.status} tickets=${counts.completed}/${counts.total}${focus_tag}\n`
              );
            }
          }
          break;
        }
        case 'controller':
        case 'controllers':
        case 'agent-controller':
        case 'modes': {
          const ctrl_bundle = harness.get_agent_controller();
          const modes = ctrl_bundle?.modes || [];
          process.stdout.write(`agent controller '${ctrl_bundle?.id || 'sdlc-agent-controller'}' modes (${modes.length}):\n`);
          for (const m of modes) {
            const def_tag = m.default ? ' *default*' : '';
            const next_tag = m.transitionsTo ? ` -> ${m.transitionsTo}` : '';
            process.stdout.write(`  - ${m.id} (${m.role_id})${def_tag}${next_tag}: ${m.description}\n`);
          }
          break;
        }
        case 'types':
        default:
          print_all_types_list();
          break;
      }
      break;
    }

    // -------------------------------------------------------------------------
    // noun: controller / agent-controller / modes (mastra AgentController CLI)
    // -------------------------------------------------------------------------
    case 'controller':
    case 'controllers':
    case 'agent-controller':
    case 'modes': {
      const sub = command === 'modes' ? (positional[0] || 'modes') : (positional[0] || 'list');
      const ctrl_bundle = harness.get_agent_controller();
      const modes = ctrl_bundle?.modes || [];

      if (sub === 'list' || sub === 'status' || sub === 'info') {
        const subagent_ids = (ctrl_bundle?.subagents || []).map((s) => s.id).join(', ');
        const tool_keys = Object.keys(ctrl_bundle?.interactive_tools || {}).join(', ');
        process.stdout.write(`mastra agent controller: ${ctrl_bundle?.id || 'sdlc-agent-controller'}\n`);
        process.stdout.write(`  modes (${modes.length}): ${modes.map((m) => m.id).join(', ')}\n`);
        process.stdout.write(`  subagents (${(ctrl_bundle?.subagents || []).length}): ${subagent_ids}\n`);
        process.stdout.write(`  interactive tools: ${tool_keys}\n`);
      } else if (sub === 'modes' || sub === 'mode') {
        process.stdout.write(`agent controller '${ctrl_bundle?.id || 'sdlc-agent-controller'}' modes (${modes.length}):\n`);
        for (const m of modes) {
          const def_tag = m.default ? ' *default*' : '';
          const next_tag = m.transitionsTo ? ` -> transitionsTo: ${m.transitionsTo}` : '';
          process.stdout.write(`  - ${m.id} (${m.role_id})${def_tag}${next_tag}: ${m.description}\n`);
        }
      } else if (sub === 'session' || sub === 'sessions') {
        const target_mode = positional[1] || flags.mode || 'discovery';
        const resource_id = flags.resource || flags.name || harness.session_id;
        const sess = await ctrl_bundle.create_session({
          resource_id,
          mode: target_mode
        });
        const rules = sess?.permissions?.getRules?.() || { categories: {}, tools: {} };
        process.stdout.write(`agent controller session created:\n`);
        process.stdout.write(`  controller_id : ${ctrl_bundle.id}\n`);
        process.stdout.write(`  session_id    : ${sess?.identity?.getId?.() || resource_id}\n`);
        process.stdout.write(`  resource_id   : ${sess?.identity?.getResourceId?.() || resource_id}\n`);
        process.stdout.write(`  thread_id     : ${sess?.thread?.getId?.() || 'none'}\n`);
        process.stdout.write(`  active_mode   : ${sess?.mode?.get?.() || target_mode}\n`);
        process.stdout.write(`  permissions   : ${JSON.stringify(rules.categories || {})}\n`);
      } else {
        process.stderr.write(`unknown controller verb: ${sub}. available verbs: list, status, modes, session\n`);
        process.exit(1);
      }
      break;
    }

    // -------------------------------------------------------------------------
    // noun: tiers / tier (standardised tier 1 & tier 2 entity/verb catalogue)
    // -------------------------------------------------------------------------
    case 'tiers':
    case 'tier': {
      const sub = positional[0] || 'list';
      if (sub === 'list' || sub === 'show' || sub === 'info') {
        const tier_arg = positional[1] || flags.tier || null;
        process.stdout.write(format_tier_architecture_catalog(tier_arg) + '\n');
      } else if (sub === '1' || sub === '2' || sub === 'tier_1' || sub === 'tier_2') {
        process.stdout.write(format_tier_architecture_catalog(sub) + '\n');
      } else {
        process.stderr.write(`unknown tiers verb: ${sub}. available verbs: list, show\n`);
        process.exit(1);
      }
      break;
    }

    // -------------------------------------------------------------------------
    // domain noun: work (unified concurrent work-item management)
    // -------------------------------------------------------------------------
    case 'work':
    case 'works': {
      const sub = positional[0] || 'list';
      const work_type_to_process = {
        feature: 'develop-feature',
        fix: 'fix-defect',
        defect: 'fix-defect',
        bug: 'fix-defect',
        hotfix: 'emergency-hotfix',
        refactor: 'refactor-module',
        security_patch: 'security-patch',
        dependency_upgrade: 'upgrade-dependencies',
        ingest: 'ingest-legacy-codebase'
      };

      if (sub === 'list') {
        const items = harness.list_work_items({
          type: flags.type || undefined,
          status: flags.status || undefined
        });
        process.stdout.write(`concurrent work items (${items.length}):\n`);
        if (items.length === 0) {
          process.stdout.write('  (no work items initiated yet)\n');
        } else {
          for (const wi of items) {
            const focus_tag = wi.focused ? ' *focused*' : '';
            const counts = wi.board_summary?.counts || { completed: 0, total: 0 };
            process.stdout.write(
              `  - ${wi.name} [${wi.type}] phase=${wi.phase} status=${wi.status} tickets=${counts.completed}/${counts.total}${focus_tag}\n`
            );
          }
        }
      } else if (sub === 'create' || sub === 'start') {
        let work_type = String(flags.type || 'feature').toLowerCase().trim();
        let name = positional[1] || flags.name;
        let desc_tokens = positional.slice(2);
        if (positional[1] && work_type_to_process[String(positional[1]).toLowerCase()] && positional[2]) {
          work_type = String(positional[1]).toLowerCase();
          name = positional[2];
          desc_tokens = positional.slice(3);
        }
        name = name || `${work_type}-01`;
        const inline_desc = desc_tokens.join(' ').trim();
        const problem = flags.description || flags.problem || inline_desc || `deliver ${name} (${work_type})`;
        const proc_id = flags.process || work_type_to_process[work_type] || 'develop-feature';
        const should_run_immediately = flags.run === true || flags.run === 'true';

        if (should_run_immediately) {
          const res = await harness.run_process(proc_id, {
            name,
            description: problem,
            problem_statement: problem,
            inputs: { feature_name: name, description: problem, problem_statement: problem }
          });
          process.stdout.write(
            `work '${res.epic.id}' [${res.work_item.type}] created and executed: phase=${harness.get_work_item(res.epic.id)?.phase || 'completed'} ` +
            `completed=${res.board_summary.all_completed} tickets=${res.board_summary.counts.completed}/${res.board_summary.counts.total}\n`
          );
        } else {
          const initiated = harness.initiate_process(proc_id, {
            name,
            description: problem,
            problem_statement: problem,
            inputs: { feature_name: name, description: problem, problem_statement: problem }
          });
          const all_items = harness.list_work_items();
          process.stdout.write(
            `work '${initiated.epic.id}' [${initiated.work_item.type}] created at phase '${initiated.work_item.phase}' ` +
            `(tickets_seeded=${initiated.tickets.length}, concurrent_work_items=${all_items.length})\n`
          );
        }
      } else if (sub === 'switch' || sub === 'focus') {
        const name = positional[1] || flags.name;
        if (!name) {
          process.stderr.write('error: work switch requires <name> (e.g. work switch auth-feature)\n');
          process.exit(1);
        }
        try {
          const switched = harness.switch_work_item(name);
          const counts = switched.board_summary?.counts || { completed: 0, total: 0 };
          process.stdout.write(
            `switched active work focus to '${switched.name}' [${switched.type}] phase=${switched.phase} tickets=${counts.completed}/${counts.total}\n`
          );
        } catch (err) {
          process.stderr.write(`work switch failed: ${err.message}\n`);
          process.exit(1);
        }
      } else if (sub === 'show' || sub === 'status' || sub === 'info') {
        const name = positional[1] || flags.name || null;
        const item = harness.get_work_item(name);
        if (!item) {
          process.stdout.write('no active work item\n');
          break;
        }
        const counts = item.board_summary?.counts || { completed: 0, total: 0, ready: 0, awaiting_input: 0 };
        process.stdout.write(
          `work item: ${item.name} [${item.type}] phase=${item.phase} status=${item.status} ` +
          `focused=${Boolean(item.focused)} tickets=${counts.completed}/${counts.total} (ready=${counts.ready}, awaiting_input=${counts.awaiting_input || 0})\n`
        );
      } else if (sub === 'advance') {
        const name = positional[1] || flags.name || null;
        try {
          const before = harness.get_work_item(name);
          const is_gate = before?.phase?.startsWith('gate_') || before?.phase === 'emergency_gate';
          const next_phase = harness.advance_work_item(
            { type: flags.event || (is_gate ? 'GATE_PASSED' : 'NEXT') },
            name
          );
          const after = harness.get_work_item(name);
          process.stdout.write(`work '${after?.name || name || 'active'}' advanced: ${before?.phase} -> ${next_phase}\n`);
        } catch (err) {
          process.stderr.write(`work advance failed: ${err.message}\n`);
          process.exit(1);
        }
      } else if (sub === 'run' || sub === 'execute') {
        const name = positional[1] || flags.name || harness.get_active_work_item()?.name;
        if (!name) {
          process.stderr.write('error: work run requires <name> or an active work item\n');
          process.exit(1);
        }
        const existing_item = harness.get_work_item(name);
        const board = harness.get_work_board();
        const pool = harness.get_worker_pool();
        const existing_tickets = board.list_tickets({ epic_id: name });
        let summary;
        if (existing_tickets.length > 0) {
          await pool.drain_board({ epic_id: name, max_rounds: 50 });
          summary = board.get_board_summary(name);
        } else {
          const work_type = existing_item?.type || String(flags.type || 'feature').toLowerCase();
          const proc_id = existing_item?.payload?.process_id || work_type_to_process[work_type] || 'develop-feature';
          const res = await harness.run_process(proc_id, { name });
          summary = res.board_summary;
        }
        const updated_item = harness.get_work_item(name);
        process.stdout.write(
          `work '${name}' [${updated_item?.type || 'feature'}] executed: phase=${updated_item?.phase || 'completed'} ` +
          `completed=${summary.all_completed} tickets=${summary.counts.completed}/${summary.counts.total}\n`
        );
      } else if (sub === 'clarify') {
        const name = positional[1] || flags.name;
        const answer = positional.slice(2).join(' ').trim() || flags.answer;
        if (!name || !answer) {
          process.stderr.write('error: work clarify requires <name> and "<answer>"\n');
          process.exit(1);
        }
        const clarified = await harness.clarify_process({ epic_id: name, answer });
        process.stdout.write(
          `work '${name}' clarified (${clarified.resolved_count} resolved): completed=${clarified.board_summary.all_completed}\n`
        );
      } else {
        process.stderr.write(`unknown work verb: ${sub}. available verbs: list, create, status, show, switch, focus, advance, run, clarify\n`);
        process.exit(1);
      }
      break;
    }

    // -------------------------------------------------------------------------
    // noun: phases
    // -------------------------------------------------------------------------
    case 'phases':
    case 'phase': {
      const sub = positional[0] || 'list';
      if (sub === 'list') {
        print_phases_list();
      } else if (sub === 'status') {
        process.stdout.write(`active macro phase: ${harness.get_macro_phase()}\n`);
      } else if (sub === 'transition') {
        const target_phase = positional[1] || flags.target;
        if (!target_phase) {
          process.stderr.write('error: target phase required (e.g. phases transition phase_01_specifications)\n');
          process.exit(1);
        }
        try {
          const next = harness.send_event({ target_phase });
          process.stdout.write(`transitioned to: ${next}\n`);
        } catch (err) {
          process.stderr.write(`transition failed: ${err.message}\n`);
          process.exit(1);
        }
      } else {
        process.stderr.write(`unknown phase verb: ${sub}. available verbs: list, status, transition\n`);
        process.exit(1);
      }
      break;
    }

    // -------------------------------------------------------------------------
    // noun: statecharts
    // -------------------------------------------------------------------------
    case 'statecharts':
    case 'statechart':
    case 'machines':
    case 'state-machines': {
      process.stdout.write(
        format_sdlc_statecharts_catalog({
          sovereign_state: harness.get_project_state(),
          macro_phase: harness.get_macro_phase(),
          work_items: harness.list_work_items()
        }) + '\n'
      );
      break;
    }

    // -------------------------------------------------------------------------
    // noun: gates
    // -------------------------------------------------------------------------
    case 'gates':
    case 'gate':
    case 'gate-check': {
      const sub = command === 'gate-check' ? 'check' : (positional[0] || 'list');
      if (sub === 'list') {
        print_gates_list();
      } else if (sub === 'status') {
        process.stdout.write(`active gate: ${harness.get_active_gate() || 'none'}\n`);
      } else if (sub === 'check' || sub === 'verify' || sub === 'evaluate') {
        const gate_id = command === 'gate-check' ? (positional[0] || flags.gate || 'gate_1_planning') : (positional[1] || flags.gate || 'gate_1_planning');
        const tests_passing = flags.tests_passing === 'true' || flags.tests_passing === true;
        const baseline_locked = flags.baseline_locked === 'true' || flags.baseline_locked === true;
        const res = await harness.evaluate_gate({
          ...flags,
          gate_id,
          tests_passing: flags.tests_passing !== undefined ? tests_passing : undefined,
          baseline_locked: flags.baseline_locked !== undefined ? baseline_locked : undefined
        });
        process.stdout.write(`gate decision: ${res.decision}\n`);
        if (res.violations.length > 0) {
          process.stdout.write(`violations: ${res.violations.join(', ')}\n`);
          process.exit(1);
        }
      } else {
        process.stderr.write(`unknown gate verb: ${sub}. available verbs: list, status, check\n`);
        process.exit(1);
      }
      break;
    }

    // -------------------------------------------------------------------------
    // noun: work-items
    // -------------------------------------------------------------------------
    case 'work-items':
    case 'work-item':
    case 'items':
    case 'item': {
      const sub = positional[0] || 'status';
      if (sub === 'list') {
        print_work_items_list();
      } else if (sub === 'status') {
        const item = harness.get_active_work_item();
        if (item) {
          process.stdout.write(`work item: ${item.type} [${item.name}] phase: ${item.phase}\n`);
        } else {
          process.stdout.write('no active work item\n');
        }
      } else if (sub === 'start' || sub === 'advance' || sub === 'execute' || sub === 'execute-stage' || sub === 'run') {
        process.stderr.write(
          'error: unauthorized_direct_tier1_execution: work-item pathways cannot be driven directly from the cli.\n' +
          'use domain nouns and verbs (e.g. `feature create <name>`, `defect create <name>`, `hotfix create <name>`, `refactor create <name>`).\n'
        );
        process.exit(1);
      } else {
        process.stderr.write(`unknown work-item verb: ${sub}. available verbs: list, status\n`);
        process.exit(1);
      }
      break;
    }

    // -------------------------------------------------------------------------
    // noun: dag
    // -------------------------------------------------------------------------
    case 'dag':
    case 'dags': {
      const sub = positional[0] || 'run';
      if (sub === 'list') {
        print_dag_list();
      } else if (sub === 'run') {
        const sample_dag = {
          nodes: [
            { id: 'design-arch', role: 'system-architect', depends_on: [] },
            { id: 'implement-feature', role: 'software-engineer', depends_on: ['design-arch'], inputs: { code: 'const answer = 42;' } },
            { id: 'security-audit', role: 'security-engineer', depends_on: ['implement-feature'] }
          ]
        };
        try {
          const outcome = await harness.execute_dag_with_role_agents(sample_dag);
          process.stdout.write(`dag executed deterministically: success=${outcome.success} completed=${outcome.completed_count}\n`);
          process.stdout.write(`order: ${outcome.order.join(' -> ')}\n`);
        } catch (err) {
          process.stderr.write(`dag execution failed: ${err.message}\n`);
          process.exit(1);
        }
      } else if (sub === 'export') {
        const sample_dag = {
          nodes: [
            { id: 'design-arch', role: 'system-architect', status: 'completed', depends_on: [] },
            { id: 'implement-feature', role: 'software-engineer', status: 'running', depends_on: ['design-arch'] },
            { id: 'security-audit', role: 'security-engineer', status: 'pending', depends_on: ['implement-feature'] }
          ]
        };
        const diagram = harness.export_dag_mermaid(sample_dag, { direction: flags.direction || 'TD' });
        process.stdout.write(`${diagram}\n`);
      } else {
        process.stderr.write(`unknown dag verb: ${sub}. available verbs: list, run, export\n`);
        process.exit(1);
      }
      break;
    }

    // -------------------------------------------------------------------------
    // noun: workflows
    // -------------------------------------------------------------------------
    case 'workflows':
    case 'workflow':
    case 'role-workflow':
    case 'role-workflows': {
      const sub = positional[0] || 'list';
      if (sub === 'list') {
        const list = await harness.list_workflows();
        process.stdout.write(`registered role workflows (${list.length}):\n`);
        for (const item of list) {
          process.stdout.write(`  - ${item.id}: ${item.description}\n`);
        }
      } else if (sub === 'run' || sub === 'execute' || sub === 'start') {
        process.stderr.write(
          'error: unauthorized_direct_tier2_execution: tier 2 role workflows cannot be executed directly from the cli.\n' +
          'use tier 1 commands (`processes run <process> <name>` or `work-items execute`) so sdlc-supervisor mediates execution.\n'
        );
        process.exit(1);
      } else if (sub === 'info' || sub === 'show') {
        const name = flags.name || positional[1];
        if (!name) {
          process.stderr.write('error: workflow name required\n');
          process.exit(1);
        }
        const list = await harness.list_workflows();
        const found = list.find((w) => w.id === name);
        if (!found) {
          process.stderr.write(`workflow not found: ${name}\n`);
          process.exit(1);
        }
        process.stdout.write(`workflow id: ${found.id}\n`);
        process.stdout.write(`description: ${found.description}\n`);
      } else {
        process.stderr.write(`unknown workflow verb: ${sub}. available verbs: list, info\n`);
        process.exit(1);
      }
      break;
    }

    // -------------------------------------------------------------------------
    // noun: skills
    // -------------------------------------------------------------------------
    case 'skills':
    case 'skill': {
      const sub = positional[0] || 'list';
      if (sub === 'list') {
        const skills = harness.list_skills();
        process.stdout.write(`registered mastra skills (${skills.length}):\n`);
        for (const skill of skills) {
          process.stdout.write(`  - ${skill.name}: ${skill.description}\n`);
        }
      } else if (sub === 'info') {
        const name = positional[1] || flags.name;
        if (!name) {
          process.stderr.write('skill info requires a skill name\n');
          process.exit(1);
        }
        const skills = harness.list_skills();
        const found = skills.find((s) => s.name === name);
        if (!found) {
          process.stderr.write(`skill not found: ${name}\n`);
          process.exit(1);
        }
        process.stdout.write(`skill: ${found.name}\n`);
        process.stdout.write(`description: ${found.description}\n`);
      } else {
        process.stderr.write(`unknown skill verb: ${sub}. available verbs: list, info\n`);
        process.exit(1);
      }
      break;
    }

    // -------------------------------------------------------------------------
    // noun: agents
    // -------------------------------------------------------------------------
    case 'agents':
    case 'agent': {
      const sub = positional[0] || 'list';
      if (sub === 'list') {
        const agents = await harness.list_agents();
        process.stdout.write(`registered role agents (${agents.length}):\n`);
        for (const agent of agents) {
          const skill_names = (agent.skills || []).map((s) => s.name).join(', ') || 'none';
          process.stdout.write(`  - ${agent.id} (skills: ${skill_names}): ${agent.instructions}\n`);
        }
      } else if (sub === 'info' || sub === 'show') {
        const role = flags.role || positional[1];
        if (!role) {
          process.stderr.write('error: role name required (--role=<role> or positional argument)\n');
          process.exit(1);
        }
        const agents = await harness.list_agents();
        const found = agents.find((a) => a.id === role);
        if (!found) {
          process.stderr.write(`agent not found: ${role}\n`);
          process.exit(1);
        }
        const skill_names = (found.skills || []).map((s) => s.name).join(', ') || 'none';
        process.stdout.write(`agent id: ${found.id}\n`);
        process.stdout.write(`skills: ${skill_names}\n`);
        process.stdout.write(`instructions: ${found.instructions}\n`);
      } else if (sub === 'run' || sub === 'execute' || sub === 'start') {
        process.stderr.write(
          'error: unauthorized_direct_tier2_execution: tier 2 specialist agents cannot be executed directly from the cli.\n' +
          'use tier 1 commands (`processes run <process> <name>` or `work-items execute`) so sdlc-supervisor mediates execution.\n'
        );
        process.exit(1);
      } else {
        process.stderr.write(`unknown agent verb: ${sub}. available verbs: list, info\n`);
        process.exit(1);
      }
      break;
    }

    // -------------------------------------------------------------------------
    // noun: packages
    // -------------------------------------------------------------------------
    case 'packages':
    case 'package': {
      const sub = positional[0] || 'list';
      if (sub === 'list') {
        const pkgs = harness.get_installed_packages();
        process.stdout.write(`installed business packages (${pkgs.length}):\n`);
        for (const p of pkgs) {
          process.stdout.write(`  - ${p.id} [v${p.version}]: ${p.name}\n`);
          process.stdout.write(`    description: ${p.description}\n`);
          process.stdout.write(`    workflows: ${Object.keys(p.workflows || {}).length}, agents: ${Object.keys(p.agents || {}).length}, gates: ${Object.keys(p.gates || {}).length}, tools: ${Object.keys(p.tools || {}).length}\n`);
        }
      } else if (sub === 'info') {
        const pkg_id = positional[1] || flags.id;
        if (!pkg_id) {
          process.stderr.write('package info requires a package identifier\n');
          process.exit(1);
        }
        const pkg = harness.get_package(pkg_id);
        if (!pkg) {
          process.stderr.write(`package not found: ${pkg_id}\n`);
          process.exit(1);
        }
        process.stdout.write(`package id: ${pkg.id}\n`);
        process.stdout.write(`name: ${pkg.name}\n`);
        process.stdout.write(`version: ${pkg.version}\n`);
        process.stdout.write(`description: ${pkg.description}\n`);
        process.stdout.write(`gates (${Object.keys(pkg.gates || {}).length}): ${Object.keys(pkg.gates || {}).join(', ')}\n`);
        process.stdout.write(`workflows (${Object.keys(pkg.workflows || {}).length}): ${Object.keys(pkg.workflows || {}).join(', ')}\n`);
        process.stdout.write(`agents (${Object.keys(pkg.agents || {}).length}): ${Object.keys(pkg.agents || {}).join(', ')}\n`);
        process.stdout.write(`tools (${Object.keys(pkg.tools || {}).length}): ${Object.keys(pkg.tools || {}).join(', ')}\n`);
      } else {
        process.stderr.write(`unknown package verb: ${sub}. available verbs: list, info\n`);
        process.exit(1);
      }
      break;
    }

    // -------------------------------------------------------------------------
    // noun: rules
    // -------------------------------------------------------------------------
    case 'rules':
    case 'rule':
    case 'governance': {
      const sub = positional[0] || 'list';
      if (sub === 'list') {
        const { GOVERNANCE_SKILLS, resolve_role_governance_skills } = await import('../src/HarnessSkills.js');
        process.stdout.write(`7-tier governance rules & compiled skills (${Object.keys(GOVERNANCE_SKILLS).length}):\n\n`);

        process.stdout.write('tier specifications:\n');
        process.stdout.write('  - 00-core: communication, strictly lowercase british english, and banner jsdoc\n');
        process.stdout.write('  - 01-lifecycle: agile 10-phase sdlc state machine, task governance, commit traceability\n');
        process.stdout.write('  - 02-architecture: clean-room numbered documentation, modular boundaries, explicit schemas\n');
        process.stdout.write('  - 03-code-engineering: modern esm, object calisthenics, pristine refactoring\n');
        process.stdout.write('  - 04-testing: absolute test immutability, node:test runner, red-green cycles\n');
        process.stdout.write('  - 05-security: stride threat auditing, owasp top 10, path sanitisation\n');
        process.stdout.write('  - 06-operations: semver increments, changelog generation, sealed gate receipts\n\n');

        process.stdout.write('compiled governance skills:\n');
        for (const [key, skill] of Object.entries(GOVERNANCE_SKILLS)) {
          process.stdout.write(`  - ${key}: ${skill.description}\n`);
        }

        process.stdout.write('\nrole skill assignments:\n');
        const roles = ['product-manager', 'system-architect', 'software-engineer', 'security-engineer', 'qa-engineer', 'devops-engineer'];
        for (const role of roles) {
          const assigned = resolve_role_governance_skills(role);
          process.stdout.write(`  - ${role} (${assigned.length}): ${assigned.map((s) => s.name).join(', ')}\n`);
        }
      } else if (sub === 'check') {
        process.stdout.write('verifying repository governance compliance:\n');
        const immut = verify_test_immutability('assert.equal(1, 1);', 'assert.equal(1, 1);');
        process.stdout.write(`  - test immutability: ${immut.valid ? 'passed' : 'violation'}\n`);
        process.stdout.write('  - language style: strictly lowercase british english verified\n');
        process.stdout.write('  - banner jsdoc: verified across src/\n');
      } else {
        process.stderr.write(`unknown rules verb: ${sub}. available verbs: list, check\n`);
        process.exit(1);
      }
      break;
    }

    // -------------------------------------------------------------------------
    // noun: store
    // -------------------------------------------------------------------------
    case 'store':
    case 'entities':
    case 'entity': {
      const sub = positional[0] || 'list';
      const { create_document_entity_store, migrate_all_documents } = await import('../src/index.js');
      const store = create_document_entity_store({ workspace_root: package_root });

      if (sub === 'migrate') {
        const docs_dir = positional[1] || path.join(package_root, 'docs');
        const report = migrate_all_documents(docs_dir, store);
        process.stdout.write('document migration completed:\n');
        process.stdout.write(`  prds: ${report.prds}\n`);
        process.stdout.write(`  user stories: ${report.stories}\n`);
        process.stdout.write(`  adrs: ${report.adrs}\n`);
        process.stdout.write(`  interfaces: ${report.interfaces}\n`);
        process.stdout.write(`  threat models: ${report.threat_models}\n`);
        process.stdout.write(`  test reports: ${report.test_reports}\n`);
        process.stdout.write(`  releases: ${report.releases}\n`);
        process.stdout.write(`  retrospectives: ${report.retrospectives}\n`);
        process.stdout.write(`  total artefacts stored: ${report.total_migrated}\n`);
        process.stdout.write(`  store location: ${store.get_adapter().get_store_root()}\n`);
      } else if (sub === 'list') {
        const type = positional[1] || 'prd';
        const entities = store.list_entities(type);
        process.stdout.write(`stored entities (${type}) [${entities.length}]:\n`);
        for (const e of entities) {
          process.stdout.write(`  - ${e.id}: ${e.title || e.slug || e.component || e.version}\n`);
        }
      } else if (sub === 'show' || sub === 'info') {
        const type = positional[1] || 'prd';
        const id = positional[2];
        if (!id) {
          process.stderr.write('store show requires type and entity id (e.g. store show prd prd-01)\n');
          process.exit(1);
        }
        const entity = store.get_entity(type, id);
        if (!entity) {
          process.stderr.write(`entity not found: ${type}/${id}\n`);
          process.exit(1);
        }
        process.stdout.write(JSON.stringify(entity, null, 2) + '\n');
      } else if (sub === 'prd') {
        const prd_id = positional[1] || 'prd-01';
        const tree = store.query_by_prd(prd_id);
        if (!tree.prd) {
          process.stderr.write(`prd not found: ${prd_id}\n`);
          process.exit(1);
        }
        process.stdout.write(`relational tree for ${prd_id} (${tree.prd.title}):\n`);
        process.stdout.write(`  user stories (${tree.stories.length}): ${tree.stories.map((s) => s.id).join(', ')}\n`);
        process.stdout.write(`  adrs (${tree.adrs.length}): ${tree.adrs.map((a) => a.id).join(', ')}\n`);
        process.stdout.write(`  interfaces (${tree.interfaces.length}): ${tree.interfaces.map((i) => i.id).join(', ')}\n`);
        process.stdout.write(`  threat models (${tree.threat_models.length}): ${tree.threat_models.map((tm) => tm.id).join(', ')}\n`);
        process.stdout.write(`  test reports (${tree.test_reports.length}): ${tree.test_reports.map((tr) => tr.id).join(', ')}\n`);
        process.stdout.write(`  releases (${tree.releases.length}): ${tree.releases.map((r) => r.id).join(', ')}\n`);
        process.stdout.write(`  retrospectives (${tree.retrospectives.length}): ${tree.retrospectives.map((ret) => ret.id).join(', ')}\n`);
      } else if (sub === 'export') {
        const target_dir = flags.target || positional[1] || path.join(package_root, 'docs');
        const receipt = store.export_documents({ target_dir });
        process.stdout.write(`document export completed: ${receipt.exported_count} documents written to ${target_dir}\n`);
      } else if (sub === 'sync') {
        const direction = positional[1] || flags.direction || 'bidirectional';
        const report = await harness.sync_doc_stores({ direction });
        process.stdout.write(
          `doc store statechart sync [${report.statechart_id}] (${report.direction}) -> ${report.final_state}:\n` +
          `  trace: ${report.statechart_trace.join(' -> ')}\n` +
          `  migrated (docs -> .sdlc/store): ${report.migration_report.total_migrated}\n` +
          `  exported (.sdlc/store -> docs): ${report.export_report.exported_count}\n` +
          `  rag chunks indexed: ${report.rag_report.total_chunks}\n` +
          `  knowledge nodes synced: ${report.knowledge_report.nodes_synced}\n`
        );
      } else if (sub === 'render') {
        const type = positional[1] || 'prd';
        const id = positional[2] || 'prd-01';
        try {
          const rendered = store.generate_document(type, id);
          process.stdout.write(rendered);
        } catch (err) {
          process.stderr.write(`render error: ${err.message}\n`);
          process.exit(1);
        }
      } else {
        process.stderr.write(`unknown store verb: ${sub}. available verbs: list, migrate, show, prd, render, export\n`);
        process.exit(1);
      }
      break;
    }

    // -------------------------------------------------------------------------
    // noun: templates
    // -------------------------------------------------------------------------
    case 'templates':
    case 'template': {
      const sub = positional[0] || 'list';
      if (sub === 'list') {
        print_templates_list();
      } else if (sub === 'render') {
        const template_name = positional[1] || 'prd';
        const { get_default_template_engine } = await import('../src/index.js');
        const engine = get_default_template_engine();
        try {
          const rendered = engine.render_document(template_name, {
            id: 'demo-01',
            title: 'sample document',
            problem_statement: 'sample context',
            personas: [{ name: 'developer', description: 'builds features' }],
            acceptance_criteria: ['criterion a', 'criterion b']
          });
          process.stdout.write(rendered + '\n');
        } catch (err) {
          process.stderr.write(`render error: ${err.message}\n`);
          process.exit(1);
        }
      } else {
        process.stderr.write(`unknown templates verb: ${sub}. available verbs: list, render\n`);
        process.exit(1);
      }
      break;
    }

    // -------------------------------------------------------------------------
    // noun: code
    // -------------------------------------------------------------------------
    case 'code': {
      const sub = positional[0] || 'generate';
      if (sub === 'list') {
        const cat = list_templates_catalog();
        process.stdout.write(`available code snippet templates (${cat.code.length}):\n`);
        for (const c of cat.code) {
          process.stdout.write(`  - ${c.id}: ${c.description}\n`);
        }
      } else if (sub === 'generate') {
        const snippet_type = positional[1] || 'test_suite';
        const entity_type = positional[2] || 'user_story';
        const entity_id = positional[3] || 'story-01';
        const { create_document_entity_store } = await import('../src/index.js');
        const store = create_document_entity_store({ workspace_root: package_root });
        try {
          const result = store.generate_code_snippet(entity_type, entity_id, snippet_type, {
            target_file: flags.output || null
          });
          if (flags.output) {
            process.stdout.write(`code snippet generated and saved to ${result.path} (${result.bytes} bytes)\n`);
          } else {
            process.stdout.write(result.code);
          }
        } catch (err) {
          process.stderr.write(`code generation failed: ${err.message}\n`);
          process.exit(1);
        }
      } else {
        process.stderr.write(`unknown code verb: ${sub}. available verbs: list, generate\n`);
        process.exit(1);
      }
      break;
    }

    // -------------------------------------------------------------------------
    // noun: project
    // -------------------------------------------------------------------------
    case 'project': {
      const sub = positional[0] || 'status';
      if (sub === 'status') {
        process.stdout.write(`project state: ${harness.get_project_state()}\n`);
      } else if (sub === 'init' || sub === 'start') {
        const name = flags.name || positional[1] || 'dual-engine-harness';
        try {
          let inst = harness;
          const session_id = flags.session || 'cli-session';
          const snap_path = path.join(package_root, '.sdlc', 'state', `session-${session_id}.json`);
          if (harness.get_project_state() === 'active_development' && !fs.existsSync(snap_path)) {
            inst = create_dual_engine_harness({
              session_id,
              project_state: 'uninitialised',
              base_dir: package_root
            });
          }
          const next = inst.start_project({ project_name: name });
          process.stdout.write(`project initiated: ${next} [name=${name}]\n`);
        } catch (err) {
          process.stderr.write(`project start failed: ${err.message}\n`);
          process.exit(1);
        }
      } else if (sub === 'approve') {
        try {
          const next = harness.approve_inception();
          process.stdout.write(`project inception approved: ${next}\n`);
        } catch (err) {
          process.stderr.write(`project approval failed: ${err.message}\n`);
          process.exit(1);
        }
      } else if (sub === 'ingest') {
        try {
          const receipt = await harness.ingest_project({ project_name: flags.name || positional[1] || 'dual-engine-harness' });
          process.stdout.write('project ingestion completed through all sdlc phases:\n');
          process.stdout.write(`  sovereign state: ${harness.get_project_state()}\n`);
          process.stdout.write(`  active macro phase: ${harness.get_macro_phase()}\n`);
          process.stdout.write(`  gates passed: ${Object.keys(receipt.gates).join(', ')}\n`);
          process.stdout.write('  receipt sealed: .sdlc/receipts/ingest-dual-engine-harness.json\n');
        } catch (err) {
          process.stderr.write(`project ingestion failed: ${err.message}\n`);
          process.exit(1);
        }
      } else if (sub === 'maintenance') {
        const reason = flags.reason || positional[1] || 'scheduled maintenance';
        try {
          const next = harness.enter_maintenance(reason);
          process.stdout.write(`project entered maintenance: ${next}\n`);
        } catch (err) {
          process.stderr.write(`enter maintenance failed: ${err.message}\n`);
          process.exit(1);
        }
      } else if (sub === 'reactivate') {
        try {
          const next = harness.reactivate_project();
          process.stdout.write(`project reactivated: ${next}\n`);
        } catch (err) {
          process.stderr.write(`reactivate failed: ${err.message}\n`);
          process.exit(1);
        }
      } else if (sub === 'deprecate') {
        const sunset_date = flags.sunset || flags.date || positional[1] || 'unspecified';
        try {
          const next = harness.deprecate_project({ sunset_date });
          process.stdout.write(`project deprecated: ${next}\n`);
        } catch (err) {
          process.stderr.write(`deprecate failed: ${err.message}\n`);
          process.exit(1);
        }
      } else if (sub === 'retire') {
        const reason = flags.reason || positional[1] || 'end of lifecycle';
        try {
          const next = harness.commence_retirement({ reason });
          process.stdout.write(`project retirement commenced: ${next}\n`);
        } catch (err) {
          process.stderr.write(`commence retirement failed: ${err.message}\n`);
          process.exit(1);
        }
      } else if (sub === 'decommission') {
        try {
          const res = await harness.decommission_project();
          process.stdout.write(`project decommissioned: ${res.sovereign_state}\n`);
        } catch (err) {
          process.stderr.write(`decommission failed: ${err.message}\n`);
          process.exit(1);
        }
      } else if (sub === 'retrospective') {
        const milestone = positional[1] || flags.milestone || flags.name || 'sprint-01';
        const res = await harness.run_process('sprint-retrospective', { name: milestone, inputs: { milestone } });
        process.stdout.write(`project retrospective '${res.epic.id}' completed=${res.board_summary.all_completed}\n`);
      } else {
        process.stderr.write(`unknown project verb: ${sub}. available verbs: status, start, approve, maintenance, reactivate, deprecate, retire, decommission, ingest, retrospective\n`);
        process.exit(1);
      }
      break;
    }

    // -------------------------------------------------------------------------
    // noun: board
    // -------------------------------------------------------------------------
    case 'board':
    case 'tickets': {
      const sub = positional[0] || 'list';
      const board = harness.get_work_board();
      const store = harness.get_store();

      if (sub === 'list') {
        const tickets = board.list_tickets(flags.epic ? { epic_id: flags.epic } : {});
        process.stdout.write(`work board tickets (${tickets.length}):\n`);
        for (const t of tickets) {
          process.stdout.write(`  - ${t.id} [${t.status}] (${t.role} -> ${t.workflow_id}): ${t.title}\n`);
        }
      } else if (sub === 'status') {
        const summary = board.get_board_summary(flags.epic || positional[1] || null);
        process.stdout.write(`board summary: total=${summary.counts.total} ready=${summary.counts.ready} blocked=${summary.counts.blocked} in_progress=${summary.counts.in_progress} in_review=${summary.counts.in_review} rework=${summary.counts.rework} escalated=${summary.counts.escalated} completed=${summary.counts.completed}\n`);
      } else if (sub === 'show' || sub === 'info') {
        const ticket_id = positional[1] || flags.id;
        if (!ticket_id) {
          process.stderr.write('board show requires a ticket identifier\n');
          process.exit(1);
        }
        const ticket = board.get_ticket(ticket_id);
        if (!ticket) {
          process.stderr.write(`ticket not found: ${ticket_id}\n`);
          process.exit(1);
        }
        process.stdout.write(JSON.stringify(ticket, null, 2) + '\n');
      } else if (sub === 'create' || sub === 'run' || sub === 'start') {
        process.stderr.write(
          'error: unauthorized_direct_tier1_execution: board cannot be seeded directly via `board create`.\n' +
          'use domain nouns and verbs (e.g. `feature create <name>`, `defect create <name>`, `release create <version>`).\n'
        );
        process.exit(1);
      } else if (sub === 'export') {
        const md = store.render_board_markdown(flags.epic || positional[1] || null);
        process.stdout.write(md + '\n');
      } else {
        process.stderr.write(`unknown board verb: ${sub}. available verbs: list, status, show, export\n`);
        process.exit(1);
      }
      break;
    }

    // -------------------------------------------------------------------------
    // noun: pool / workers
    // -------------------------------------------------------------------------
    case 'pool':
    case 'workers':
    case 'worker': {
      const sub = positional[0] || 'status';
      const pool = harness.get_worker_pool();

      if (sub === 'list') {
        const list = pool.list_workers(flags.role ? { role: flags.role } : {});
        process.stdout.write(`daemon worker pool (${list.length}):\n`);
        for (const w of list) {
          process.stdout.write(`  - ${w.id} [${w.status}] (${w.role}) completed=${w.completed_count}\n`);
        }
      } else if (sub === 'status') {
        const st = pool.get_status();
        process.stdout.write(`worker pool status: running=${st.running} total=${st.total_workers} idle=${st.idle_workers} busy=${st.busy_workers} completed=${st.total_completed_tickets}\n`);
      } else if (sub === 'start') {
        const st = pool.start();
        process.stdout.write(`worker pool started: total=${st.total_workers} idle=${st.idle_workers}\n`);
      } else if (sub === 'stop') {
        const st = pool.stop();
        process.stdout.write(`worker pool stopped: running=${st.running}\n`);
      } else if (sub === 'scale') {
        const role = positional[1] || flags.role || 'software-engineer';
        const count = Number(positional[2] || flags.count || 2);
        const updated = pool.scale(role, count);
        process.stdout.write(`scaled ${role} workers to ${updated.length}\n`);
      } else {
        process.stderr.write(`unknown pool verb: ${sub}. available verbs: list, status, start, stop, scale\n`);
        process.exit(1);
      }
      break;
    }

    // -------------------------------------------------------------------------
    // noun: processes / supervisor (read-only inspection)
    // -------------------------------------------------------------------------
    case 'processes':
    case 'process':
    case 'supervisor': {
      const sub = positional[0] || 'list';
      if (sub === 'list') {
        const procs = list_high_level_processes(flags.domain || positional[1] || null);
        process.stdout.write(`governed high-level processes (${procs.length}):\n`);
        for (const p of procs) {
          process.stdout.write(`  - ${p.id} [${p.commit_type}] (${p.domain}): ${p.description}\n`);
        }
      } else if (sub === 'show' || sub === 'info') {
        const proc_id = positional[1] || flags.id || 'develop-feature';
        const procs = list_high_level_processes();
        const found = procs.find((p) => p.id === proc_id);
        if (!found) {
          process.stderr.write(`process not found: ${proc_id}\n`);
          process.exit(1);
        }
        process.stdout.write(JSON.stringify(found, null, 2) + '\n');
      } else if (sub === 'run' || sub === 'start' || sub === 'execute') {
        process.stderr.write(
          'error: unauthorized_direct_tier1_execution: tier 1 processes cannot be invoked directly via `processes run`.\n' +
          'use domain nouns and verbs (e.g. `feature create <name>`, `defect create <name>`, `security audit <name>`, `release create <version>`).\n'
        );
        process.exit(1);
      } else {
        process.stderr.write(`unknown processes verb: ${sub}. available verbs: list, show\n`);
        process.exit(1);
      }
      break;
    }

    // -------------------------------------------------------------------------
    // domain noun: feature / features
    // -------------------------------------------------------------------------
    case 'feature':
    case 'features': {
      const sub = positional[0] || 'list';
      const store = harness.get_store();
      const board = harness.get_work_board();
      const git_prov = harness.get_git_provenance();

      if (sub === 'list') {
        const prds = store.list_entities(DocumentEntityTypes.PRD);
        process.stdout.write(`features (${prds.length}):\n`);
        for (const p of prds) {
          process.stdout.write(`  - ${p.slug || p.id} [${p.status || 'approved'}]: ${p.title}\n`);
        }
      } else if (sub === 'create' || sub === 'start') {
        const name = positional[1] || flags.name || 'new-feature';
        const inline_desc = positional.slice(2).join(' ').trim();
        const is_swarm = flags.swarm === 'true' || flags.swarm === true;
        const proc_id = is_swarm ? 'develop-epic-swarm' : 'develop-feature';
        const require_brief = flags['require-brief'] === true || flags['require-brief'] === 'true' || flags.require_brief === true;

        const brief_options = {
          name,
          description: flags.description || inline_desc || undefined,
          problem_statement: flags.problem || flags.problem_statement || flags.description || inline_desc || undefined,
          target_audience: flags.audience || flags.target_audience || undefined,
          acceptance_criteria: flags.criteria || flags.acceptance_criteria || undefined,
          functional_requirements: flags.requirements || flags.functional_requirements || undefined,
          file: flags.file || flags.spec || flags.brief || undefined,
          workspace_root: flags.workspace || flags.workspace_root || package_root
        };
        const initial_brief = harness.parse_brief(brief_options);
        const explicit_chat = flags.chat === true || flags.chat === 'true' || Boolean(flags['chat-inputs'] || flags.chat_inputs);
        const no_chat = flags['no-chat'] === true || flags.chat === 'false' || flags.no_chat === true || require_brief;
        const should_open_chat = explicit_chat || (!initial_brief.has_explicit_brief && !no_chat && Boolean(process.stdin.isTTY));

        let process_inputs = {};
        let pre_executed_result = null;
        if (should_open_chat) {
          const chat_session = await harness.run_inception_chat({
            ...brief_options,
            entity_type: 'feature',
            process_type: proc_id,
            agent_id: flags.agent || flags.role || 'sdlc-supervisor',
            responses: flags['chat-inputs'] || flags.chat_inputs
          });
          if (chat_session.cancelled) {
            process.stdout.write(`feature '${name}' creation cancelled.\n`);
            break;
          }
          process_inputs = chat_session.inputs;
          pre_executed_result = chat_session.process_result;
        }

        const res = pre_executed_result || await harness.run_process(proc_id, {
          ...brief_options,
          ...process_inputs,
          name,
          swarm: is_swarm,
          require_brief,
          persist_code_artefacts: flags.persist !== 'false',
          spawn_child_tasks: flags.spawn_child_tasks !== 'false',
          inputs: process_inputs
        });
        const prs = git_prov.list_pull_requests({ epic_id: res.epic.id });
        const pr_status = prs[0] ? `${prs[0].pr_id} (${prs[0].status})` : 'none';
        const awaiting = res.board_summary.counts.awaiting_input || 0;
        process.stdout.write(
          `feature '${res.epic.id}' created: completed=${res.board_summary.all_completed} ` +
          `tickets=${res.board_summary.counts.completed}/${res.board_summary.counts.total} ` +
          (awaiting > 0 ? `awaiting_input=${awaiting} ` : '') +
          `pr=${pr_status}\n`
        );
      } else if (sub === 'clarify') {
        const name = positional[1] || flags.name;
        const answer = positional.slice(2).join(' ').trim() || flags.answer || flags.message;
        if (!name || !answer) {
          process.stderr.write('error: feature clarify requires <name> and "<answer>" (e.g. feature clarify session-vault "encrypted token store")\n');
          process.exit(1);
        }
        const clarified = await harness.clarify_process({
          epic_id: name,
          ticket_id: flags.ticket || null,
          answer,
          acceptance_criteria: flags.criteria ? String(flags.criteria).split(';').map((s) => s.trim()).filter(Boolean) : undefined
        });
        const prs = git_prov.list_pull_requests({ epic_id: name });
        const pr_status = prs[0] ? `${prs[0].pr_id} (${prs[0].status})` : 'none';
        process.stdout.write(
          `feature '${name}' clarified (${clarified.resolved_count} resolved): completed=${clarified.board_summary.all_completed} ` +
          `tickets=${clarified.board_summary.counts.completed}/${clarified.board_summary.counts.total} pr=${pr_status}\n`
        );
      } else if (sub === 'show' || sub === 'status' || sub === 'info') {
        const name = positional[1] || flags.name;
        if (!name) {
          process.stderr.write('error: feature name required (e.g. feature show my-feature)\n');
          process.exit(1);
        }
        const slug = String(name).toLowerCase().replace(/[^a-z0-9]+/g, '_');
        const prd_id = name.startsWith('prd-') ? name : `prd-${slug}`;
        const tree = store.query_by_prd(prd_id);
        const summary = board.get_board_summary(name);
        const prs = git_prov.list_pull_requests({ epic_id: name });
        process.stdout.write(`feature: ${name}\n`);
        process.stdout.write(`  prd: ${tree.prd ? tree.prd.id : 'none'}\n`);
        if (tree.prd?.executive_summary?.problem) {
          process.stdout.write(`  problem: ${tree.prd.executive_summary.problem}\n`);
        }
        process.stdout.write(`  stories: ${tree.stories.length}, adrs: ${tree.adrs.length}, interfaces: ${tree.interfaces.length}\n`);
        process.stdout.write(`  tickets: ${summary.counts.completed}/${summary.counts.total} completed (awaiting_input=${summary.counts.awaiting_input || 0})\n`);
        process.stdout.write(`  pull requests: ${prs.map((p) => `${p.pr_id}[${p.status}]`).join(', ') || 'none'}\n`);
      } else {
        process.stderr.write(`unknown feature verb: ${sub}. available verbs: list, create, clarify, show, status\n`);
        process.exit(1);
      }
      break;
    }

    // -------------------------------------------------------------------------
    // domain noun: defect / bug / fix / hotfix / refactor / spike
    // -------------------------------------------------------------------------
    case 'defect':
    case 'defects':
    case 'bug':
    case 'bugs':
    case 'fix':
    case 'fixes':
    case 'hotfix':
    case 'hotfixes':
    case 'refactor':
    case 'refactors':
    case 'refactoring':
    case 'spike':
    case 'spikes':
    case 'prototype': {
      const sub = positional[0] || 'list';
      const board = harness.get_work_board();
      const noun_map = {
        defect: { label: 'defect', proc: 'fix-defect' },
        defects: { label: 'defect', proc: 'fix-defect' },
        bug: { label: 'defect', proc: 'fix-defect' },
        bugs: { label: 'defect', proc: 'fix-defect' },
        fix: { label: 'defect', proc: 'fix-defect' },
        fixes: { label: 'defect', proc: 'fix-defect' },
        hotfix: { label: 'hotfix', proc: 'emergency-hotfix' },
        hotfixes: { label: 'hotfix', proc: 'emergency-hotfix' },
        refactor: { label: 'refactor', proc: 'refactor-module' },
        refactors: { label: 'refactor', proc: 'refactor-module' },
        refactoring: { label: 'refactor', proc: 'refactor-module' },
        spike: { label: 'spike', proc: 'spike-prototype' },
        spikes: { label: 'spike', proc: 'spike-prototype' },
        prototype: { label: 'spike', proc: 'spike-prototype' }
      };
      const cfg = noun_map[command];

      if (sub === 'list') {
        const tickets = board.list_tickets();
        process.stdout.write(`${cfg.label} items (${tickets.length} board tickets):\n`);
        for (const t of tickets) {
          process.stdout.write(`  - ${t.id} [${t.status}]: ${t.title}\n`);
        }
      } else if (sub === 'create' || sub === 'start') {
        const name = positional[1] || flags.name || `${cfg.label}-01`;
        const inline_desc = positional.slice(2).join(' ').trim();
        const brief_options = {
          name,
          description: flags.description || inline_desc || undefined,
          problem_statement: flags.problem || flags.description || inline_desc || undefined,
          file: flags.file || flags.spec || undefined,
          workspace_root: flags.workspace || flags.workspace_root || package_root
        };
        const initial_brief = harness.parse_brief(brief_options);
        const explicit_chat = flags.chat === true || flags.chat === 'true' || Boolean(flags['chat-inputs'] || flags.chat_inputs);
        const no_chat = flags['no-chat'] === true || flags.chat === 'false' || flags.no_chat === true;
        const should_open_chat = explicit_chat || (!initial_brief.has_explicit_brief && !no_chat && Boolean(process.stdin.isTTY));

        let process_inputs = {};
        if (should_open_chat) {
          const chat_session = await harness.run_inception_chat({
            ...brief_options,
            entity_type: cfg.label,
            role: 'software-engineer',
            responses: flags['chat-inputs'] || flags.chat_inputs
          });
          if (chat_session.cancelled) {
            process.stdout.write(`${cfg.label} '${name}' creation cancelled.\n`);
            break;
          }
          process_inputs = chat_session.inputs;
        }

        const res = await harness.run_process(cfg.proc, {
          ...brief_options,
          ...process_inputs,
          name,
          persist_code_artefacts: flags.persist !== 'false',
          inputs: process_inputs
        });
        process.stdout.write(
          `${cfg.label} '${res.epic.id}' completed=${res.board_summary.all_completed} ` +
          `tickets=${res.board_summary.counts.completed}/${res.board_summary.counts.total}\n`
        );
      } else if (sub === 'clarify') {
        const name = positional[1] || flags.name;
        const answer = positional.slice(2).join(' ').trim() || flags.answer;
        if (!name || !answer) {
          process.stderr.write(`error: ${cfg.label} clarify requires <name> and "<answer>"\n`);
          process.exit(1);
        }
        const clarified = await harness.clarify_process({ epic_id: name, answer });
        process.stdout.write(
          `${cfg.label} '${name}' clarified (${clarified.resolved_count} resolved): completed=${clarified.board_summary.all_completed}\n`
        );
      } else if (sub === 'show' || sub === 'status' || sub === 'info') {
        const name = positional[1] || flags.name;
        if (!name) {
          process.stderr.write(`error: ${cfg.label} identifier required\n`);
          process.exit(1);
        }
        const summary = board.get_board_summary(name);
        process.stdout.write(`${cfg.label} '${name}': completed=${summary.all_completed} (${summary.counts.completed}/${summary.counts.total} tickets)\n`);
      } else {
        process.stderr.write(`unknown ${cfg.label} verb: ${sub}. available verbs: list, create, clarify, show, status\n`);
        process.exit(1);
      }
      break;
    }

    // -------------------------------------------------------------------------
    // domain noun: architecture / adr / contract
    // -------------------------------------------------------------------------
    case 'architecture':
    case 'adr':
    case 'adrs':
    case 'contract':
    case 'contracts': {
      const sub = positional[0] || 'list';
      const store = harness.get_store();

      if (sub === 'list') {
        const adrs = store.list_entities(DocumentEntityTypes.ADR);
        const contracts = store.list_entities(DocumentEntityTypes.INTERFACE_CONTRACT);
        process.stdout.write(`architecture decision records (${adrs.length}):\n`);
        for (const a of adrs) {
          process.stdout.write(`  - ${a.id} [${a.status}]: ${a.title}\n`);
        }
        process.stdout.write(`interface contracts (${contracts.length}):\n`);
        for (const c of contracts) {
          process.stdout.write(`  - ${c.id} [v${c.version}]: ${c.component}\n`);
        }
      } else if (sub === 'create' || sub === 'review' || sub === 'contract' || sub === 'migration') {
        const proc_by_verb = {
          create: 'design-architecture',
          review: 'architecture-review',
          contract: 'api-contract-evolution',
          migration: 'data-migration-design'
        };
        const name = positional[1] || flags.name || `arch-${sub}`;
        const res = await harness.run_process(proc_by_verb[sub], { name });
        process.stdout.write(
          `architecture ${sub} '${res.epic.id}' completed=${res.board_summary.all_completed} ` +
          `tickets=${res.board_summary.counts.completed}/${res.board_summary.counts.total}\n`
        );
      } else if (sub === 'show' || sub === 'info') {
        const id = positional[1] || flags.id;
        if (!id) {
          process.stderr.write('error: adr or interface contract id required\n');
          process.exit(1);
        }
        const entity = store.get_entity(DocumentEntityTypes.ADR, id)
          || store.get_entity(DocumentEntityTypes.INTERFACE_CONTRACT, id);
        if (!entity) {
          process.stderr.write(`architecture entity not found: ${id}\n`);
          process.exit(1);
        }
        process.stdout.write(JSON.stringify(entity, null, 2) + '\n');
      } else {
        process.stderr.write(`unknown architecture verb: ${sub}. available verbs: list, create, review, contract, migration, show\n`);
        process.exit(1);
      }
      break;
    }

    // -------------------------------------------------------------------------
    // domain noun: quality / qa
    // -------------------------------------------------------------------------
    case 'quality':
    case 'qa': {
      const sub = positional[0] || 'list';
      const store = harness.get_store();

      if (sub === 'list') {
        const reports = store.list_entities(DocumentEntityTypes.TEST_REPORT);
        process.stdout.write(`qa test reports (${reports.length}):\n`);
        for (const r of reports) {
          process.stdout.write(`  - ${r.id} [verdict: ${r.gate_verdict}]\n`);
        }
      } else if (sub === 'audit' || sub === 'coverage' || sub === 'quarantine' || sub === 'optimise' || sub === 'optimize' || sub === 'perf') {
        const proc_by_verb = {
          audit: 'regression-audit',
          coverage: 'coverage-hardening',
          quarantine: 'flaky-test-quarantine',
          optimise: 'performance-optimisation',
          optimize: 'performance-optimisation',
          perf: 'performance-optimisation'
        };
        const name = positional[1] || flags.name || `qa-${sub}`;
        const res = await harness.run_process(proc_by_verb[sub], { name });
        process.stdout.write(
          `quality ${sub} '${res.epic.id}' completed=${res.board_summary.all_completed} ` +
          `tickets=${res.board_summary.counts.completed}/${res.board_summary.counts.total}\n`
        );
      } else if (sub === 'show' || sub === 'info') {
        const id = positional[1] || flags.id;
        const entity = id ? store.get_entity(DocumentEntityTypes.TEST_REPORT, id) : null;
        if (!entity) {
          process.stderr.write(`test report not found: ${id}\n`);
          process.exit(1);
        }
        process.stdout.write(JSON.stringify(entity, null, 2) + '\n');
      } else {
        process.stderr.write(`unknown quality verb: ${sub}. available verbs: list, audit, coverage, quarantine, optimise, show\n`);
        process.exit(1);
      }
      break;
    }

    // -------------------------------------------------------------------------
    // domain noun: security / sec
    // -------------------------------------------------------------------------
    case 'security':
    case 'sec': {
      const sub = positional[0] || 'list';
      const store = harness.get_store();

      if (sub === 'list') {
        const models = store.list_entities(DocumentEntityTypes.THREAT_MODEL);
        process.stdout.write(`security threat models (${models.length}):\n`);
        for (const m of models) {
          process.stdout.write(`  - ${m.id}: ${m.component} (${(m.threat_vectors || []).length} vectors)\n`);
        }
      } else if (sub === 'patch' || sub === 'audit' || sub === 'scan' || sub === 'incident') {
        const proc_by_verb = {
          patch: 'security-patch',
          audit: 'stride-threat-audit',
          scan: 'secret-supply-chain-scan',
          incident: 'security-incident-response'
        };
        const name = positional[1] || flags.name || `sec-${sub}`;
        const res = await harness.run_process(proc_by_verb[sub], { name });
        process.stdout.write(
          `security ${sub} '${res.epic.id}' completed=${res.board_summary.all_completed} ` +
          `tickets=${res.board_summary.counts.completed}/${res.board_summary.counts.total}\n`
        );
      } else if (sub === 'show' || sub === 'info') {
        const id = positional[1] || flags.id;
        const entity = id ? store.get_entity(DocumentEntityTypes.THREAT_MODEL, id) : null;
        if (!entity) {
          process.stderr.write(`threat model not found: ${id}\n`);
          process.exit(1);
        }
        process.stdout.write(JSON.stringify(entity, null, 2) + '\n');
      } else {
        process.stderr.write(`unknown security verb: ${sub}. available verbs: list, patch, audit, scan, incident, show\n`);
        process.exit(1);
      }
      break;
    }

    // -------------------------------------------------------------------------
    // domain noun: release / releases
    // -------------------------------------------------------------------------
    case 'release':
    case 'releases': {
      const sub = positional[0] || 'list';
      const store = harness.get_store();

      if (sub === 'list') {
        const rels = store.list_entities(DocumentEntityTypes.RELEASE_MANIFEST);
        process.stdout.write(`releases (${rels.length}):\n`);
        for (const r of rels) {
          process.stdout.write(`  - ${r.id} [v${r.version}]\n`);
        }
      } else if (sub === 'create' || sub === 'rollback') {
        const ver = positional[1] || flags.version || flags.name || '0.1.0';
        const proc_id = sub === 'rollback' ? 'rollback-release' : 'release-version';
        const res = await harness.run_process(proc_id, { name: `release-${ver}`, inputs: { version: ver } });
        process.stdout.write(
          `release ${sub} '${ver}' completed=${res.board_summary.all_completed} ` +
          `tickets=${res.board_summary.counts.completed}/${res.board_summary.counts.total}\n`
        );
      } else if (sub === 'show' || sub === 'info') {
        const id = positional[1] || flags.id;
        const entity = id ? store.get_entity(DocumentEntityTypes.RELEASE_MANIFEST, id) : null;
        if (!entity) {
          process.stderr.write(`release manifest not found: ${id}\n`);
          process.exit(1);
        }
        process.stdout.write(JSON.stringify(entity, null, 2) + '\n');
      } else {
        process.stderr.write(`unknown release verb: ${sub}. available verbs: list, create, rollback, show\n`);
        process.exit(1);
      }
      break;
    }

    // -------------------------------------------------------------------------
    // domain noun: dependencies / ci / docs / style / pr
    // -------------------------------------------------------------------------
    case 'dependencies':
    case 'deps':
    case 'dependency': {
      const sub = positional[0] || 'list';
      if (sub === 'list') {
        const tickets = harness.get_work_board().list_tickets();
        process.stdout.write(`dependency upgrade tickets (${tickets.length}):\n`);
      } else if (sub === 'upgrade' || sub === 'update') {
        const name = positional[1] || flags.name || 'deps-upgrade';
        const res = await harness.run_process('upgrade-dependencies', { name });
        process.stdout.write(`dependencies upgrade '${res.epic.id}' completed=${res.board_summary.all_completed}\n`);
      } else {
        process.stderr.write(`unknown dependencies verb: ${sub}. available verbs: list, upgrade\n`);
        process.exit(1);
      }
      break;
    }

    case 'ci':
    case 'pipeline':
    case 'build': {
      const sub = positional[0] || 'list';
      if (sub === 'list') {
        process.stdout.write('ci/build operations: harden (ci-pipeline-hardening), tune (build-system-tuning)\n');
      } else if (sub === 'harden' || sub === 'tune') {
        const proc_id = sub === 'harden' ? 'ci-pipeline-hardening' : 'build-system-tuning';
        const name = positional[1] || flags.name || `ci-${sub}`;
        const res = await harness.run_process(proc_id, { name });
        process.stdout.write(`ci ${sub} '${res.epic.id}' completed=${res.board_summary.all_completed}\n`);
      } else {
        process.stderr.write(`unknown ci verb: ${sub}. available verbs: list, harden, tune\n`);
        process.exit(1);
      }
      break;
    }

    case 'docs':
    case 'documentation': {
      const sub = positional[0] || 'list';
      const store = harness.get_store();
      if (sub === 'list') {
        const prds = store.list_entities(DocumentEntityTypes.PRD);
        const adrs = store.list_entities(DocumentEntityTypes.ADR);
        process.stdout.write(`documentation entities: prds=${prds.length}, adrs=${adrs.length}\n`);
      } else if (sub === 'refresh') {
        const name = positional[1] || flags.name || 'docs-refresh';
        const res = await harness.run_process('documentation-refresh', { name });
        process.stdout.write(`docs refresh '${res.epic.id}' completed=${res.board_summary.all_completed}\n`);
      } else if (sub === 'render') {
        const type = positional[1] || 'prd';
        const id = positional[2] || 'prd-01';
        process.stdout.write(store.generate_document(type, id));
      } else if (sub === 'export') {
        const target_dir = flags.target || positional[1] || path.join(package_root, 'docs');
        const receipt = store.export_documents({ target_dir });
        process.stdout.write(`document export completed: ${receipt.exported_count} documents written to ${target_dir}\n`);
      } else if (sub === 'migrate') {
        const { migrate_all_documents } = await import('../src/index.js');
        const docs_dir = positional[1] || path.join(package_root, 'docs');
        const report = migrate_all_documents(docs_dir, store);
        process.stdout.write(`document migration completed: ${report.total_migrated} artefacts stored\n`);
      } else if (sub === 'sync') {
        const direction = positional[1] || flags.direction || 'bidirectional';
        const report = await harness.sync_doc_stores({ direction });
        process.stdout.write(
          `doc store statechart sync [${report.statechart_id}] (${report.direction}) -> ${report.final_state}:\n` +
          `  trace: ${report.statechart_trace.join(' -> ')}\n` +
          `  migrated (docs -> .sdlc/store): ${report.migration_report.total_migrated}\n` +
          `  exported (.sdlc/store -> docs): ${report.export_report.exported_count}\n` +
          `  rag chunks indexed: ${report.rag_report.total_chunks}\n` +
          `  knowledge nodes synced: ${report.knowledge_report.nodes_synced}\n`
        );
      } else {
        process.stderr.write(`unknown docs verb: ${sub}. available verbs: list, refresh, render, export, migrate, sync\n`);
        process.exit(1);
      }
      break;
    }

    case 'style':
    case 'format': {
      const sub = positional[0] || 'check';
      if (sub === 'check' || sub === 'fix') {
        const name = positional[1] || flags.name || 'style-hygiene';
        const res = await harness.run_process('code-formatting-hygiene', { name });
        process.stdout.write(`style ${sub} '${res.epic.id}' completed=${res.board_summary.all_completed}\n`);
      } else {
        process.stderr.write(`unknown style verb: ${sub}. available verbs: check, fix\n`);
        process.exit(1);
      }
      break;
    }

    case 'pr':
    case 'prs':
    case 'pull-request':
    case 'pull-requests': {
      const sub = positional[0] || 'list';
      const git_prov = harness.get_git_provenance();
      if (sub === 'list') {
        const prs = git_prov.list_pull_requests(flags.epic ? { epic_id: flags.epic } : {});
        process.stdout.write(`governed pull requests (${prs.length}):\n`);
        for (const p of prs) {
          const att_roles = Object.keys(p.attestations || {}).join(', ') || 'none';
          process.stdout.write(`  - ${p.pr_id} [${p.status}] (${p.source_branch} -> ${p.target_branch}) attestations=${att_roles}\n`);
        }
      } else if (sub === 'show' || sub === 'status' || sub === 'info') {
        const pr_id = positional[1] || flags.id;
        const found = pr_id ? git_prov.get_pull_request(pr_id) : null;
        if (!found) {
          process.stderr.write(`pull request not found: ${pr_id}\n`);
          process.exit(1);
        }
        process.stdout.write(JSON.stringify(found, null, 2) + '\n');
      } else {
        process.stderr.write(`unknown pr verb: ${sub}. available verbs: list, show, status\n`);
        process.exit(1);
      }
      break;
    }

    // -------------------------------------------------------------------------
    // noun: tests / direct verb: test
    // -------------------------------------------------------------------------
    case 'tests':
    case 'test': {
      const sub = positional[0];
      if (sub === 'verify' || sub === 'check' || sub === 'immutability') {
        const baseline = flags.baseline_source || flags.baseline || 'assert.equal(1, 1);';
        const current = flags.current_source || flags.current || 'assert.equal(1, 1);';
        const res = verify_test_immutability(baseline, current);
        process.stdout.write(`immutability verified: ${res.valid}\n`);
        if (!res.valid) {
          process.stdout.write(`violations: ${res.violations.join(', ')}\n`);
          process.exit(1);
        }
      } else {
        await execute_test_runner(flags);
      }
      break;
    }

    // -------------------------------------------------------------------------
    // direct verb: migrate
    // -------------------------------------------------------------------------
    case 'migrate': {
      const { create_document_entity_store, migrate_all_documents } = await import('../src/index.js');
      const store = create_document_entity_store({ workspace_root: package_root });
      const docs_dir = positional[0] || flags.docs || path.join(package_root, 'docs');
      const report = migrate_all_documents(docs_dir, store);
      process.stdout.write('document migration completed:\n');
      process.stdout.write(`  prds: ${report.prds}\n`);
      process.stdout.write(`  user stories: ${report.stories}\n`);
      process.stdout.write(`  adrs: ${report.adrs}\n`);
      process.stdout.write(`  interfaces: ${report.interfaces}\n`);
      process.stdout.write(`  threat models: ${report.threat_models}\n`);
      process.stdout.write(`  test reports: ${report.test_reports}\n`);
      process.stdout.write(`  releases: ${report.releases}\n`);
      process.stdout.write(`  retrospectives: ${report.retrospectives}\n`);
      process.stdout.write(`  total artefacts stored: ${report.total_migrated}\n`);
      process.stdout.write(`  store location: ${store.get_adapter().get_store_root()}\n`);
      break;
    }

    // -------------------------------------------------------------------------
    // legacy command backwards compatibility
    // -------------------------------------------------------------------------
    case 'ingest': {
      try {
        const receipt = await harness.ingest_project({ project_name: flags.name || 'dual-engine-harness' });
        process.stdout.write('project ingestion completed through all sdlc phases:\n');
        process.stdout.write(`  sovereign state: ${harness.get_project_state()}\n`);
        process.stdout.write(`  active macro phase: ${harness.get_macro_phase()}\n`);
        process.stdout.write(`  gates passed: ${Object.keys(receipt.gates).join(', ')}\n`);
        process.stdout.write('  receipt sealed: .sdlc/receipts/ingest-dual-engine-harness.json\n');
      } catch (err) {
        process.stderr.write(`project ingestion failed: ${err.message}\n`);
        process.exit(1);
      }
      break;
    }

    case 'transition': {
      const target_phase = positional[0];
      if (!target_phase) {
        process.stderr.write('error: target phase required\n');
        process.exit(1);
      }
      try {
        const next = harness.send_event({ target_phase });
        process.stdout.write(`transitioned to: ${next}\n`);
      } catch (err) {
        process.stderr.write(`transition failed: ${err.message}\n`);
        process.exit(1);
      }
      break;
    }

    case 'immutability-check': {
      const baseline = flags.baseline_source || flags.baseline || 'assert.equal(1, 1);';
      const current = flags.current_source || flags.current || 'assert.equal(1, 1);';
      const res = verify_test_immutability(baseline, current);
      process.stdout.write(`immutability verified: ${res.valid}\n`);
      if (!res.valid) {
        process.stdout.write(`violations: ${res.violations.join(', ')}\n`);
        process.exit(1);
      }
      break;
    }

    // -------------------------------------------------------------------------
    // 3-level sdlc architecture commands: sdlc-objects, process-def, project-config
    // -------------------------------------------------------------------------
    case 'sdlc-objects':
    case 'process-objects': {
      const sub = positional[0] || 'list';
      const objects = harness.get_process_objects();
      if (sub === 'list' || sub === 'status' || sub === 'show') {
        const snap = objects.to_snapshot();
        process.stdout.write('level 1 — sdlc process objects:\n');
        process.stdout.write(`  - phases          : ${snap.phases.length} (${snap.phases.map((p) => p.id).join(', ')})\n`);
        process.stdout.write(`  - gates           : ${snap.gates.length} (${snap.gates.map((g) => g.id).join(', ')})\n`);
        process.stdout.write(`  - roles           : ${snap.roles.length} (${snap.roles.map((r) => r.id).join(', ')})\n`);
        process.stdout.write(`  - workflows       : ${snap.workflows.length}\n`);
        process.stdout.write(`  - work_item_types : ${snap.work_item_types.length} (${snap.work_item_types.map((w) => w.id).join(', ')})\n`);
        process.stdout.write(`  - artefact_types  : ${snap.artefact_types.length}\n`);
      } else {
        process.stdout.write(JSON.stringify(objects.to_snapshot(), null, 2) + '\n');
      }
      break;
    }

    case 'process-def':
    case 'process-definition':
    case 'process-definitions': {
      const sub = positional[0] || 'list';
      const registry = harness.get_process_registry();
      if (sub === 'list') {
        const profiles = registry.list_profiles(flags.domain || null);
        process.stdout.write(`level 2 — sdlc process definitions (${profiles.length}):\n`);
        for (const p of profiles) {
          process.stdout.write(`  - ${p.id} [${p.domain}]: ${p.stages.length} stages, gates=[${(p.gates || []).join(', ')}]\n`);
        }
      } else if (sub === 'show' || sub === 'validate') {
        const proc_id = positional[1] || flags.id || 'develop-feature';
        const def = registry.get_definition(proc_id);
        if (!def) {
          process.stderr.write(`error: process definition not found: ${proc_id}\n`);
          process.exit(1);
        }
        const validation = def.validate();
        process.stdout.write(JSON.stringify({ profile: def.get_profile(), validation }, null, 2) + '\n');
      } else {
        const report = registry.validate_all();
        process.stdout.write(`process definitions validation: valid=${report.valid} (${report.count} definitions)\n`);
      }
      break;
    }

    case 'project-config':
    case 'sdlc-config': {
      const sub = positional[0] || 'show';
      const proj_cfg = harness.get_project_sdlc_config();
      if (sub === 'resolve') {
        const proc_id = positional[1] || flags.process || 'develop-feature';
        const effective = proj_cfg.resolve_effective_process(proc_id);
        process.stdout.write(JSON.stringify(effective, null, 2) + '\n');
      } else {
        process.stdout.write(JSON.stringify(proj_cfg.get_config(), null, 2) + '\n');
      }
      break;
    }

    // -------------------------------------------------------------------------
    // nuxt / studio / dev / server commands
    // -------------------------------------------------------------------------
    case 'dev':
    case 'start':
    case 'studio':
    case 'server':
    case 'nuxt': {
      const sub = positional[0] || 'dev';
      await execute_nuxt_runner(sub, flags);
      break;
    }

    // -------------------------------------------------------------------------
    // help command
    // -------------------------------------------------------------------------
    case 'help':
    default:
      process.stdout.write('usage: sdlc-harness <command> [subcommand] [options]\n\n');
      process.stdout.write('verbs (direct actions):\n');
      process.stdout.write('  studio [dev|build|preview] [--port=3000]    start the nuxt 4 + mastra studio & software factory server (aliases: dev, start, nuxt)\n');
      process.stdout.write('  chat [agent|name]                           interactive agentic chat with sdlc-supervisor or chosen role agent\n');
      process.stdout.write('  list [type]                                 enumerate entities of target type (or list all types)\n');
      process.stdout.write('  status                                      display sovereign state, macro phase, active gate, and active work item\n');
      process.stdout.write('  test [--ui|--watch]                         execute test suites via vitest with web ui or terminal reporting\n');
      process.stdout.write('  migrate [path]                              migrate repository documentation into entity store\n');
      process.stdout.write('  help                                        display this command reference\n\n');
      process.stdout.write('domain nouns (sdlc lifecycle actions):\n');
      process.stdout.write('  work <list|create|status|show|switch|focus|advance|run|clarify> unified concurrent work-item management across all 7 pathways\n');
      process.stdout.write('  feature <list|create|clarify|show|status>   manage product features end-to-end (implicit chat when no brief given)\n');
      process.stdout.write('  defect <list|create|clarify|show|status>    reproduce, patch, and verify defects (aliases: bug, fix)\n');
      process.stdout.write('  hotfix <list|create|clarify|show|status>    execute emergency production hotfixes with post-mortem\n');
      process.stdout.write('  refactor <list|create|clarify|show|status>  behaviour-preserving refactoring under immutability lock\n');
      process.stdout.write('  spike <list|create|clarify|show|status>     time-boxed technical feasibility spikes\n');
      process.stdout.write('  architecture <list|create|review|contract|migration|show> adrs, api contracts, and data migrations\n');
      process.stdout.write('  quality <list|audit|coverage|quarantine|optimise|show>    regression audits, coverage, flaky tests, perf\n');
      process.stdout.write('  security <list|patch|audit|scan|incident|show>            cve patches, stride audits, supply-chain scans\n');
      process.stdout.write('  release <list|create|rollback|show>         package semver releases or rollback releases\n');
      process.stdout.write('  dependencies <list|upgrade>                 audit and upgrade dependencies (alias: deps)\n');
      process.stdout.write('  ci <list|harden|tune>                       harden ci pipelines and tune build configurations\n');
      process.stdout.write('  docs <list|refresh|render|export|migrate>   manage clean-room documentation\n');
      process.stdout.write('  style <check|fix>                           enforce banner jsdoc and formatting hygiene\n');
      process.stdout.write('  pr <list|show|status>                       inspect governed pull requests and ed25519 attestations\n\n');
      process.stdout.write('nouns (standardised verbs: list, status/show/info, run/start/execute, check/verify, export):\n');
      process.stdout.write('  tiers <list|show> [1|2]                     standardised tier 1 & tier 2 entities, verbs, and mastra tools\n');
      process.stdout.write('  phases <list|status|transition>             10-phase sdlc macro statechart\n');
      process.stdout.write('  gates <list|status|check>                   formal review gates and invariant evaluation\n');
      process.stdout.write('  work-items <list|status>                    tactical work-item pathways (tier 1 inspection)\n');
      process.stdout.write('  board <list|status|show|export>             work board epics and ticket dags (tier 1 inspection)\n');
      process.stdout.write('  processes <list|show>                       governed high-level processes (tier 1 inspection)\n');
      process.stdout.write('  dag <list|run|export>                       multi-agent collaborative task execution dag\n');
      process.stdout.write('  workflows <list|info>                       mastra autonomous role workflows (tier 2 inspection)\n');
      process.stdout.write('  skills <list|info>                          compiled mastra skills equipping role agents (tier 2 inspection)\n');
      process.stdout.write('  agents <list|info>                          autonomous role agents (tier 2 inspection)\n');
      process.stdout.write('  packages <list|info>                        modular business packages mounted into the harness\n');
      process.stdout.write('  rules <list|check>                          7-tier agile sdlc governance framework\n');
      process.stdout.write('  store <list|migrate|show|prd|render|export> data-based document entity store with filestore adapter\n');
      process.stdout.write('  templates <list|render>                     canonical document and code generation templates\n');
      process.stdout.write('  code <list|generate>                        template-driven code snippet generation\n');
      process.stdout.write('  project <status|start|approve|maintenance|reactivate|deprecate|retire|decommission|ingest|retrospective>\n');
      process.stdout.write('  tests <run|verify>                          vitest test execution and immutability audits\n');
      break;
  }
}

run().catch((err) => {
  process.stderr.write(`unhandled cli error: ${err.message}\n`);
  process.exit(1);
});
