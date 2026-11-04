/**
 * =========================================================================
 * module: DocumentBuilder.js
 * =========================================================================
 * 
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: fluent code-driven template-backed document builder
 * verbose: provides fluent functional builders for programmatic markdown
 * document creation (prds, adrs, threat models, test reports, release manifests, retrospectives)
 * supporting unbroken method and section chaining, structured blocks, and path-sanitised persistence.
 * 
 * section: arguments
 * none
 * 
 * section: return value
 * - object: exports factory functions and pre-bound document type creators
 * 
 * section: example
 * import { prd } from './DocumentBuilder.js';
 * const doc = prd.create('helloworld').title('helloworld').description('helloworld')
 *   .section.create('helloworld').heading('helloworld').contents('hellworld');
 * =========================================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { create_template_engine } from './TemplateEngine.js';

const default_package_root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const default_template_engine = create_template_engine({
  templates_dir: path.join(default_package_root, 'templates')
});

/**
 * =========================================================================
 * function: render_markdown_table
 * =========================================================================
 * 
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: renders a standard markdown table string from headers and rows
 * verbose: formats header row, separator line, and content rows with markdown pipes.
 * 
 * section: arguments
 * - headers (array): column header labels
 * - rows (array): array of row arrays
 * 
 * section: return value
 * - rendered (string): formatted markdown table string
 * 
 * section: example
 * const table_md = render_markdown_table(['a', 'b'], [['1', '2']]);
 * =========================================================================
 */
export function render_markdown_table(headers = [], rows = []) {
  if (!headers || headers.length === 0) return '';
  const header_line = `| ${headers.join(' | ')} |`;
  const sep_line = `| ${headers.map(() => '---').join(' | ')} |`;
  const row_lines = (rows || []).map((r) => `| ${r.join(' | ')} |`).join('\n');
  return `${header_line}\n${sep_line}${row_lines.length > 0 ? `\n${row_lines}` : ''}`;
}

/**
 * =========================================================================
 * class: SectionBuilder
 * =========================================================================
 * 
 * section: version number
 * version: 0.2.0
 * 
 * section: documentation
 * tldr: fluent section builder with unbroken chaining
 * verbose: captures section heading, paragraphs, code blocks, tables, and lists,
 * while delegating document-level methods and subsequent section creation to its parent DocumentBuilder.
 * 
 * section: example
 * const sec = new SectionBuilder('intro', doc);
 * sec.heading('introduction').contents('welcome to the project.');
 * =========================================================================
 */
export class SectionBuilder {
  section_heading;
  content_blocks = [];

  constructor(section_id, doc) {
    this.id = section_id;
    this.section_heading = section_id;
    this.doc = doc;
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: sets section heading text
   * verbose: updates section heading label and returns section builder for chaining.
   * 
   * section: arguments
   * - text (string): section heading title
   * 
   * section: return value
   * - section_builder (object): self reference for chaining
   * 
   * section: example
   * sec.heading('executive summary');
   */
  heading(text) {
    this.section_heading = text;
    return this;
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: sets or appends main section body contents
   * verbose: appends paragraph text to section content blocks.
   * 
   * section: arguments
   * - text (string): body content string
   * 
   * section: return value
   * - section_builder (object): self reference for chaining
   * 
   * section: example
   * sec.contents('detailed specifications');
   */
  contents(text) {
    if (text !== undefined && text !== null) {
      this.content_blocks.push(String(text));
    }
    return this;
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: appends paragraph text
   * verbose: adds text block to section.
   * 
   * section: arguments
   * - text (string): paragraph text
   * 
   * section: return value
   * - section_builder (object): self reference
   * 
   * section: example
   * sec.text('additional context');
   */
  text(text) {
    if (text !== undefined && text !== null) {
      this.content_blocks.push(String(text));
    }
    return this;
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: appends fenced code block to section
   * verbose: wraps code snippet in triple backticks with specified language identifier.
   * 
   * section: arguments
   * - lang (string): code syntax language
   * - snippet (string): source code snippet
   * 
   * section: return value
   * - section_builder (object): self reference
   * 
   * section: example
   * sec.code('javascript', 'const a = 1;');
   */
  code(lang, snippet) {
    this.content_blocks.push(`\`\`\`${lang || ''}\n${snippet || ''}\n\`\`\``);
    return this;
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: appends markdown table to section
   * verbose: formats headers and rows into markdown table block.
   * 
   * section: arguments
   * - headers (array): header labels
   * - rows (array): row data arrays
   * 
   * section: return value
   * - section_builder (object): self reference
   * 
   * section: example
   * sec.table(['id', 'name'], [['1', 'item']]);
   */
  table(headers, rows) {
    this.content_blocks.push(render_markdown_table(headers, rows));
    return this;
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: appends markdown bullet list to section
   * verbose: formats array of strings into markdown list items.
   * 
   * section: arguments
   * - items (array): list item strings
   * 
   * section: return value
   * - section_builder (object): self reference
   * 
   * section: example
   * sec.list(['item 1', 'item 2']);
   */
  list(items = []) {
    const list_md = items.map((it) => `- ${it}`).join('\n');
    this.content_blocks.push(list_md);
    return this;
  }

  get_heading() {
    return this.section_heading;
  }

  get_contents() {
    return this.content_blocks.join('\n\n');
  }

  get_document() {
    return this.doc;
  }

  // document method delegations for unbroken chaining
  get section() {
    return this.doc.section;
  }

  title(text) {
    this.doc.title(text);
    return this;
  }

  description(text) {
    this.doc.description(text);
    return this;
  }

  document_id(id) {
    this.doc.document_id(id);
    return this;
  }

  status(stat) {
    this.doc.status(stat);
    return this;
  }

  author(auth) {
    this.doc.author(auth);
    return this;
  }

  date(d) {
    this.doc.date(d);
    return this;
  }

  render() {
    return this.doc.render();
  }

  to_markdown() {
    return this.doc.to_markdown();
  }

  save(file_path) {
    return this.doc.save(file_path);
  }
}

/**
 * =========================================================================
 * class: DocumentBuilder
 * =========================================================================
 * 
 * section: version number
 * version: 0.2.0
 * 
 * section: documentation
 * tldr: fluent, template-backed markdown document builder
 * verbose: base class for all canonical document builders. subclasses (PrdBuilder, AdrBuilder, ...)
 * fix the template type and may override rendering behaviour.
 * 
 * section: arguments
 * - template_type (string): canonical template type
 * - doc_name (string): document name
 * - options (object, optional): { workspace_root }
 * 
 * section: example
 * const builder = new DocumentBuilder('prd', 'auth');
 * builder.title('authentication system').save('docs/prd.md');
 * =========================================================================
 */
export class DocumentBuilder {
  sections = [];
  metadata_entries = [];

  constructor(template_type = 'generic', doc_name = 'document', options = {}) {
    this.template_type = template_type;
    this.options = options;
    this.doc_title = doc_name;
    this.doc_description = '';
    this.doc_id = `${template_type}-${doc_name}.md`;
    this.doc_status = 'approved';
    this.doc_author = 'autonomous agent';
    this.doc_date = new Date().toISOString().split('T')[0];
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: sets document title
   * verbose: updates primary document title and returns self for chaining.
   * 
   * section: arguments
   * - text (string): document title
   * 
   * section: return value
   * - builder (object): self reference
   * 
   * section: example
   * builder.title('feature specifications');
   */
  title(text) {
    this.doc_title = text;
    return this;
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: sets document executive summary or description
   * verbose: sets high-level description and returns self for chaining.
   * 
   * section: arguments
   * - text (string): description string
   * 
   * section: return value
   * - builder (object): self reference
   * 
   * section: example
   * builder.description('high-level architectural vision');
   */
  description(text) {
    this.doc_description = text;
    return this;
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: sets formal document identifier
   * verbose: updates document id metadata field.
   * 
   * section: arguments
   * - id (string): document identifier string
   * 
   * section: return value
   * - builder (object): self reference
   * 
   * section: example
   * builder.document_id('prd-01-core.md');
   */
  document_id(id) {
    this.doc_id = id;
    return this;
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: sets document review status
   * verbose: updates governance status.
   * 
   * section: arguments
   * - status_val (string): status (e.g. proposed, approved, accepted)
   * 
   * section: return value
   * - builder (object): self reference
   * 
   * section: example
   * builder.status('accepted');
   */
  status(status_val) {
    this.doc_status = status_val;
    return this;
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: sets document author
   * verbose: updates author metadata.
   * 
   * section: arguments
   * - author_val (string): author identity
   * 
   * section: return value
   * - builder (object): self reference
   * 
   * section: example
   * builder.author('software-engineer');
   */
  author(author_val) {
    this.doc_author = author_val;
    return this;
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: sets document publication date
   * verbose: updates date metadata.
   * 
   * section: arguments
   * - date_val (string): date string
   * 
   * section: return value
   * - builder (object): self reference
   * 
   * section: example
   * builder.date('2026-11-03');
   */
  date(date_val) {
    this.doc_date = date_val;
    return this;
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: attaches custom metadata key-value pair
   * verbose: appends metadata entry to document headers.
   * 
   * section: arguments
   * - key (string): metadata key
   * - value (string): metadata value
   * 
   * section: return value
   * - builder (object): self reference
   * 
   * section: example
   * builder.metadata('component', '@thing/sdlc-dual_engine_harness');
   */
  metadata(key, value) {
    this.metadata_entries.push({ key, value });
    return this;
  }

  get section() {
    return {
      create: (section_id) => {
        const sec = new SectionBuilder(section_id, this);
        this.sections.push(sec);
        return sec;
      }
    };
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: adds a configured section directly
   * verbose: registers an existing section object or specification.
   * 
   * section: arguments
   * - section_spec (object): { id, heading, contents }
   * 
   * section: return value
   * - builder (object): self reference
   * 
   * section: example
   * builder.add_section({ id: 'overview', heading: 'overview', contents: 'text' });
   */
  add_section(section_spec = {}) {
    const sec = new SectionBuilder(section_spec.id || `sec-${this.sections.length + 1}`, this);
    if (section_spec.heading) sec.heading(section_spec.heading);
    if (section_spec.contents) sec.contents(section_spec.contents);
    this.sections.push(sec);
    return this;
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: renders the document into formatted markdown
   * verbose: compiles title, metadata table, executive summary, and numbered sections into a single markdown string.
   * 
   * section: arguments
   * none
   * 
   * section: return value
   * - markdown (string): fully rendered markdown document
   * 
   * section: example
   * const md = builder.render();
   */
  render() {
    const lines = [];

    // 1. primary document heading
    let heading_title = this.doc_title;
    if (this.template_type === 'task' && !this.doc_title.toLowerCase().startsWith('task:') && !this.doc_title.toLowerCase().startsWith('task-')) {
      heading_title = `task: ${this.doc_title}`;
    } else if (this.template_type === 'adr' && !this.doc_title.toLowerCase().startsWith('adr:') && !this.doc_title.toLowerCase().startsWith('adr-')) {
      heading_title = `adr: ${this.doc_title}`;
    }
    lines.push(`# ${heading_title}\n`);

    // 2. metadata header block
    lines.push(`**document id:** \`${this.doc_id}\`  `);
    lines.push(`**system / component:** \`@thing/sdlc-dual_engine_harness\`  `);
    lines.push(`**status:** ${this.doc_status}  `);
    lines.push(`**author:** ${this.doc_author}  `);
    lines.push(`**date:** ${this.doc_date}  `);

    for (let m = 0; m < this.metadata_entries.length; m += 1) {
      lines.push(`**${this.metadata_entries[m].key}:** ${this.metadata_entries[m].value}  `);
    }

    lines.push('\n---\n');

    // 3. executive summary / description block if provided
    if (this.doc_description) {
      lines.push(`${this.doc_description}\n`);
      lines.push('---\n');
    }

    // 4. numbered custom sections
    for (let s = 0; s < this.sections.length; s += 1) {
      const sec = this.sections[s];
      const num = s + 1;
      lines.push(`## ${num}. ${sec.get_heading()}\n`);
      const body = sec.get_contents();
      if (body) {
        lines.push(`${body}\n`);
      }
    }

    return lines.join('\n').trim() + '\n';
  }

  to_markdown() {
    return this.render();
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: writes rendered markdown document to disk
   * verbose: validates path against workspace boundaries, creates parent directories recursively, and saves file.
   * 
   * section: arguments
   * - file_path (string): destination file path
   * 
   * section: return value
   * - result (object): { saved: true, path: target_path, bytes: number }
   * 
   * section: example
   * builder.save('docs/prd-example.md');
   */
  save(file_path) {
    if (!file_path) {
      throw new Error('missing_file_path: save requires a valid target file path');
    }

    const workspace_root = path.resolve(this.options.workspace_root || process.cwd());
    const target_path = path.resolve(workspace_root, file_path);

    if (!target_path.startsWith(workspace_root)) {
      throw new Error(`security_violation: file path '${file_path}' resolves outside workspace root '${workspace_root}'`);
    }

    const dir = path.dirname(target_path);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const markdown = this.render();
    fs.writeFileSync(target_path, markdown, 'utf-8');

    return {
      saved: true,
      path: target_path,
      bytes: Buffer.byteLength(markdown, 'utf-8')
    };
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: renders custom template with context
   * verbose: applies template engine to compile template and append to document sections or return rendered text.
   * 
   * section: arguments
   * - template_name_or_str (string): template identifier or content
   * - context (object): data context
   * 
   * section: return value
   * - rendered (string): rendered content
   * 
   * section: example
   * builder.use_template('documents/prd', prd_entity);
   */
  use_template(template_name_or_str, context = {}) {
    return default_template_engine.render(template_name_or_str, context);
  }
}

export class PrdBuilder extends DocumentBuilder {
  constructor(name, options) {
    super('prd', name, options);
  }
}

export class AdrBuilder extends DocumentBuilder {
  constructor(name, options) {
    super('adr', name, options);
  }
}

export class ThreatModelBuilder extends DocumentBuilder {
  constructor(name, options) {
    super('threat_model', name, options);
  }
}

export class TestReportBuilder extends DocumentBuilder {
  constructor(name, options) {
    super('test_report', name, options);
  }
}

export class ReleaseBuilder extends DocumentBuilder {
  constructor(name, options) {
    super('release', name, options);
  }
}

export class RetrospectiveBuilder extends DocumentBuilder {
  constructor(name, options) {
    super('retrospective', name, options);
  }
}

export class TaskBuilder extends DocumentBuilder {
  constructor(name, options) {
    super('task', name, options);
  }
}

export class WorkBreakdownBuilder extends DocumentBuilder {
  constructor(name, options) {
    super('work_breakdown', name, options);
  }
}

export class GenericDocumentBuilder extends DocumentBuilder {
  constructor(name, options) {
    super('generic', name, options);
  }
}

/**
 * function: create_document_builder
 * tldr: convenience constructor returning the DocumentBuilder subclass for a template type
 */
const builder_classes = new Map([
  ['prd', PrdBuilder],
  ['adr', AdrBuilder],
  ['threat_model', ThreatModelBuilder],
  ['test_report', TestReportBuilder],
  ['release', ReleaseBuilder],
  ['retrospective', RetrospectiveBuilder],
  ['task', TaskBuilder],
  ['work_breakdown', WorkBreakdownBuilder],
  ['generic', GenericDocumentBuilder]
]);

export function create_document_builder(template_type = 'generic', doc_name = 'document', options = {}) {
  const BuilderClass = builder_classes.get(template_type);
  return BuilderClass ? new BuilderClass(doc_name, options) : new DocumentBuilder(template_type, doc_name, options);
}

/**
 * =========================================================================
 * function: render_template
 * =========================================================================
 * 
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: renders template string or named template using shared engine
 * verbose: compiles template against provided context data dictionary.
 * 
 * section: arguments
 * - template_str_or_name (string): raw template or named identifier
 * - context (object): data context
 * 
 * section: return value
 * - rendered (string): compiled text
 * 
 * section: example
 * const text = render_template('hello {{name}}', { name: 'developer' });
 * =========================================================================
 */
export function render_template(template_str_or_name, context = {}) {
  return default_template_engine.render(template_str_or_name, context);
}

/**
 * =========================================================================
 * function: generate_code_snippet
 * =========================================================================
 * 
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: generates source code snippet from template
 * verbose: compiles structured entity against code template (test_suite, factory_function, gherkin_feature, interface_stub).
 * 
 * section: arguments
 * - snippet_type (string): code template type
 * - context (object): structured entity context
 * - options (object, optional): generation options
 * 
 * section: return value
 * - result (object): { code, path, bytes }
 * 
 * section: example
 * const res = generate_code_snippet('test_suite', user_story_entity);
 * =========================================================================
 */
export function generate_code_snippet(snippet_type, context = {}, options = {}) {
  const engine = options.template_engine || default_template_engine;
  const code = engine.generate_code(snippet_type, context);

  let written_path = null;
  if (options.target_file) {
    const full_path = path.resolve(options.target_file);
    const dir = path.dirname(full_path);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(full_path, code, 'utf-8');
    written_path = full_path;
  }

  return {
    code,
    path: written_path,
    bytes: Buffer.byteLength(code, 'utf-8')
  };
}

/**
 * =========================================================================
 * function: export_documents_from_store
 * =========================================================================
 * 
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: exports documents from datastore to file system using templates
 * verbose: walks store collections, compiles entities via template engine, and writes standard hierarchy to disk.
 * 
 * section: arguments
 * - store (object): DocumentEntityStore instance
 * - options (object, optional): export configuration options
 *   - target_dir (string): destination directory, defaults to docs
 *   - template_engine (object, optional): custom template engine instance
 * 
 * section: return value
 * - report (object): export receipt with total count and written file paths
 * 
 * section: example
 * const report = export_documents_from_store(store, { target_dir: 'dist/docs' });
 * =========================================================================
 */
export function export_documents_from_store(store, options = {}) {
  const engine = options.template_engine || default_template_engine;
  const target_dir = path.resolve(options.target_dir || path.join(default_package_root, 'docs'));

  const type_dir_map = [
    { type: 'prd', dir: '01-product', prefix: 'prd', tpl: 'documents/prd' },
    { type: 'adr', dir: path.join('02-architecture', 'adr'), prefix: 'adr', tpl: 'documents/adr' },
    { type: 'user_story', dir: '05-work-breakdown', prefix: 'story', tpl: 'documents/story' },
    { type: 'threat_model', dir: '07-security', prefix: 'sec', tpl: 'documents/threat_model' },
    { type: 'release_manifest', dir: '08-operations', prefix: 'rel', tpl: 'documents/release' },
    { type: 'test_report', dir: '09-qa-testing', prefix: 'qa', tpl: 'documents/test_report' },
    { type: 'retrospective', dir: '10-continuous-learning', prefix: 'ret', tpl: 'documents/retrospective' }
  ];

  const written_files = [];

  for (let m = 0; m < type_dir_map.length; m += 1) {
    const mapping = type_dir_map[m];
    const entities = store.list_entities(mapping.type);
    const dest_dir = path.join(target_dir, mapping.dir);

    for (let e = 0; e < entities.length; e += 1) {
      const entity = entities[e];
      const rendered = engine.render(mapping.tpl, entity);
      const safe_slug = (entity.slug || 'doc').replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `${entity.id}-${safe_slug}.md`;
      const full_path = path.join(dest_dir, filename);

      if (!fs.existsSync(dest_dir)) {
        fs.mkdirSync(dest_dir, { recursive: true });
      }

      fs.writeFileSync(full_path, rendered, 'utf-8');
      written_files.push(full_path);
    }
  }

  return {
    exported_count: written_files.length,
    files: written_files
  };
}

/**
 * =========================================================================
 * function: get_default_template_engine
 * =========================================================================
 * 
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: returns default shared template engine instance
 * verbose: provides access to singleton template engine configured with canonical templates.
 * 
 * section: arguments
 * none
 * 
 * section: return value
 * - engine (object): operational template engine
 * 
 * section: example
 * const engine = get_default_template_engine();
 * =========================================================================
 */
export function get_default_template_engine() {
  return default_template_engine;
}

/**
 * =========================================================================
 * function: chunk_markdown_sections
 * =========================================================================
 * 
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: splits rendered markdown into section-bounded chunks for hybrid rag indexing
 * verbose: parses markdown documents along top-level and level-2 heading boundaries
 * while preserving header metadata (doc_id, phase, linked_prd_id, status) on each chunk.
 * 
 * section: arguments
 * - markdown_text (string): rendered markdown string
 * - base_metadata (object, optional): metadata fields attached to each chunk
 * 
 * section: return value
 * - chunks (Array<object>): array of structured markdown section chunks
 * 
 * section: example
 * const chunks = chunk_markdown_sections(md, { doc_id: 'prd-01', phase: '01-product' });
 * =========================================================================
 */
export function chunk_markdown_sections(markdown_text, base_metadata = {}) {
  const raw = String(markdown_text || '').trim();
  if (!raw) {
    return [];
  }

  const id_match = raw.match(/\*\*document id:\*\*\s*`?([^`\n]+)`?/i);
  const status_match = raw.match(/\*\*status:\*\*\s*([^\n]+)/i);
  const resolved_doc_id = base_metadata.doc_id || (id_match ? id_match[1].trim() : 'unknown-doc');
  const resolved_status = base_metadata.status || (status_match ? status_match[1].trim() : 'approved');

  const lines = raw.split('\n');
  const sections = [];
  let current_heading = 'document overview';
  let current_lines = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^##\s+/.test(line)) {
      const body_text = current_lines.join('\n').trim();
      if (body_text) {
        sections.push({
          heading: current_heading,
          body: body_text
        });
      }
      current_heading = line.replace(/^##\s+/, '').trim();
      current_lines = [line];
    } else {
      current_lines.push(line);
    }
  }

  const trailing_body = current_lines.join('\n').trim();
  if (trailing_body) {
    sections.push({
      heading: current_heading,
      body: trailing_body
    });
  }

  const chunks = [];
  for (let i = 0; i < sections.length; i += 1) {
    const sec = sections[i];
    chunks.push({
      id: `${resolved_doc_id}#sec-${i}`,
      section_index: i,
      section_heading: sec.heading,
      text: sec.body,
      metadata: {
        ...base_metadata,
        doc_id: resolved_doc_id,
        status: resolved_status,
        section_heading: sec.heading
      }
    });
  }

  return chunks;
}

/**
 * section: export helper singletons for canonical document types
 */
export const prd = { create: (name, options) => new PrdBuilder(name, options) };
export const adr = { create: (name, options) => new AdrBuilder(name, options) };
export const threat_model = { create: (name, options) => new ThreatModelBuilder(name, options) };
export const test_report = { create: (name, options) => new TestReportBuilder(name, options) };
export const release = { create: (name, options) => new ReleaseBuilder(name, options) };
export const retrospective = { create: (name, options) => new RetrospectiveBuilder(name, options) };
export const task = { create: (name, options) => new TaskBuilder(name, options) };
export const work_breakdown = { create: (name, options) => new WorkBreakdownBuilder(name, options) };
export const doc = { create: (name, options) => new GenericDocumentBuilder(name, options) };
