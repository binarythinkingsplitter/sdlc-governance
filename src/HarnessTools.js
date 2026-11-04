/**
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: mastra engineering tools for dual-engine sdlc development harness
 * verbose: provides genuine mastra tools for running test suites, writing verified artefacts,
 * auditing test immutability, and inspecting working tree status using createTool from @mastra/core/tools.
 * 
 * section: arguments
 * - options (object, optional): configuration options
 * 
 * section: return value
 * - tools (object): dictionary of compiled mastra tools
 * 
 * section: example
 * import { create_harness_tools } from './HarnessTools.js';
 * const tools = create_harness_tools();
 * const res = await tools.test_runner.execute({ context: { command: 'node --test' } });
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { z } from 'zod';
import { createTool } from '@mastra/core/tools';
import { Workspace, LocalFilesystem, LocalSandbox, createWorkspaceTools } from '@mastra/core/workspace';
import { verify_test_immutability } from './TestImmutabilityVerifier.js';
import { SupervisorRequestContextSchema } from './HarnessProcessors.js';
import { create_document_entity_store } from './DocumentEntityStore.js';
import { resolve_harness_knowledge } from './MastraMemoryStorage.js';
import { create_doc_store_sync_statechart } from './MacroStatechartEngine.js';
import { migrate_all_documents } from './DocumentMigrator.js';

/**
 * section: version number
 * version: 0.1.0
 *
 * section: documentation
 * tldr: creates a native mastra Workspace combining LocalFilesystem and LocalSandbox
 * verbose: instantiates @mastra/core/workspace Workspace with bm25 search and before-tool
 * hooks that forbid direct specialist access to .sdlc/store.
 *
 * section: arguments
 * - options (object, optional): workspace configuration (base_path, read_only, enable_sandbox)
 *
 * section: return value
 * - workspace (Workspace): configured mastra workspace instance
 *
 * section: example
 * const ws = create_harness_workspace({ base_path: process.cwd() });
 */
export function create_harness_workspace(options = {}) {
  const {
    id = 'sdlc-harness-workspace',
    name = 'sdlc harness workspace',
    base_path = options.workspace_root || process.cwd(),
    read_only = false,
    enable_sandbox = true,
    bm25 = true
  } = options;

  const filesystem = new LocalFilesystem({
    basePath: base_path,
    readOnly: read_only
  });

  const sandbox = enable_sandbox
    ? new LocalSandbox({
        cwd: base_path
      })
    : undefined;

  const block_store_hook = async (tool_or_ctx, maybe_args) => {
    const args = maybe_args !== undefined ? maybe_args : (tool_or_ctx?.args || tool_or_ctx);
    const serialised = JSON.stringify(args || '');
    if (/\.sdlc\/store\b/.test(serialised)) {
      throw new Error('store_isolation_violation: specialist workspace tools are forbidden from accessing .sdlc/store directly; use sdlc-supervisor');
    }
    return { allow: true };
  };

  const tools_config = {
    enabled: true,
    hooks: {
      before: block_store_hook
    }
  };

  const ws = new Workspace({
    id,
    name,
    filesystem,
    sandbox,
    bm25,
    tools: tools_config
  });

  if (!ws.tools) {
    ws.tools = tools_config;
  }

  return ws;
}

/**
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: creates test runner mastra tool
 * verbose: executes shell test commands with timeout and captures exit status and output.
 * 
 * section: arguments
 * - options (object, optional): tool options
 * 
 * section: return value
 * - tool (object): mastra tool instance
 * 
 * section: example
 * const runner = create_test_runner_tool();
 * const result = await runner.execute({ context: { command: 'node --test' } });
 */
export function create_test_runner_tool(options = {}) {
  const logger = options.logger || null;

  return createTool({
    id: 'harness-test-runner',
    description: 'executes automated test commands in the workspace',
    inputSchema: z.object({
      command: z.string().optional(),
      cwd: z.string().optional(),
      timeout: z.number().optional(),
      context: z.any().optional()
    }).passthrough(),
    outputSchema: z.object({
      passed: z.boolean(),
      command: z.string(),
      stdout: z.string().optional(),
      stderr: z.string().optional(),
      error: z.string().nullable().optional()
    }).passthrough(),
    execute: async (raw_params = {}) => {
      const context = raw_params?.context && typeof raw_params.context === 'object' ? raw_params.context : (raw_params || {});
      if (logger) {
        logger.info({
          event: 'tool:execution:started',
          component: 'tools',
          tool_id: 'harness-test-runner',
          context: context || {}
        });
      }

      const command = context?.command || 'node --test';
      const cwd = context?.cwd || options.cwd || process.cwd();
      const timeout = context?.timeout || options.timeout || 15000;

      let result;
      try {
        const stdout = execSync(command, {
          cwd,
          timeout,
          stdio: 'pipe',
          encoding: 'utf-8'
        });
        result = {
          passed: true,
          command,
          stdout,
          error: null
        };
      } catch (err) {
        result = {
          passed: false,
          command,
          stdout: err.stdout?.toString() || '',
          stderr: err.stderr?.toString() || '',
          error: err.message
        };
      }

      if (logger) {
        logger.info({
          event: 'tool:execution:completed',
          component: 'tools',
          tool_id: 'harness-test-runner',
          success: result.passed
        });
      }

      return result;
    }
  });
}

/**
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: creates verified artefact writer mastra tool
 * verbose: writes structured markdown or code deliverables with path sanitisation checks.
 * 
 * section: arguments
 * - options (object, optional): tool options
 * 
 * section: return value
 * - tool (object): mastra tool instance
 * 
 * section: example
 * const writer = create_artefact_writer_tool();
 * await writer.execute({ context: { file_path: 'docs/test.md', content: '# test' } });
 */
export function create_artefact_writer_tool(options = {}) {
  const logger = options.logger || null;

  return createTool({
    id: 'harness-artefact-writer',
    description: 'persists verified sdlc deliverables and code artefacts to disk',
    inputSchema: z.object({
      file_path: z.string().optional(),
      content: z.string().optional(),
      workspace_root: z.string().optional(),
      context: z.any().optional()
    }).passthrough(),
    outputSchema: z.object({
      written: z.boolean(),
      file_path: z.string().optional(),
      bytes: z.number().optional(),
      error: z.string().optional()
    }).passthrough(),
    execute: async (raw_params = {}) => {
      const context = raw_params?.context && typeof raw_params.context === 'object' ? raw_params.context : (raw_params || {});
      if (logger) {
        logger.info({
          event: 'tool:execution:started',
          component: 'tools',
          tool_id: 'harness-artefact-writer',
          context: context || {}
        });
      }

      const workspace_root = path.resolve(context?.workspace_root || options.workspace_root || process.cwd());
      const relative_path = context?.file_path;
      const content = context?.content || '';

      if (!relative_path) {
        const res = {
          written: false,
          error: 'missing_file_path'
        };
        if (logger) {
          logger.info({
            event: 'tool:execution:completed',
            component: 'tools',
            tool_id: 'harness-artefact-writer',
            success: false
          });
        }
        return res;
      }

      const target_path = path.resolve(workspace_root, relative_path);
      if (!target_path.startsWith(workspace_root)) {
        const res = {
          written: false,
          error: 'security_violation_path_traversal'
        };
        if (logger) {
          logger.info({
            event: 'tool:execution:completed',
            component: 'tools',
            tool_id: 'harness-artefact-writer',
            success: false
          });
        }
        return res;
      }

      if (/\.sdlc[\\/]store\b/.test(target_path) || /\.sdlc[\\/]store\b/.test(String(relative_path))) {
        return {
          written: false,
          error: 'security_violation_direct_store_access_forbidden'
        };
      }

      const target_dir = path.dirname(target_path);
      if (!fs.existsSync(target_dir)) {
        fs.mkdirSync(target_dir, { recursive: true });
      }

      fs.writeFileSync(target_path, content, 'utf-8');
      const res = {
        written: true,
        file_path: target_path,
        bytes: Buffer.byteLength(content, 'utf-8')
      };
      if (logger) {
        logger.info({
          event: 'tool:execution:completed',
          component: 'tools',
          tool_id: 'harness-artefact-writer',
          success: true
        });
      }
      return res;
    }
  });
}

/**
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: creates test immutability audit mastra tool
 * verbose: checks baseline versus current test source code for deleted assertions or skips.
 * 
 * section: arguments
 * - options (object, optional): tool options
 * 
 * section: return value
 * - tool (object): mastra tool instance
 * 
 * section: example
 * const auditor = create_immutability_audit_tool();
 * const outcome = await auditor.execute({ context: { baseline: '...', current: '...' } });
 */
export function create_immutability_audit_tool(options = {}) {
  const logger = options.logger || null;

  return createTool({
    id: 'harness-immutability-audit',
    description: 'verifies test immutability invariants and assertion densities',
    inputSchema: z.object({
      baseline: z.string().optional(),
      current: z.string().optional(),
      context: z.any().optional()
    }).passthrough(),
    outputSchema: z.object({
      valid: z.boolean(),
      delta: z.number(),
      violations: z.array(z.string())
    }).passthrough(),
    execute: async (raw_params = {}) => {
      const context = raw_params?.context && typeof raw_params.context === 'object' ? raw_params.context : (raw_params || {});
      if (logger) {
        logger.info({
          event: 'tool:execution:started',
          component: 'tools',
          tool_id: 'harness-immutability-audit',
          context: context || {}
        });
      }

      const baseline = context?.baseline || '';
      const current = context?.current || '';
      const result = verify_test_immutability(baseline, current);
      const res = {
        valid: result.valid,
        delta: result.delta,
        violations: result.violations
      };

      if (logger) {
        logger.info({
          event: 'tool:execution:completed',
          component: 'tools',
          tool_id: 'harness-immutability-audit',
          success: result.valid
        });
      }

      return res;
    }
  });
}

/**
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: creates git status verification mastra tool
 * verbose: checks working tree status and untracked file count for release verification.
 * 
 * section: arguments
 * - options (object, optional): tool options
 * 
 * section: return value
 * - tool (object): mastra tool instance
 * 
 * section: example
 * const git_tool = create_git_status_tool();
 * const res = await git_tool.execute({ context: {} });
 */
export function create_git_status_tool(options = {}) {
  const logger = options.logger || null;

  return createTool({
    id: 'harness-git-status',
    description: 'audits repository working tree cleanliness for release readiness',
    inputSchema: z.object({
      cwd: z.string().optional(),
      context: z.any().optional()
    }).passthrough(),
    outputSchema: z.object({
      clean: z.boolean(),
      dirty_files_count: z.number().optional(),
      modified_files: z.array(z.string()).optional(),
      error: z.string().optional()
    }).passthrough(),
    execute: async (raw_params = {}) => {
      const context = raw_params?.context && typeof raw_params.context === 'object' ? raw_params.context : (raw_params || {});
      if (logger) {
        logger.info({
          event: 'tool:execution:started',
          component: 'tools',
          tool_id: 'harness-git-status',
          context: context || {}
        });
      }

      const cwd = context?.cwd || options.cwd || process.cwd();
      let res;
      try {
        const status_out = execSync('git status --porcelain', {
          cwd,
          stdio: 'pipe',
          encoding: 'utf-8'
        });
        const lines = status_out.trim().split('\n').filter((l) => l.trim().length > 0);
        res = {
          clean: lines.length === 0,
          dirty_files_count: lines.length,
          modified_files: lines
        };
      } catch (err) {
        res = {
          clean: false,
          error: err.message
        };
      }

      if (logger) {
        logger.info({
          event: 'tool:execution:completed',
          component: 'tools',
          tool_id: 'harness-git-status',
          success: !res.error
        });
      }

      return res;
    }
  });
}

/**
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: creates hybrid dense + bm25 doc store rag search mastra tool
 * verbose: enables mastra role agents to execute structure-aware reciprocal rank fusion
 * queries over .sdlc/store/ entities and docs/ markdown sections without direct store writes.
 * 
 * section: arguments
 * - options (object, optional): tool options including store and docs_dir
 * 
 * section: return value
 * - tool (object): mastra tool instance
 * 
 * section: example
 * const rag_tool = create_doc_rag_search_tool({ store });
 */
export function create_doc_rag_search_tool(options = {}) {
  const logger = options.logger || null;
  let resolved_store = options.store || null;

  function get_store() {
    if (!resolved_store) {
      resolved_store = create_document_entity_store({
        workspace_root: options.workspace_root || options.base_dir || process.cwd(),
        store_root: options.store_root
      });
    }
    return resolved_store;
  }

  return createTool({
    id: 'harness-doc-rag-search',
    description: 'executes hybrid dense embedding and bm25 reciprocal rank fusion search across sdlc store entities and clean-room markdown documentation',
    inputSchema: z.object({
      query: z.string().optional(),
      top_k: z.number().optional(),
      filter: z.any().optional(),
      reindex: z.boolean().optional(),
      docs_dir: z.string().optional(),
      context: z.any().optional()
    }).passthrough(),
    outputSchema: z.object({
      query: z.string(),
      total_hits: z.number(),
      hits: z.array(z.any())
    }).passthrough(),
    execute: async (raw_params = {}) => {
      const context = raw_params.context || raw_params;
      if (logger) {
        logger.info({
          event: 'tool:execution:started',
          component: 'tools',
          tool_id: 'harness-doc-rag-search',
          context: context || {}
        });
      }

      const store = get_store();
      const query = context?.query || '';
      const top_k = context?.top_k || 5;
      const filter = context?.filter || null;

      if (context?.reindex === true) {
        store.index_store_for_rag({
          docs_dir: context?.docs_dir || options.docs_dir
        });
      } else {
        store.index_store_for_rag({
          docs_dir: context?.docs_dir || options.docs_dir
        });
      }

      const hits = store.search_doc_store(query, { top_k, filter });

      if (logger) {
        logger.info({
          event: 'tool:execution:completed',
          component: 'tools',
          tool_id: 'harness-doc-rag-search',
          hits_count: hits.length
        });
      }

      return {
        query,
        total_hits: hits.length,
        hits
      };
    }
  });
}

/**
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: creates scoped mastra knowledge graph query and note-appending tool
 * verbose: enables mastra role agents to search scoped knowledge nodes, inspect [[wiki-link]]
 * mentions, and append attributed observations to epic knowledge graphs.
 * 
 * section: arguments
 * - options (object, optional): tool options including knowledge, store, and storage
 * 
 * section: return value
 * - tool (object): mastra tool instance
 * 
 * section: example
 * const kn_tool = create_knowledge_graph_tool({ store });
 */
export function create_knowledge_graph_tool(options = {}) {
  const logger = options.logger || null;
  let resolved_store = options.store || null;
  let resolved_knowledge = options.knowledge || null;

  function get_store() {
    if (!resolved_store) {
      resolved_store = create_document_entity_store({
        workspace_root: options.workspace_root || options.base_dir || process.cwd(),
        store_root: options.store_root
      });
    }
    return resolved_store;
  }

  function get_knowledge() {
    if (!resolved_knowledge) {
      resolved_knowledge = resolve_harness_knowledge(options);
    }
    return resolved_knowledge;
  }

  return createTool({
    id: 'harness-knowledge-graph',
    description: 'searches scoped mastra knowledge nodes and appends attributed specialist notes with [[wiki-link]] mentions',
    inputSchema: z.object({
      action: z.string().optional(),
      query: z.string().optional(),
      linked_prd_id: z.string().optional(),
      scope: z.array(z.string()).optional(),
      text: z.string().optional(),
      target_id: z.string().optional(),
      source_thread_id: z.string().optional(),
      author: z.string().optional(),
      notes: z.array(z.any()).optional(),
      context: z.any().optional()
    }).passthrough(),
    outputSchema: z.object({
      ok: z.boolean(),
      action: z.string(),
      hits: z.array(z.any()).optional(),
      nodes_synced: z.number().optional(),
      notes_appended: z.number().optional()
    }).passthrough(),
    execute: async (raw_params = {}) => {
      const context = raw_params.context || raw_params;
      const action = context?.action || 'search';
      const linked_prd_id = context?.linked_prd_id || 'prd-01';
      const scope = context?.scope || ['org:sdlc', `resource:${linked_prd_id}`];
      const knowledge = get_knowledge();
      const store = get_store();

      if (logger) {
        logger.info({
          event: 'tool:execution:started',
          component: 'tools',
          tool_id: 'harness-knowledge-graph',
          action
        });
      }

      if (action === 'append_note' || action === 'sync') {
        const sync_res = await store.sync_to_knowledge({
          knowledge,
          linked_prd_id,
          notes: context?.text
            ? [
              {
                target_id: context.target_id || linked_prd_id,
                text: context.text,
                source_thread_id: context.source_thread_id || 'agent-tool',
                author: context.author || 'role-agent'
              }
            ]
            : (context?.notes || [])
        });
        return {
          ok: true,
          action,
          nodes_synced: sync_res.nodes_synced,
          notes_appended: sync_res.notes_appended
        };
      }

      const hits = await knowledge.search({
        scope,
        query: context?.query || ''
      });
      return {
        ok: true,
        action: 'search',
        hits
      };
    }
  });
}

/**
 * section: version number
 * version: 0.1.0
 *
 * section: documentation
 * tldr: creates an xstate v5 statechart-driven bidirectional doc store synchronisation mastra tool
 * verbose: executes the doc-store-sync-lifecycle xstate v5 statechart to synchronise markdown/json
 * artefacts in docs/ with structured entities in .sdlc/store/, re-index hybrid rag embeddings,
 * and synchronise mastra knowledge graph nodes.
 *
 * section: arguments
 * - options (object, optional): tool options including store, workspace_root, and docs_dir
 *
 * section: return value
 * - tool (object): mastra tool instance (id: 'harness-doc-store-sync')
 *
 * section: example
 * const sync_tool = create_doc_store_sync_tool({ store });
 * const res = await sync_tool.execute({ context: { direction: 'bidirectional' } });
 */
export function create_doc_store_sync_tool(options = {}) {
  const logger = options.logger || null;
  let resolved_store = options.store || null;

  function get_store() {
    if (!resolved_store) {
      resolved_store = create_document_entity_store({
        workspace_root: options.workspace_root || options.base_dir || process.cwd(),
        store_root: options.store_root
      });
    }
    return resolved_store;
  }

  return createTool({
    id: 'harness-doc-store-sync',
    description: 'executes the xstate v5 doc-store-sync-lifecycle statechart to synchronise .sdlc/store entities and filesystem docs/ markdown bidirectionally, re-indexing hybrid rag and knowledge graph nodes',
    inputSchema: z.object({
      direction: z.enum(['bidirectional', 'import', 'migrate', 'export']).optional(),
      docs_dir: z.string().optional(),
      sync_knowledge: z.boolean().optional(),
      context: z.any().optional()
    }).passthrough(),
    outputSchema: z.object({
      ok: z.boolean(),
      statechart_id: z.string(),
      final_state: z.string(),
      direction: z.string(),
      statechart_trace: z.array(z.string()),
      migration_report: z.any(),
      export_report: z.any(),
      rag_report: z.any(),
      knowledge_report: z.any(),
      synced_at: z.string()
    }).passthrough(),
    execute: async (raw_params = {}) => {
      const context = raw_params?.context && typeof raw_params.context === 'object'
        ? raw_params.context
        : (raw_params || {});
      const workspace_root = path.resolve(context?.workspace_root || options.workspace_root || options.base_dir || process.cwd());
      const docs_dir = path.resolve(workspace_root, context?.docs_dir || options.docs_dir || 'docs');
      const direction = context?.direction || 'bidirectional';
      const store = get_store();

      if (logger) {
        logger.info({
          event: 'tool:execution:started',
          component: 'tools',
          tool_id: 'harness-doc-store-sync',
          direction,
          docs_dir
        });
      }

      const sync_chart = create_doc_store_sync_statechart();
      const report = await sync_chart.run_sync({
        store,
        docs_dir,
        migrate_fn: migrate_all_documents,
        direction,
        sync_knowledge: context?.sync_knowledge !== false
      });

      if (logger) {
        logger.info({
          event: 'tool:execution:completed',
          component: 'tools',
          tool_id: 'harness-doc-store-sync',
          success: report.ok,
          final_state: report.final_state
        });
      }

      return report;
    }
  });
}

/**
 * =========================================================================
 * function: create_work_item_submit_tool
 * =========================================================================
 * 
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: creates a mastra tool for submitting work items and processes to the SDLC harness
 * verbose: exposes worker pool and work board dispatch via the sdlc-mcp server, allowing
 * agents and clients to submit feature, refactor, bugfix, or doc_sync requests.
 * 
 * section: arguments
 * - options (object, optional): configuration including harness or worker_pool instance
 * 
 * section: return value
 * - tool (object): mastra tool instance (id: 'harness-work-item-submit')
 * =========================================================================
 */
export function create_work_item_submit_tool(options = {}) {
  const logger = options.logger || null;

  return createTool({
    id: 'harness-work-item-submit',
    description: 'initiates a governed sdlc process (e.g. refactor-module, develop-feature, fix-defect) via sdlc-supervisor, creating its tickets on the work board',
    inputSchema: z.object({
      name: z.string().optional(),
      title: z.string().optional(),
      process_type: z.string().optional(),
      description: z.string().optional(),
      inputs: z.record(z.any()).optional(),
      context: z.any().optional()
    }).passthrough(),
    outputSchema: z.object({
      ok: z.boolean(),
      process_type: z.string().optional(),
      name: z.string().optional(),
      work_item: z.any().optional(),
      tickets: z.array(z.any()).optional(),
      error: z.string().optional(),
      created_at: z.string()
    }).passthrough(),
    execute: async (raw_params = {}) => {
      const params = raw_params?.context && typeof raw_params.context === 'object'
        ? raw_params.context
        : (raw_params || {});
      const created_at = new Date().toISOString();
      const runtime = options.runtime_ref || null;
      const supervisor = runtime?.supervisor || null;

      if (!supervisor || typeof supervisor.initiate_process !== 'function') {
        return {
          ok: false,
          error: 'harness runtime is not bound: sdlc-supervisor unavailable, no work item was created',
          created_at
        };
      }

      const process_type = params.process_type || 'refactor-module';
      const name = params.name || String(params.title || 'work-item').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

      if (logger) {
        logger.info({ event: 'tool:execution:started', component: 'tools', tool_id: 'harness-work-item-submit', process_type, name });
      }

      const initiated = supervisor.initiate_process(process_type, {
        name,
        title: params.title,
        description: params.description,
        inputs: params.inputs || {}
      });

      const res = {
        ok: true,
        process_type,
        name,
        work_item: initiated?.work_item || null,
        tickets: initiated?.tickets || [],
        created_at
      };

      if (logger) {
        logger.info({ event: 'tool:execution:completed', component: 'tools', tool_id: 'harness-work-item-submit', ticket_count: res.tickets.length });
      }
      return res;
    }
  });
}

/**
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: aggregates all standard harness engineering tools
 * verbose: compiles test runner, artefact writer, immutability audit, git status, doc rag search, knowledge graph, doc store sync, and work item submit tools into a dictionary.
 * 
 * section: arguments
 * - options (object, optional): tool options
 * 
 * section: return value
 * - tools (object): dictionary of instantiated mastra tools
 * 
 * section: example
 * const tools = create_harness_tools();
 */
export function create_harness_tools(options = {}) {
  const test_runner = create_test_runner_tool(options);
  const artefact_writer = create_artefact_writer_tool(options);
  const immutability_audit = create_immutability_audit_tool(options);
  const git_status = create_git_status_tool(options);
  const doc_rag_search = create_doc_rag_search_tool(options);
  const knowledge_graph = create_knowledge_graph_tool(options);
  const doc_store_sync = create_doc_store_sync_tool(options);
  const work_item_submit = create_work_item_submit_tool(options);

  if (options.require_supervisor_context) {
    test_runner.requestContextSchema = SupervisorRequestContextSchema;
    artefact_writer.requestContextSchema = SupervisorRequestContextSchema;
    immutability_audit.requestContextSchema = SupervisorRequestContextSchema;
    git_status.requestContextSchema = SupervisorRequestContextSchema;
    doc_rag_search.requestContextSchema = SupervisorRequestContextSchema;
    knowledge_graph.requestContextSchema = SupervisorRequestContextSchema;
    doc_store_sync.requestContextSchema = SupervisorRequestContextSchema;
    work_item_submit.requestContextSchema = SupervisorRequestContextSchema;
  }

  const workspace_tools = options.include_workspace_tools && options.workspace
    ? createWorkspaceTools(options.workspace)
    : {};

  return {
    'harness-test-runner': test_runner,
    'harness-artefact-writer': artefact_writer,
    'harness-immutability-audit': immutability_audit,
    'harness-git-status': git_status,
    'harness-doc-rag-search': doc_rag_search,
    'harness-knowledge-graph': knowledge_graph,
    'harness-doc-store-sync': doc_store_sync,
    'harness-work-item-submit': work_item_submit,
    ...workspace_tools
  };
}
