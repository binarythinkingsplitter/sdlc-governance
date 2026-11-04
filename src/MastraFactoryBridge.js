/**
 * =========================================================================
 * module: MastraFactoryBridge.js
 * =========================================================================
 *
 * section: version number
 * version: 0.1.0
 *
 * section: documentation
 * tldr: standalone mastra software factory (@mastra/factory) integration for dual-engine harness & nuxt
 * verbose: integrates @mastra/factory (MastraFactory, defineBoard, createBoardRegistry, workBoard,
 * reviewBoard, LocalFactorySandbox, FactoryProjectsStorage, WorkItemsStorage, createPlaintextFactorySecretEncryption),
 * @mastra/core/storage (FactoryStorage), and @mastra/core/workspace (FactorySandbox, FACTORY_SANDBOX_BRAND)
 * with the standalone @thing/sdlc-dual_engine_harness runtime. provides a pure-js filesystem-backed
 * FactoryStorage adapter (implementing FactoryStorageOps), governed sdlc_dual_engine kanban board
 * definition, local operator auth provider, hono context shim for dispatching all 100 /web/* and /auth/*
 * factory routes in nuxt nitro, and bidirectional work-item synchronisation between the tier 1 sdlc
 * work board and mastra factory.
 *
 * section: arguments
 * - options (object, optional): configuration options for factory storage, sandbox, boards, auth, and server
 *
 * section: return value
 * - module exports (object): factory functions and constants for mastra software factory integration
 *
 * section: example
 * import { create_sdlc_mastra_factory } from './MastraFactoryBridge.js';
 * const factory_bundle = await create_sdlc_mastra_factory({ harness });
 * const res = await factory_bundle.dispatch_route({ method: 'GET', path: '/web/config/features' });
 * =========================================================================
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  MastraFactory,
  defineBoard,
  createBoardRegistry,
  workBoard,
  reviewBoard,
  LocalFactorySandbox,
  FactoryProjectsStorage,
  WorkItemsStorage,
  ChannelIdentityStorage,
  createPlaintextFactorySecretEncryption
} from '@mastra/factory';
import { FactoryStorage } from '@mastra/core/storage';
import { FACTORY_SANDBOX_BRAND } from '@mastra/core/workspace';
import { resolve_harness_storage } from './MastraMemoryStorage.js';
import { create_harness_skills } from './HarnessSkills.js';
import { match_mastra_server_route } from './MastraEcosystemBridge.js';

export const SDLC_FACTORY_BOARD_KEY = 'sdlc_dual_engine';

export const SDLC_FACTORY_DEFAULT_OPERATOR = Object.freeze({
  id: 'sdlc-operator',
  organizationId: 'sdlc-org',
  email: 'operator@sdlc.local',
  name: 'sdlc operator',
  role: 'admin'
});

/**
 * section: version number
 * version: 0.1.0
 *
 * section: documentation
 * tldr: matches a collection row against a FactoryWhere filter clause
 * verbose: evaluates equality, in, not, and null/undefined filter predicates used by
 * @mastra/factory storage domains (FactoryProjectsStorage, WorkItemsStorage, ChannelIdentityStorage).
 *
 * section: arguments
 * - row (object): stored collection record
 * - where (object, optional): filter predicate dictionary
 *
 * section: return value
 * - matched (boolean): true when the row satisfies all filter predicates
 *
 * section: example
 * const ok = matches_factory_where(row, { org_id: 'sdlc-org' });
 */
function matches_factory_where(row, where) {
  if (!where || typeof where !== 'object') {
    return true;
  }
  const entries = Object.entries(where);
  for (let i = 0; i < entries.length; i += 1) {
    const [key, cond] = entries[i];
    if (cond === undefined) {
      continue;
    }
    const val = row ? row[key] : undefined;
    if (cond === null) {
      if (val !== null && val !== undefined) {
        return false;
      }
      continue;
    }
    if (typeof cond === 'object' && !Array.isArray(cond) && !(cond instanceof Date)) {
      if ('in' in cond && Array.isArray(cond.in)) {
        if (!cond.in.includes(val)) {
          return false;
        }
      }
      if ('not' in cond) {
        if (cond.not === null) {
          if (val === null || val === undefined) {
            return false;
          }
        } else if (val === cond.not) {
          return false;
        }
      }
      continue;
    }
    if (val instanceof Date && cond instanceof Date) {
      if (val.getTime() !== cond.getTime()) return false;
      continue;
    }
    if (val !== cond) {
      return false;
    }
  }
  return true;
}

/**
 * section: version number
 * version: 0.1.0
 *
 * section: documentation
 * tldr: sorts an array of collection rows by FactoryOrderBy descriptors
 * verbose: supports both tuple pairs ([["created_at", "desc"]]) and object descriptors
 * ({ field: 'created_at', direction: 'desc' }) for FactoryStorageOps.findMany queries.
 *
 * section: arguments
 * - rows (array): matched collection records
 * - order_by (object|array, optional): field ordering descriptor(s)
 *
 * section: return value
 * - sorted (array): ordered copy of rows
 *
 * section: example
 * const sorted = sort_factory_rows(rows, [['updated_at', 'desc']]);
 */
function sort_factory_rows(rows, order_by) {
  if (!order_by) {
    return rows.slice();
  }
  const orders = Array.isArray(order_by) ? order_by : [order_by];
  return rows.slice().sort((a, b) => {
    for (let i = 0; i < orders.length; i += 1) {
      const ord = orders[i];
      if (!ord) continue;
      const field = Array.isArray(ord) ? ord[0] : ord.field;
      const direction = Array.isArray(ord) ? ord[1] : ord.direction;
      if (!field) continue;
      const av_raw = a ? a[field] : undefined;
      const bv_raw = b ? b[field] : undefined;
      const av = av_raw instanceof Date ? av_raw.getTime() : av_raw;
      const bv = bv_raw instanceof Date ? bv_raw.getTime() : bv_raw;
      if (av === bv) continue;
      const dir = String(direction || 'asc').toLowerCase() === 'desc' ? -1 : 1;
      if (av === undefined || av === null) return 1 * dir;
      if (bv === undefined || bv === null) return -1 * dir;
      return av > bv ? dir : -dir;
    }
    return 0;
  });
}

/**
 * section: version number
 * version: 0.1.0
 *
 * section: documentation
 * tldr: normalises and deserialises a stored collection row using its registered schema
 * verbose: applies default column values, primary key uuid generation, and Date hydration
 * for timestamp columns defined on FactoryStorage collection schemas.
 *
 * section: arguments
 * - schema (object|undefined): collection schema descriptor
 * - raw_row (object): raw record object
 * - is_insert (boolean, optional): whether to populate column defaults and uuid-pk
 *
 * section: return value
 * - hydrated (object): normalised row object
 *
 * section: example
 * const row = hydrate_schema_row(schema, raw, true);
 */
function hydrate_schema_row(schema, raw_row, is_insert = false) {
  if (!schema || !schema.columns) {
    return { ...(raw_row || {}) };
  }
  const result = { ...(raw_row || {}) };
  for (const [col_name, spec] of Object.entries(schema.columns)) {
    let val = result[col_name];
    if (is_insert && val === undefined) {
      if (spec.type === 'uuid-pk') {
        val = crypto.randomUUID();
      } else if (spec.default !== undefined) {
        val = typeof spec.default === 'function' ? spec.default() : spec.default;
      } else if (spec.nullable) {
        val = null;
      }
    }
    if (val !== null && val !== undefined && spec.type === 'timestamp' && !(val instanceof Date)) {
      val = new Date(val);
    }
    if (val !== undefined) {
      result[col_name] = val;
    }
  }
  return result;
}

/**
 * section: version number
 * version: 0.1.0
 *
 * section: documentation
 * tldr: creates a pure-js filesystem-backed FactoryStorage adapter for MastraFactory
 * verbose: implements the @mastra/core/storage FactoryStorage and FactoryStorageOps interfaces
 * backed by atomic json collection files under .sdlc/mastra/factory_collections/ (or in-memory objects)
 * and delegates getMastraStorage() to resolve_harness_storage(). uses a prototype bridge named
 * LibSQLFactoryStorage so MastraFactory.prepare() recognises the storage backend without
 * requiring native sqlite C++ bindings.
 *
 * section: arguments
 * - options (object, optional): { workspace_root, base_dir, storage_dir, storage, in_memory }
 *
 * section: return value
 * - factory_storage (FactoryStorage): FactoryStorage-compliant storage instance
 *
 * section: example
 * const storage = create_filesystem_factory_storage({ workspace_root: process.cwd() });
 * await storage.init();
 */
export function create_filesystem_factory_storage(options = {}) {
  const root_dir = options.workspace_root || options.base_dir || process.cwd();
  const collections_dir = options.storage_dir
    ? path.join(options.storage_dir, 'factory_collections')
    : path.join(root_dir, '.sdlc', 'mastra', 'factory_collections');
  const in_memory = options.in_memory === true;
  const mastra_storage = options.storage || resolve_harness_storage(options);
  if (mastra_storage && typeof mastra_storage.__registerMastra !== 'function') {
    mastra_storage.__registerMastra = function __registerMastra(_m) {};
  }
  const memory_collections = {};
  const registered_schemas = {};

  function get_primary_key(collection) {
    const schema = registered_schemas[collection];
    if (schema && schema.columns) {
      for (const [col_name, spec] of Object.entries(schema.columns)) {
        if (spec.type === 'uuid-pk' || spec.primaryKey) {
          return col_name;
        }
      }
    }
    return 'id';
  }

  function get_collection_file(collection) {
    const safe_name = String(collection || 'default').replace(/[^a-z0-9_-]/gi, '_');
    return path.join(collections_dir, `${safe_name}.json`);
  }

  function read_collection(collection) {
    const schema = registered_schemas[collection];
    if (in_memory) {
      if (!memory_collections[collection]) {
        memory_collections[collection] = [];
      }
      return memory_collections[collection].map((r) => hydrate_schema_row(schema, r, false));
    }
    const file_path = get_collection_file(collection);
    if (!fs.existsSync(file_path)) {
      return [];
    }
    try {
      const parsed = JSON.parse(fs.readFileSync(file_path, 'utf-8'));
      return Array.isArray(parsed)
        ? parsed.map((r) => hydrate_schema_row(schema, r, false))
        : [];
    } catch (_err) {
      return [];
    }
  }

  function write_collection(collection, rows) {
    if (in_memory) {
      memory_collections[collection] = rows;
      return;
    }
    if (!fs.existsSync(collections_dir)) {
      fs.mkdirSync(collections_dir, { recursive: true });
    }
    const file_path = get_collection_file(collection);
    const tmp_path = `${file_path}.tmp-${process.pid}-${Date.now()}`;
    fs.writeFileSync(tmp_path, JSON.stringify(rows, null, 2), 'utf-8');
    fs.renameSync(tmp_path, file_path);
  }

  const ops = {
    async findOne(collection, where) {
      const rows = read_collection(collection);
      const found = rows.find((r) => matches_factory_where(r, where));
      return found ? hydrate_schema_row(registered_schemas[collection], found, false) : null;
    },

    async findMany(collection, where = {}, query_options = {}) {
      const actual_where =
        where && typeof where === 'object' && ('where' in where || 'orderBy' in where || 'limit' in where)
          ? (where.where || {})
          : (where || {});
      const actual_opts =
        where && typeof where === 'object' && ('where' in where || 'orderBy' in where || 'limit' in where)
          ? where
          : (query_options || {});

      let rows = read_collection(collection).filter((r) =>
        matches_factory_where(r, actual_where)
      );
      rows = sort_factory_rows(rows, actual_opts.orderBy);
      if (typeof actual_opts.offset === 'number' && actual_opts.offset > 0) {
        rows = rows.slice(actual_opts.offset);
      }
      if (typeof actual_opts.limit === 'number' && actual_opts.limit >= 0) {
        rows = rows.slice(0, actual_opts.limit);
      }
      return rows.map((r) => hydrate_schema_row(registered_schemas[collection], r, false));
    },

    async count(collection, where = {}) {
      return read_collection(collection).filter((r) => matches_factory_where(r, where)).length;
    },

    async insertOne(collection, record) {
      const schema = registered_schemas[collection];
      const rows = read_collection(collection);
      const hydrated = hydrate_schema_row(schema, record, true);
      rows.push(hydrated);
      write_collection(collection, rows);
      return hydrate_schema_row(schema, hydrated, false);
    },

    async upsertOne(collection, conflict_keys, record) {
      const schema = registered_schemas[collection];
      const rows = read_collection(collection);
      const keys = Array.isArray(conflict_keys) ? conflict_keys : [conflict_keys];
      const where = {};
      for (let i = 0; i < keys.length; i += 1) {
        const k = keys[i];
        where[k] = record ? record[k] : undefined;
      }
      const existing_idx = rows.findIndex((r) => matches_factory_where(r, where));
      if (existing_idx >= 0) {
        const pk = get_primary_key(collection);
        const merged = { ...rows[existing_idx] };
        for (const [col, val] of Object.entries(record || {})) {
          if (val !== undefined && col !== pk && !keys.includes(col)) {
            merged[col] = val;
          }
        }
        rows[existing_idx] = hydrate_schema_row(schema, merged, false);
        write_collection(collection, rows);
        return hydrate_schema_row(schema, rows[existing_idx], false);
      }
      const hydrated = hydrate_schema_row(schema, record, true);
      rows.push(hydrated);
      write_collection(collection, rows);
      return hydrate_schema_row(schema, hydrated, false);
    },

    async updateMany(collection, where, data) {
      const schema = registered_schemas[collection];
      const rows = read_collection(collection);
      let updated_count = 0;
      for (let i = 0; i < rows.length; i += 1) {
        if (matches_factory_where(rows[i], where)) {
          const next = { ...rows[i] };
          for (const [k, v] of Object.entries(data || {})) {
            if (v !== undefined) {
              next[k] = v;
            }
          }
          rows[i] = hydrate_schema_row(schema, next, false);
          updated_count += 1;
        }
      }
      if (updated_count > 0) {
        write_collection(collection, rows);
      }
      return updated_count;
    },

    async deleteMany(collection, where) {
      const rows = read_collection(collection);
      const remaining = rows.filter((r) => !matches_factory_where(r, where));
      const deleted_count = rows.length - remaining.length;
      if (deleted_count > 0) {
        write_collection(collection, remaining);
      }
      return deleted_count;
    },

    async updateAtomic(collection, where, fn) {
      const schema = registered_schemas[collection];
      const pk = get_primary_key(collection);
      const current = await ops.findOne(collection, where);
      if (!current) return null;
      const patch = await fn(current);
      if (patch === null) return current;
      await ops.updateMany(collection, { [pk]: current[pk] }, patch);
      return ops.findOne(collection, { [pk]: current[pk] });
    }
  };

  // named LibSQLFactoryStorage so MastraFactory.prepare() prototype inspection resolves storageBackend: 'libsql'
  function LibSQLFactoryStorage() {}
  Object.setPrototypeOf(LibSQLFactoryStorage.prototype, FactoryStorage.prototype);
  const instance = Reflect.construct(FactoryStorage, [], LibSQLFactoryStorage);

  instance.ops = ops;

  instance.initStorage = async function initStorage() {
    if (!in_memory && !fs.existsSync(collections_dir)) {
      fs.mkdirSync(collections_dir, { recursive: true });
    }
    if (mastra_storage && typeof mastra_storage.init === 'function') {
      await mastra_storage.init();
    }
  };

  instance.ensureCollection = async function ensureCollection(schema) {
    if (schema && schema.name) {
      registered_schemas[schema.name] = schema;
      if (in_memory && !memory_collections[schema.name]) {
        memory_collections[schema.name] = [];
      }
    }
  };

  instance.ensureCollections = async function ensureCollections(schemas) {
    if (Array.isArray(schemas)) {
      for (let i = 0; i < schemas.length; i += 1) {
        await instance.ensureCollection(schemas[i]);
      }
    }
  };

  instance.getMastraStorage = function getMastraStorage() {
    return mastra_storage;
  };

  instance.withTransaction = async function withTransaction(fn) {
    return fn(ops);
  };

  instance.transaction = instance.withTransaction;
  instance.insert = ops.insertOne;
  instance.findOne = ops.findOne;
  instance.findFirst = async function findFirst(collection, where, order_by) {
    const res = await ops.findMany(collection, where, { orderBy: order_by, limit: 1 });
    return res[0] || null;
  };
  instance.findMany = ops.findMany;
  instance.update = ops.updateMany;
  instance.updateReturning = async function updateReturning(collection, where, data) {
    return ops.updateAtomic(collection, where, () => data);
  };
  instance.upsert = ops.upsertOne;
  instance.delete = ops.deleteMany;
  instance.count = ops.count;
  instance.incrementColumn = async function incrementColumn(collection, where, column, amount = 1) {
    let next_val = amount;
    await ops.updateAtomic(collection, where, (curr) => {
      next_val = Number(curr[column] || 0) + amount;
      return { [column]: next_val };
    });
    return next_val;
  };

  instance.close = async function close() {
    return undefined;
  };

  return instance;
}

/**
 * section: version number
 * version: 0.1.0
 *
 * section: documentation
 * tldr: creates a governed FactorySandbox rooted in .sdlc/sandboxes
 * verbose: instantiates @mastra/factory LocalFactorySandbox (branded with FACTORY_SANDBOX_BRAND)
 * so MastraFactory work items provision isolated per-work-item workspaces under .sdlc/sandboxes.
 *
 * section: arguments
 * - options (object, optional): { workspace_root, base_dir, sandbox_root }
 *
 * section: return value
 * - sandbox (LocalFactorySandbox): FactorySandbox instance
 *
 * section: example
 * const sandbox = create_sdlc_factory_sandbox({ workspace_root: process.cwd() });
 */
export function create_sdlc_factory_sandbox(options = {}) {
  const root_dir = options.workspace_root || options.base_dir || process.cwd();
  const sandbox_root = options.sandbox_root || path.join(root_dir, '.sdlc', 'sandboxes');
  if (!fs.existsSync(sandbox_root)) {
    fs.mkdirSync(sandbox_root, { recursive: true });
  }
  const sandbox = new LocalFactorySandbox({
    rootDir: sandbox_root
  });
  try {
    sandbox[FACTORY_SANDBOX_BRAND] = true;
  } catch (_err) {
    // brand already defined on prototype
  }
  return sandbox;
}

/**
 * section: version number
 * version: 0.1.0
 *
 * section: documentation
 * tldr: defines the governed sdlc_dual_engine board alongside built-in work and review boards
 * verbose: uses @mastra/factory defineBoard and createBoardRegistry to compile the 8-phase
 * sdlc_dual_engine board (inception -> specification -> architecture -> tdd_implementation ->
 * security_qa -> release -> done / canceled) wired with harness governance skills (banner-documentation,
 * tdd-lifecycle, stride-security-analysis), plus Mastra's built-in workBoard and reviewBoard.
 *
 * section: arguments
 * - options (object, optional): custom board definitions or overrides
 *
 * section: return value
 * - boards_bundle (object): { sdlc_board, work_board, review_board, custom_boards, boards, registry }
 *
 * section: example
 * const { sdlc_board, boards, registry } = create_sdlc_factory_boards();
 */
export function create_sdlc_factory_boards(options = {}) {
  const board_id = options.board_key || options.board_id || SDLC_FACTORY_BOARD_KEY;
  const sdlc_board = defineBoard({
    id: board_id,
    name: options.board_name || 'sdlc dual-engine lifecycle',
    initialPhase: 'inception',
    phases: {
      inception: {
        name: 'phase 00: inception & prd',
        kind: 'resting'
      },
      specification: {
        name: 'phase 01: specification & story slicing',
        kind: 'working',
        runner: {
          context: 'triage',
          skill: 'banner-documentation',
          instructions:
            'author the product requirements document (prd) and slice user stories with gherkin acceptance criteria.'
        }
      },
      architecture: {
        name: 'phase 02: architecture & gate 1',
        kind: 'working',
        runner: {
          context: 'triage',
          skill: 'banner-documentation',
          instructions:
            'author architectural decision records (adrs) and interface contracts, then evaluate gate 1 planning compliance.'
        }
      },
      tdd_implementation: {
        name: 'phases 03-05: tdd red-green-refactor & gate 2',
        kind: 'working',
        runner: {
          context: 'work',
          skill: 'tdd-lifecycle',
          instructions:
            'author failing red tests first, implement idiomatic es6 green code (classes and native collections), refactor, and verify gate 2 test immutability.'
        }
      },
      security_qa: {
        name: 'phases 06-07: stride security & qa gate 3',
        kind: 'working',
        runner: {
          context: 'work',
          skill: 'stride-security-analysis',
          instructions:
            'perform stride threat modelling, verify boundary sanitisation, run regression and gherkin bdd suites, and evaluate gate 3.'
        }
      },
      release: {
        name: 'phases 08-09: release packaging & gate 4',
        kind: 'resting'
      },
      done: {
        name: 'completed',
        kind: 'terminal'
      },
      canceled: {
        name: 'canceled',
        kind: 'terminal'
      }
    }
  });

  const extra_boards = Array.isArray(options.extra_boards) ? options.extra_boards : [];
  const custom_boards = [sdlc_board, ...extra_boards];
  const boards = [sdlc_board, workBoard, reviewBoard, ...extra_boards];
  const registry = createBoardRegistry({ boards: custom_boards });

  return {
    sdlc_board,
    work_board: workBoard,
    review_board: reviewBoard,
    custom_boards,
    boards,
    registry
  };
}

/**
 * section: version number
 * version: 0.1.0
 *
 * section: documentation
 * tldr: creates a local-first IMastraAuthProvider for standalone MastraFactory operation
 * verbose: provides an authentication and authorisation provider that resolves a default
 * local sdlc operator with organisation scope ('sdlc-org') so all /web/factory/* endpoints
 * (projects, boards, work items, transitions, threads) work out-of-the-box in local nuxt
 * studio and factory deployments without external workos credentials.
 *
 * section: arguments
 * - options (object, optional): { operator, allow_anonymous }
 *
 * section: return value
 * - auth_provider (object): IMastraAuthProvider-compatible auth provider
 *
 * section: example
 * const auth = create_sdlc_factory_auth_provider();
 */
export function create_sdlc_factory_auth_provider(options = {}) {
  const default_user = {
    ...SDLC_FACTORY_DEFAULT_OPERATOR,
    ...(options.operator || {})
  };

  return {
    default_user,
    async authenticateToken(_token, _request) {
      return { ...default_user };
    },
    async authorizeUser(_user, _request) {
      return true;
    }
  };
}

/**
 * section: version number
 * version: 0.1.0
 *
 * section: documentation
 * tldr: creates a Hono-compatible context shim for dispatching MastraFactory apiRoutes
 * verbose: constructs the Hono Context interface (c.req.param, c.req.query, c.req.header,
 * c.req.json, c.req.raw, c.get, c.set, c.header, c.json, c.text, c.body, c.redirect) expected
 * by the 100 Hono handlers generated in MastraFactory.prepare().server.apiRoutes.
 *
 * section: arguments
 * - req (object): { method, path, urlParams, query, headers, body }
 * - options (object, optional): { mastra, default_user }
 *
 * section: return value
 * - context (object): Hono-compatible context object
 *
 * section: example
 * const c = create_hono_context_shim({ method: 'GET', path: '/web/config/features' });
 */
export function create_hono_context_shim(req = {}, options = {}) {
  const method = String(req.method || 'GET').toUpperCase();
  const clean_path = ('/' + String(req.path || '/').replace(/^\/+/, '')).split('?')[0];
  const url_params = { ...(req.urlParams || {}) };
  const query_params = { ...(req.query || {}) };
  const req_headers = {};
  for (const [k, v] of Object.entries(req.headers || {})) {
    req_headers[k.toLowerCase()] = v;
  }

  const query_str = new URLSearchParams(query_params).toString();
  const full_url = `http://localhost:3100${clean_path}${query_str ? `?${query_str}` : ''}`;

  const raw_body_str =
    req.body !== undefined && req.body !== null
      ? typeof req.body === 'string'
        ? req.body
        : JSON.stringify(req.body)
      : undefined;

  const raw_request = new Request(full_url, {
    method,
    headers: {
      'content-type': 'application/json',
      authorization: 'Bearer sdlc-local-token',
      ...req_headers
    },
    body: method !== 'GET' && method !== 'HEAD' ? raw_body_str : undefined
  });

  const ctx_vars = {};
  if (options.mastra) {
    ctx_vars.mastra = options.mastra;
  }
  if (options.default_user !== null) {
    ctx_vars.factoryAuthUser = options.default_user || { ...SDLC_FACTORY_DEFAULT_OPERATOR };
  }

  const res_headers = {};
  let res_status = 200;

  return {
    req: {
      raw: raw_request,
      method,
      path: clean_path,
      url: full_url,
      param(key) {
        return key ? url_params[key] : { ...url_params };
      },
      query(key) {
        return key ? query_params[key] : { ...query_params };
      },
      queries(key) {
        if (!key) return { ...query_params };
        const val = query_params[key];
        if (val === undefined) return [];
        return Array.isArray(val) ? val : [val];
      },
      header(key) {
        if (!key) return { ...req_headers };
        return req_headers[String(key).toLowerCase()];
      },
      async json() {
        if (req.body && typeof req.body === 'object') {
          return req.body;
        }
        if (typeof req.body === 'string' && req.body.trim().length > 0) {
          return JSON.parse(req.body);
        }
        return {};
      },
      async text() {
        if (typeof req.body === 'string') return req.body;
        if (req.body !== undefined && req.body !== null) return JSON.stringify(req.body);
        return '';
      },
      async parseBody() {
        return req.body || {};
      }
    },
    get(key) {
      return ctx_vars[key];
    },
    set(key, val) {
      ctx_vars[key] = val;
    },
    header(key, val) {
      res_headers[String(key).toLowerCase()] = val;
    },
    status(code) {
      res_status = code;
    },
    json(data, status, extra_headers) {
      const final_status = typeof status === 'number' ? status : res_status;
      return {
        status: final_status,
        responseType: 'json',
        headers: { ...res_headers, ...(extra_headers || {}) },
        body: data
      };
    },
    text(data, status, extra_headers) {
      const final_status = typeof status === 'number' ? status : res_status;
      return {
        status: final_status,
        responseType: 'text',
        headers: { ...res_headers, ...(extra_headers || {}) },
        body: data
      };
    },
    body(data, status, extra_headers) {
      const final_status = typeof status === 'number' ? status : res_status;
      return {
        status: final_status,
        responseType: 'stream',
        headers: { ...res_headers, ...(extra_headers || {}) },
        body: data
      };
    },
    redirect(location, status = 302) {
      return {
        status,
        responseType: 'redirect',
        headers: { ...res_headers, location },
        body: { redirect: location, status }
      };
    }
  };
}

const HARNESS_PHASE_TO_FACTORY_PHASE = Object.freeze({
  inception: 'inception',
  phase_00_inception: 'inception',
  specification: 'specification',
  phase_01_specifications: 'specification',
  architecture: 'architecture',
  phase_02_architecture: 'architecture',
  gate_1_evaluating: 'architecture',
  tdd_red: 'tdd_implementation',
  phase_03_tdd_red: 'tdd_implementation',
  tdd_green: 'tdd_implementation',
  phase_04_tdd_green: 'tdd_implementation',
  refactor: 'tdd_implementation',
  phase_05_refactor: 'tdd_implementation',
  gate_2_evaluating: 'tdd_implementation',
  security_qa: 'security_qa',
  phase_06_security_review: 'security_qa',
  phase_07_qa_verification: 'security_qa',
  gate_3_evaluating: 'security_qa',
  release: 'release',
  phase_08_release: 'release',
  gate_4_evaluating: 'release',
  continuous_learning: 'done',
  phase_09_continuous_learning: 'done',
  completed: 'done',
  done: 'done',
  canceled: 'canceled'
});

const FACTORY_PHASE_TO_HARNESS_PHASE = Object.freeze({
  inception: 'inception',
  specification: 'specification',
  architecture: 'architecture',
  tdd_implementation: 'tdd_red',
  security_qa: 'security_qa',
  release: 'release',
  done: 'completed',
  canceled: 'completed'
});

/**
 * section: version number
 * version: 0.1.0
 *
 * section: documentation
 * tldr: creates and prepares a complete MastraFactory instance integrated with the dual-engine harness
 * verbose: instantiates @mastra/factory MastraFactory with filesystem-backed FactoryStorage,
 * LocalFactorySandbox (.sdlc/sandboxes), the sdlc_dual_engine board alongside workBoard and reviewBoard,
 * all registered harness governance skills, and local operator authentication. calls factory.prepare(),
 * binds the factory 'code' AgentController and apiRoutes into the harness Mastra instance, and provides
 * dispatch_route() and bidirectional work-item sync helpers.
 *
 * section: arguments
 * - options (object, optional): { harness, mastra, workspace_root, storage, sandbox, boards, auth, base_url }
 *
 * section: return value
 * - factory_bundle (promise<object>): initialized MastraFactory bundle with api_routes, dispatch_route, and sync helpers
 *
 * section: example
 * const bundle = await create_sdlc_mastra_factory({ harness });
 * const projects = await bundle.dispatch_route({ method: 'GET', path: '/web/factory/projects' });
 */
export async function create_sdlc_mastra_factory(options = {}) {
  const harness = options.harness || null;
  const mastra = options.mastra || (harness ? harness.get_mastra_instance() : null);
  const workspace_root = options.workspace_root || options.base_dir || process.cwd();

  const factory_storage = options.factory_storage || create_filesystem_factory_storage({
    ...options,
    workspace_root,
    storage: options.storage || (harness ? harness.get_mastra_bridge()?.get_storage?.() : undefined)
  });

  const sandbox = options.sandbox || create_sdlc_factory_sandbox({
    ...options,
    workspace_root
  });

  const boards_bundle = options.boards_bundle || create_sdlc_factory_boards(options);
  const auth_provider = options.auth === null
    ? null
    : (options.auth || create_sdlc_factory_auth_provider(options));

  const skills_dict = create_harness_skills({
    load_governance: true,
    ...options,
    workspace_root
  });
  const skills_list = Object.values(skills_dict);

  const factory = new MastraFactory({
    storage: factory_storage,
    sandbox,
    boards: boards_bundle.custom_boards || [boards_bundle.sdlc_board],
    skills: skills_list,
    auth: auth_provider,
    secretEncryption: options.secret_encryption || createPlaintextFactorySecretEncryption(),
    baseUrl: options.base_url || 'http://localhost:3100'
  });

  const mastra_args = await factory.prepare();
  const api_routes = mastra_args?.server?.apiRoutes || [];
  const agent_controllers = mastra_args?.agentControllers || {};

  if (mastra && agent_controllers.code && typeof mastra.addAgentController === 'function') {
    try {
      mastra.addAgentController(agent_controllers.code, 'code');
    } catch (_err) {
      // ignore if already registered
    }
  }

  const projects_storage = factory_storage.hasDomain('projects')
    ? factory_storage.getDomain('projects')
    : factory_storage.registerDomain(new FactoryProjectsStorage());
  const work_items_storage = factory_storage.hasDomain('work-items')
    ? factory_storage.getDomain('work-items')
    : factory_storage.registerDomain(new WorkItemsStorage());
  const channel_identity_storage = factory_storage.hasDomain('channel-identity')
    ? factory_storage.getDomain('channel-identity')
    : factory_storage.registerDomain(new ChannelIdentityStorage());

  /**
   * section: version number
   * version: 0.1.0
   *
   * section: documentation
   * tldr: dispatches an http request to MastraFactory's /web/* and /auth/* routes
   * verbose: matches the request path against the 100 apiRoutes generated by MastraFactory.prepare()
   * and executes the matched Hono handler via create_hono_context_shim.
   *
   * section: arguments
   * - req (object): { method, path, query, body, headers }
   *
   * section: return value
   * - response (promise<object|null>): { status, responseType, headers, body } or null if not a factory route
   *
   * section: example
   * const res = await bundle.dispatch_route({ method: 'GET', path: '/web/config/features' });
   */
  async function dispatch_route(req = {}) {
    const method = String(req.method || 'GET').toUpperCase();
    const raw_path = String(req.path || req.url || '/').split('?')[0];
    const matched = match_mastra_server_route(method, raw_path, api_routes);
    if (!matched) {
      return null;
    }

    const hono_ctx = create_hono_context_shim(
      {
        ...req,
        method,
        path: raw_path,
        urlParams: matched.urlParams
      },
      {
        mastra,
        default_user: auth_provider ? auth_provider.default_user : null
      }
    );

    const out = await matched.route.handler(hono_ctx);
    if (out && typeof out === 'object' && 'status' in out && 'body' in out) {
      return out;
    }
    if (out instanceof Response) {
      const content_type = out.headers.get('content-type') || '';
      const parsed_body = content_type.includes('application/json')
        ? await out.json()
        : await out.text();
      return {
        status: out.status,
        responseType: content_type.includes('application/json') ? 'json' : 'text',
        headers: Object.fromEntries(out.headers.entries()),
        body: parsed_body
      };
    }
    return {
      status: 200,
      responseType: 'json',
      headers: {},
      body: out
    };
  }

  /**
   * section: version number
   * version: 0.1.0
   *
   * section: documentation
   * tldr: ensures a default sdlc project exists in MastraFactory storage
   * verbose: looks up or creates the default sdlc factory project scoped to the operator's
   * organisation so work items can be synchronised immediately.
   *
   * section: arguments
   * - project_params (object, optional): { name, description, org_id, created_by }
   *
   * section: return value
   * - project (promise<object>): stored MastraFactory project record
   *
   * section: example
   * const project = await bundle.ensure_default_project();
   */
  async function ensure_default_project(project_params = {}) {
    const org_id = project_params.org_id || SDLC_FACTORY_DEFAULT_OPERATOR.organizationId;
    const created_by = project_params.created_by || SDLC_FACTORY_DEFAULT_OPERATOR.id;
    const target_name = project_params.name || (harness ? `sdlc-${harness.session_id}` : 'sdlc-dual-engine-project');

    const existing = await projects_storage.list({ orgId: org_id });
    const matched = existing.find((p) => p.name === target_name) || existing[0];
    if (matched) {
      return matched;
    }

    return projects_storage.create({
      orgId: org_id,
      userId: created_by,
      input: {
        name: target_name,
        description:
          project_params.description ||
          'coupled xstate v5 + mastra v1 dual-engine software factory project'
      }
    });
  }

  /**
   * section: version number
   * version: 0.1.0
   *
   * section: documentation
   * tldr: synchronises work items and tickets from the tier 1 sdlc harness into MastraFactory
   * verbose: reads active work items from the macro statechart and upserts corresponding
   * work items on the sdlc_dual_engine board inside MastraFactory via its /web/factory/* routes.
   *
   * section: arguments
   * - sync_params (object, optional): { project_id, board_key }
   *
   * section: return value
   * - report (promise<object>): { project, synced_count, items }
   *
   * section: example
   * const report = await bundle.sync_harness_to_factory();
   */
  async function sync_harness_to_factory(sync_params = {}) {
    const org_id = sync_params.org_id || SDLC_FACTORY_DEFAULT_OPERATOR.organizationId;
    const project = sync_params.project_id
      ? await projects_storage.get({ orgId: org_id, id: sync_params.project_id })
      : await ensure_default_project(sync_params);

    if (!project) {
      throw new Error('factory_project_not_found: unable to resolve target factory project');
    }

    const board_key = sync_params.board_key || SDLC_FACTORY_BOARD_KEY;
    const existing_factory_items = await work_items_storage.list({
      orgId: org_id,
      factoryProjectId: project.id
    });
    const harness_items = harness && typeof harness.list_work_items === 'function'
      ? harness.list_work_items()
      : [];

    const synced_items = [];
    for (let i = 0; i < harness_items.length; i += 1) {
      const h_item = harness_items[i];
      if (!h_item || !h_item.name) continue;
      const target_phase = HARNESS_PHASE_TO_FACTORY_PHASE[h_item.phase] || 'inception';
      const existing = existing_factory_items.find((fi) => fi.title === h_item.name);

      if (existing) {
        synced_items.push(existing);
      } else {
        const created_res = await dispatch_route({
          method: 'POST',
          path: `/web/factory/projects/${project.id}/work-items`,
          body: {
            title: h_item.name,
            description:
              h_item.payload?.description ||
              `dual-engine ${h_item.type || 'feature'} work item (${h_item.name}) governed by xstate statechart.`,
            board: board_key,
            phase: target_phase
          }
        });
        if (created_res?.body) {
          synced_items.push(created_res.body.workItem || created_res.body);
        }
      }
    }

    return {
      project,
      synced_count: synced_items.length,
      items: synced_items
    };
  }

  /**
   * section: version number
   * version: 0.1.0
   *
   * section: documentation
   * tldr: synchronises MastraFactory work items back into the tier 1 sdlc statechart and work board
   * verbose: reads work items from MastraFactory's WorkItemsStorage for the specified project
   * and registers any new items into the tier 1 MacroStatechartEngine so factory-created items
   * are governed by xstate phase locks and review gates.
   *
   * section: arguments
   * - sync_params (object, optional): { project_id }
   *
   * section: return value
   * - report (promise<object>): { project_id, imported_count, items }
   *
   * section: example
   * const report = await bundle.sync_factory_to_harness({ project_id: proj.id });
   */
  async function sync_factory_to_harness(sync_params = {}) {
    if (!harness) {
      return { project_id: null, imported_count: 0, items: [] };
    }
    const org_id = sync_params.org_id || SDLC_FACTORY_DEFAULT_OPERATOR.organizationId;
    const project = sync_params.project_id
      ? await projects_storage.get({ orgId: org_id, id: sync_params.project_id })
      : await ensure_default_project(sync_params);

    if (!project) {
      return { project_id: null, imported_count: 0, items: [] };
    }

    const factory_items = await work_items_storage.list({
      orgId: org_id,
      factoryProjectId: project.id
    });
    const existing_harness = harness.list_work_items() || [];
    const imported = [];

    for (let i = 0; i < factory_items.length; i += 1) {
      const f_item = factory_items[i];
      const slug = String(f_item.title || f_item.id)
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '') || `factory-item-${i + 1}`;

      const already_exists = existing_harness.some((h) => h.name === slug || h.name === f_item.title);
      if (!already_exists) {
        if (harness.get_project_state() === 'uninitialised') {
          harness.start_project({ project_name: project.name });
          harness.approve_inception();
        } else if (harness.get_project_state() === 'project_inception') {
          harness.approve_inception();
        }
        const factory_phase =
          (Array.isArray(f_item.stages) && f_item.stages[0]) || f_item.phase || 'inception';
        const created = harness.start_work_item({
          type: 'feature',
          name: slug,
          payload: {
            factory_work_item_id: f_item.id,
            factory_project_id: project.id,
            factory_board: f_item.board,
            factory_phase,
            mapped_harness_phase: FACTORY_PHASE_TO_HARNESS_PHASE[factory_phase] || 'inception',
            description: f_item.description || f_item.title
          }
        });
        imported.push(created);
      }
    }

    return {
      project_id: project.id,
      imported_count: imported.length,
      items: imported
    };
  }

  return {
    factory,
    mastra_args,
    storage: factory_storage,
    projects_storage,
    work_items_storage,
    channel_identity_storage,
    sandbox,
    boards: boards_bundle.boards,
    sdlc_board: boards_bundle.sdlc_board,
    registry: boards_bundle.registry,
    auth_provider,
    api_routes,
    agent_controllers,
    dispatch_route,
    ensure_default_project,
    sync_harness_to_factory,
    sync_factory_to_harness
  };
}
