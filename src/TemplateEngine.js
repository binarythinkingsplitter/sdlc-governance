/**
 * =========================================================================
 * module: template engine
 * =========================================================================
 * 
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: flexible code-driven templating engine for document and code generation
 * verbose: compiles logic-less and expressive templates with variable interpolation,
 * loops, conditionals, pipeline filters, helper functions, and partials without
 * external dependencies, driving document exports and code synthesis.
 * 
 * section: export catalog
 * - create_template_engine: factory function creating a template engine instance
 * - BUILTIN_HELPERS: dictionary of standard text and structural template helpers
 * =========================================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TemplateAdapter, HandlebarsTemplateAdapter } from './TemplateAdapters.js';

const default_package_root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const default_templates_dir = path.join(default_package_root, 'templates');

/**
 * built-in formatting, string manipulation, and logic helpers
 */
export const BUILTIN_HELPERS = Object.freeze({
  lowercase: (val) => String(val ?? '').toLowerCase(),
  uppercase: (val) => String(val ?? '').toUpperCase(),
  kebab_case: (val) => String(val ?? '')
    .replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, ''),
  snake_case: (val) => String(val ?? '')
    .replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1_$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, ''),
  camel_case: (val) => {
    const s = String(val ?? '').replace(/[^a-zA-Z0-9]+(.)/g, (_m, chr) => chr.toUpperCase());
    return s.charAt(0).toLowerCase() + s.slice(1);
  },
  pascal_case: (val) => {
    const s = String(val ?? '').replace(/[^a-zA-Z0-9]+(.)/g, (_m, chr) => chr.toUpperCase());
    return s.charAt(0).toUpperCase() + s.slice(1);
  },
  pad_start: (val, len = 2, char = '0') => String(val ?? '').padStart(Number(len), String(char)),
  pad_end: (val, len = 2, char = ' ') => String(val ?? '').padEnd(Number(len), String(char)),
  join: (arr, delimiter = ', ') => (Array.isArray(arr) ? arr.join(delimiter) : String(arr ?? '')),
  indent: (text, spaces = 2) => {
    const pad = ' '.repeat(Number(spaces));
    return String(text ?? '')
      .split('\n')
      .map((line) => (line.length > 0 ? `${pad}${line}` : line))
      .join('\n');
  },
  json: (val, spaces = 2) => JSON.stringify(val, null, Number(spaces)),
  eq: (a, b) => a === b,
  neq: (a, b) => a !== b,
  length: (val) => (Array.isArray(val) || typeof val === 'string' ? val.length : 0),
  trim: (val) => String(val ?? '').trim(),
  first: (arr) => (Array.isArray(arr) && arr.length > 0 ? arr[0] : null),
  last: (arr) => (Array.isArray(arr) && arr.length > 0 ? arr[arr.length - 1] : null),
  default: (val, fallback) => (val !== undefined && val !== null && val !== '' ? val : fallback)
});

/**
 * tokenises raw template string into text and tag segments
 */
function tokenize_template(template_str) {
  const tokens = [];
  const regex = /\{\{([^{}]+)\}\}/g;
  let last_index = 0;
  let match;

  while ((match = regex.exec(template_str)) !== null) {
    if (match.index > last_index) {
      tokens.push({ type: 'text', value: template_str.slice(last_index, match.index) });
    }
    const raw_tag = match[1].trim();
    tokens.push({ type: 'tag', content: raw_tag });
    last_index = regex.lastIndex;
  }

  if (last_index < template_str.length) {
    tokens.push({ type: 'text', value: template_str.slice(last_index) });
  }

  return tokens;
}

/**
 * parses token list into recursive abstract syntax tree
 */
function parse_ast_nodes(tokens, index_ref, stop_predicate = null) {
  const nodes = [];

  while (index_ref.idx < tokens.length) {
    const token = tokens[index_ref.idx];
    if (stop_predicate && stop_predicate(token)) {
      break;
    }
    index_ref.idx += 1;

    if (token.type === 'text') {
      nodes.push({ type: 'text', value: token.value });
    } else if (token.type === 'tag') {
      const content = token.content;

      if (content.startsWith('#if ')) {
        const condition = content.slice(4).trim();
        const then_branch = parse_ast_nodes(tokens, index_ref, (t) => t.type === 'tag' && (t.content === 'else' || t.content === '#else' || t.content === '/if'));
        let else_branch = [];
        if (index_ref.idx < tokens.length && (tokens[index_ref.idx].content === 'else' || tokens[index_ref.idx].content === '#else')) {
          index_ref.idx += 1;
          else_branch = parse_ast_nodes(tokens, index_ref, (t) => t.type === 'tag' && t.content === '/if');
        }
        if (index_ref.idx < tokens.length && tokens[index_ref.idx].content === '/if') {
          index_ref.idx += 1;
        }
        nodes.push({ type: 'if', condition, then_branch, else_branch });
      } else if (content.startsWith('#unless ')) {
        const condition = content.slice(8).trim();
        const then_branch = parse_ast_nodes(tokens, index_ref, (t) => t.type === 'tag' && (t.content === 'else' || t.content === '#else' || t.content === '/unless'));
        let else_branch = [];
        if (index_ref.idx < tokens.length && (tokens[index_ref.idx].content === 'else' || tokens[index_ref.idx].content === '#else')) {
          index_ref.idx += 1;
          else_branch = parse_ast_nodes(tokens, index_ref, (t) => t.type === 'tag' && t.content === '/unless');
        }
        if (index_ref.idx < tokens.length && tokens[index_ref.idx].content === '/unless') {
          index_ref.idx += 1;
        }
        nodes.push({ type: 'unless', condition, then_branch, else_branch });
      } else if (content.startsWith('#each ')) {
        const collection = content.slice(6).trim();
        const body = parse_ast_nodes(tokens, index_ref, (t) => t.type === 'tag' && (t.content === 'else' || t.content === '#else' || t.content === '/each'));
        let else_branch = [];
        if (index_ref.idx < tokens.length && (tokens[index_ref.idx].content === 'else' || tokens[index_ref.idx].content === '#else')) {
          index_ref.idx += 1;
          else_branch = parse_ast_nodes(tokens, index_ref, (t) => t.type === 'tag' && t.content === '/each');
        }
        if (index_ref.idx < tokens.length && tokens[index_ref.idx].content === '/each') {
          index_ref.idx += 1;
        }
        nodes.push({ type: 'each', collection, body, else_branch });
      } else if (content.startsWith('>')) {
        const partial_name = content.slice(1).trim();
        nodes.push({ type: 'partial', name: partial_name });
      } else {
        nodes.push({ type: 'expression', raw: content });
      }
    }
  }

  return nodes;
}

/**
 * parses expression tokens respecting quoted string literals
 */
function parse_expression_tokens(expr_str) {
  const tokens = [];
  let current = '';
  let in_quotes = false;
  let quote_char = '';

  for (let i = 0; i < expr_str.length; i += 1) {
    const char = expr_str[i];
    if ((char === '"' || char === "'") && !in_quotes) {
      in_quotes = true;
      quote_char = char;
      current += char;
    } else if (char === quote_char && in_quotes) {
      in_quotes = false;
      quote_char = '';
      current += char;
    } else if (/\s/.test(char) && !in_quotes) {
      if (current.length > 0) {
        tokens.push(current);
        current = '';
      }
    } else {
      current += char;
    }
  }
  if (current.length > 0) {
    tokens.push(current);
  }
  return tokens;
}

/**
 * evaluates a single value or variable lookup against context stack
 */
function resolve_term_value(term, context_stack, helpers) {
  const trimmed = term.trim();

  // 1. string literal
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }

  // 2. number literal
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return Number(trimmed);
  }

  // 3. boolean and null literals
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed === 'null') return null;
  if (trimmed === 'undefined') return undefined;

  // 4. direct lookup in context stack
  for (let i = context_stack.length - 1; i >= 0; i -= 1) {
    const ctx = context_stack[i];
    if (ctx && typeof ctx === 'object') {
      if (trimmed in ctx) {
        return ctx[trimmed];
      }
    }
  }

  // 5. dot notation path traversal
  const parts = trimmed.split('.');
  let current = null;
  let found = false;

  for (let i = context_stack.length - 1; i >= 0; i -= 1) {
    const ctx = context_stack[i];
    if (ctx && typeof ctx === 'object') {
      const root_key = parts[0];
      if (root_key === 'this') {
        current = ctx;
        found = true;
        break;
      }
      if (root_key in ctx) {
        current = ctx[root_key];
        found = true;
        break;
      }
    }
  }

  if (found) {
    const start_index = parts[0] === 'this' ? 1 : 1;
    for (let p = start_index; p < parts.length; p += 1) {
      if (current === null || current === undefined) {
        return '';
      }
      current = current[parts[p]];
    }
    return current;
  }

  return '';
}

/**
 * evaluates truthiness for if and unless statements
 */
function evaluate_truthiness(val) {
  if (!val) return false;
  if (Array.isArray(val) && val.length === 0) return false;
  if (typeof val === 'object' && Object.keys(val).length === 0) return false;
  return true;
}

/**
 * evaluates expression with optional helper invocations and pipeline filters
 */
function evaluate_expression(expr_str, context_stack, helpers) {
  // check for pipeline filter syntax: expr | filter1 | filter2 arg
  if (expr_str.includes('|')) {
    const segments = expr_str.split('|');
    let current_val = evaluate_expression(segments[0].trim(), context_stack, helpers);

    for (let s = 1; s < segments.length; s += 1) {
      const filter_tokens = parse_expression_tokens(segments[s].trim());
      const filter_name = filter_tokens[0];
      const fn = helpers[filter_name];
      if (typeof fn === 'function') {
        const extra_args = filter_tokens.slice(1).map((arg) => resolve_term_value(arg, context_stack, helpers));
        current_val = fn(current_val, ...extra_args);
      }
    }
    return current_val;
  }

  const tokens = parse_expression_tokens(expr_str.trim());
  if (tokens.length === 0) return '';

  const first = tokens[0];
  if (first in helpers && typeof helpers[first] === 'function') {
    const args = tokens.slice(1).map((arg) => resolve_term_value(arg, context_stack, helpers));
    return helpers[first](...args);
  }

  return resolve_term_value(first, context_stack, helpers);
}

/**
 * renders AST nodes recursively with context stack and helpers
 */
function render_ast(nodes, context_stack, helpers, partials) {
  let output = '';

  for (let n = 0; n < nodes.length; n += 1) {
    const node = nodes[n];

    if (node.type === 'text') {
      output += node.value;
    } else if (node.type === 'expression') {
      const val = evaluate_expression(node.raw, context_stack, helpers);
      if (val !== undefined && val !== null) {
        output += String(val);
      }
    } else if (node.type === 'if') {
      const condition_val = evaluate_expression(node.condition, context_stack, helpers);
      if (evaluate_truthiness(condition_val)) {
        output += render_ast(node.then_branch, context_stack, helpers, partials);
      } else if (node.else_branch && node.else_branch.length > 0) {
        output += render_ast(node.else_branch, context_stack, helpers, partials);
      }
    } else if (node.type === 'unless') {
      const condition_val = evaluate_expression(node.condition, context_stack, helpers);
      if (!evaluate_truthiness(condition_val)) {
        output += render_ast(node.then_branch, context_stack, helpers, partials);
      } else if (node.else_branch && node.else_branch.length > 0) {
        output += render_ast(node.else_branch, context_stack, helpers, partials);
      }
    } else if (node.type === 'each') {
      const target = evaluate_expression(node.collection, context_stack, helpers);
      if (Array.isArray(target) && target.length > 0) {
        for (let i = 0; i < target.length; i += 1) {
          const item = target[i];
          const loop_ctx = {
            this: item,
            '@index': i,
            '@number': i + 1,
            '@first': i === 0,
            '@last': i === target.length - 1
          };
          if (item && typeof item === 'object') {
            Object.assign(loop_ctx, item);
          }
          context_stack.push(loop_ctx);
          output += render_ast(node.body, context_stack, helpers, partials);
          context_stack.pop();
        }
      } else if (node.else_branch && node.else_branch.length > 0) {
        output += render_ast(node.else_branch, context_stack, helpers, partials);
      }
    } else if (node.type === 'partial') {
      const partial_template = partials[node.name];
      if (partial_template) {
        const tokens = tokenize_template(partial_template);
        const sub_ast = parse_ast_nodes(tokens, { idx: 0 });
        output += render_ast(sub_ast, context_stack, helpers, partials);
      }
    }
  }

  return output;
}

/**
 * class: BuiltinTemplateAdapter
 * tldr: dependency-free template adapter rendering through the engine's shared helpers and partials
 */
class BuiltinTemplateAdapter extends TemplateAdapter {
  constructor(engine) {
    super('builtin');
    this.engine = engine;
  }

  register_helper(name, fn) {
    this.engine.helpers[name] = fn;
    return this;
  }

  register_partial(name, str) {
    this.engine.partials[name] = str;
    return this;
  }

  compile(template_str) {
    const tokens = tokenize_template(template_str);
    const ast = parse_ast_nodes(tokens, { idx: 0 });
    return (context = {}) => render_ast(ast, [context], this.engine.helpers, this.engine.partials);
  }

  render(template_str, context = {}) {
    return this.compile(template_str)(context);
  }
}

/**
 * =========================================================================
 * function: create_template_engine
 * =========================================================================
 * 
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: creates a flexible template engine instance
 * verbose: compiles and renders templates for documents and code generation
 * with variable lookups, each loops, conditionals, pipeline filters, and partials.
 * 
 * section: arguments
 * - options (object, optional): configuration options
 *   - templates_dir (string): path to templates directory
 *   - helpers (object): custom helper functions
 *   - partials (object): custom partial templates
 * 
 * section: return value
 * - engine (object): operational template engine interface
 * 
 * section: example
 * const engine = create_template_engine();
 * const out = engine.render('hello {{name}}', { name: 'world' });
 * =========================================================================
 */
export class TemplateEngine {
  helpers;
  partials;
  active_adapter;
  active_adapter_name;
  template_cache;
  templates_dir;

  constructor(options = {}) {
    this.templates_dir = options.templates_dir || default_templates_dir;

    this.helpers = Object.assign({}, BUILTIN_HELPERS, options.helpers || {});

    this.partials = Object.assign({}, options.partials || {});

    this.template_cache = new Map();

    this.active_adapter_name = options.adapter || 'handlebars';

    this.active_adapter = null;

    this.active_adapter = this.#init_adapter(this.active_adapter_name);

  }

  #create_builtin_adapter() {
    return new BuiltinTemplateAdapter(this);
  }

  #init_adapter(adapter_name) {
    if (adapter_name === 'handlebars') {
      try {
        return new HandlebarsTemplateAdapter({ helpers: this.helpers, partials: this.partials });
      } catch (_err) {
        return this.#create_builtin_adapter();
      }
    }
    return this.#create_builtin_adapter();
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: returns current active template adapter
   * verbose: inspects active template backend (handlebars or builtin).
   * 
   * section: arguments
   * none
   * 
   * section: return value
   * - adapter (object): active template adapter
   * 
   * section: example
   * const ad = engine.get_adapter();
   */
  get_adapter() {
    return this.active_adapter;
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: sets active template adapter
   * verbose: switches template backend to handlebars or builtin.
   * 
   * section: arguments
   * - adapter_name (string): adapter identifier ('handlebars' or 'builtin')
   * 
   * section: return value
   * - engine (object): self reference
   * 
   * section: example
   * engine.set_adapter('builtin');
   */
  set_adapter(adapter_name) {
    this.active_adapter_name = adapter_name;
    this.active_adapter = this.#init_adapter(adapter_name);
    return this;
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: registers a custom helper function
   * verbose: binds helper to internal helper dictionary and active adapter.
   * 
   * section: arguments
   * - name (string): helper identifier
   * - fn (function): helper execution function
   * 
   * section: return value
   * - engine (object): self reference
   * 
   * section: example
   * engine.register_helper('shout', (text) => `${text}!!!`);
   */
  register_helper(name, fn) {
    if (typeof fn === 'function') {
      this.helpers[name] = fn;
      if (this.active_adapter && this.active_adapter.register_helper) {
        this.active_adapter.register_helper(name, fn);
      }
    }
    return this;
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: registers a template partial
   * verbose: stores reusable template snippet for {{> partial_name}} inclusion.
   * 
   * section: arguments
   * - name (string): partial name
   * - template_str (string): raw partial template content
   * 
   * section: return value
   * - engine (object): self reference
   * 
   * section: example
   * engine.register_partial('header', '# {{title}}\n');
   */
  register_partial(name, template_str) {
    this.partials[name] = template_str;
    if (this.active_adapter && this.active_adapter.register_partial) {
      this.active_adapter.register_partial(name, template_str);
    }
    return this;
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: registers a named template string
   * verbose: stores raw template in cache under specified identifier.
   * 
   * section: arguments
   * - name (string): template identifier
   * - template_str (string): raw template string
   * 
   * section: return value
   * - engine (object): self reference
   * 
   * section: example
   * engine.register_template('greeting', 'hello {{name}}');
   */
  register_template(name, template_str) {
    this.template_cache.set(name, template_str);
    return this;
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: loads template from file system or internal cache
   * verbose: checks cache first, then reads from configured templates directory.
   * 
   * section: arguments
   * - template_name (string): template filename or identifier
   * 
   * section: return value
   * - template_content (string): loaded raw template string
   * 
   * section: example
   * const tpl = engine.load_template('documents/prd.md.tpl');
   */
  load_template(template_name) {
    if (this.template_cache.get(template_name)) {
      return this.template_cache.get(template_name);
    }

    const candidate_paths = [
      path.isAbsolute(template_name) ? template_name : path.join(this.templates_dir, template_name),
      path.join(this.templates_dir, `${template_name}.tpl`),
      path.join(this.templates_dir, `${template_name}.md.tpl`),
      path.join(this.templates_dir, 'documents', `${template_name}.md.tpl`),
      path.join(this.templates_dir, 'documents', `${template_name}.tpl`),
      path.join(this.templates_dir, 'code', `${template_name}.tpl`),
      path.join(this.templates_dir, 'code', `${template_name}.js.tpl`)
    ];

    for (let i = 0; i < candidate_paths.length; i += 1) {
      const p = candidate_paths[i];
      if (fs.existsSync(p)) {
        const content = fs.readFileSync(p, 'utf-8');
        this.template_cache.set(template_name, content);
        return content;
      }
    }

    throw new Error(`template not found: "${template_name}"`);
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: compiles template string into an executable render function
   * verbose: delegates compilation to active template adapter.
   * 
   * section: arguments
   * - template_str (string): raw template string
   * 
   * section: return value
   * - render_fn (function): (context) => string
   * 
   * section: example
   * const compiled = engine.compile('hi {{name}}');
   * const res = compiled({ name: 'alice' });
   */
  compile(template_str) {
    return this.active_adapter.compile(template_str);
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: renders a template string or named template with context
   * verbose: compiles and renders data against resolved template using active adapter.
   * 
   * section: arguments
   * - template_str_or_name (string): template content or registered name
   * - context (object): data context
   * 
   * section: return value
   * - rendered (string): compiled text output
   * 
   * section: example
   * const output = engine.render('hello {{name}}', { name: 'developer' });
   */
  render(template_str_or_name, context = {}) {
    let tpl = template_str_or_name;
    if (!tpl.includes('{{')) {
      try {
        tpl = this.load_template(tpl);
      } catch (_err) {
        // not a template name or file, treat as literal template string
      }
    }
    return this.active_adapter.render(tpl, context);
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: generates code snippet from template
   * verbose: resolves code snippet template and compiles structured entity into executable source code.
   * 
   * section: arguments
   * - snippet_type (string): code snippet type (test_suite, factory_function, gherkin_feature, interface_stub)
   * - context (object): structured entity context
   * 
   * section: return value
   * - code (string): synthesised source code snippet
   * 
   * section: example
   * const test_code = engine.generate_code('test_suite', user_story_entity);
   */
  generate_code(snippet_type, context = {}) {
    const template_content = this.load_template(`code/${snippet_type}`);
    return this.render(template_content, context);
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: renders structured entity as markdown document using document template
   * verbose: loads document template from templates/documents/ and compiles entity.
   * 
   * section: arguments
   * - doc_type (string): document category (prd, story, task, adr, threat_model, test_report, release, retrospective)
   * - entity (object): structured document entity
   * 
   * section: return value
   * - markdown (string): rendered markdown document
   * 
   * section: example
   * const md = engine.render_document('prd', prd_entity);
   */
  render_document(doc_type, entity = {}) {
    const template_content = this.load_template(`documents/${doc_type}`);
    return this.render(template_content, entity);
  }
}

export function create_template_engine(options = {}) {
  return new TemplateEngine(options);
}

