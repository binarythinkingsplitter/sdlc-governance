/**
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: mermaid flowchart exporter for task dags
 * verbose: formats task directed acyclic graphs into canonical github-flavoured
 * mermaid flowchart syntax. decorates nodes with role badges, status styles, and
 * directional dependency edges as pure functions.
 * 
 * section: arguments
 * - dag (object): directed acyclic graph containing nodes array
 * - options (object, optional): formatting options including direction
 * 
 * section: return value
 * - mermaid (string): rendered mermaid flowchart markdown string
 * 
 * section: example
 * import { export_dag_to_mermaid } from './DagMermaidExporter.js';
 * const diagram = export_dag_to_mermaid({ nodes: [] });
 */

/**
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: sanitises a task identifier into a valid mermaid node id
 * verbose: replaces hyphens, dots, and non-alphanumeric characters with underscores.
 * 
 * section: arguments
 * - raw_id (string): unescaped task identifier
 * 
 * section: return value
 * - safe_id (string): sanitised identifier safe for mermaid syntax
 * 
 * section: example
 * const safe = sanitize_node_id('task-1.feature');
 */
function sanitize_node_id(raw_id) {
  if (typeof raw_id !== 'string') {
    return 'node';
  }
  return raw_id.replace(/[^a-zA-Z0-9_]/g, '_');
}

/**
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: exports a task directed acyclic graph to mermaid flowchart syntax
 * verbose: iterates nodes and dependency edges, applying role badges and status classes.
 * 
 * section: arguments
 * - dag (object): task dag structure containing nodes array
 * - options (object, optional): configuration options including direction
 * 
 * section: return value
 * - diagram (string): formatted mermaid flowchart string
 * 
 * section: example
 * const chart = export_dag_to_mermaid({ nodes: [{ id: 'a', role: 'coder' }] });
 */
export function export_dag_to_mermaid(dag = {}, options = {}) {
  const direction = options.direction || 'TD';
  const nodes = Array.isArray(dag.nodes) ? dag.nodes : [];

  if (nodes.length === 0) {
    return `flowchart ${direction}\n  empty["no tasks planned"]`;
  }

  const lines = [`flowchart ${direction}`];
  const style_lines = [
    '  classDef completed fill:#dafbe1,stroke:#2da44e,stroke-width:2px;',
    '  classDef running fill:#ddf4ff,stroke:#0969da,stroke-width:2px;',
    '  classDef failed fill:#ffebe9,stroke:#cf222e,stroke-width:2px;',
    '  classDef pending fill:#f6f8fa,stroke:#6e7781,stroke-width:1px;'
  ];
  const node_classes = [];

  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i];
    const safe_id = sanitize_node_id(node.id);
    const role = node.role || 'unassigned';
    const label = `"[${role}] ${node.id}"`;
    lines.push(`  ${safe_id}[${label}]`);

    const status = node.status || 'pending';
    node_classes.push(`  class ${safe_id} ${status};`);

    const deps = Array.isArray(node.depends_on) ? node.depends_on : [];
    for (let j = 0; j < deps.length; j += 1) {
      const dep_safe = sanitize_node_id(deps[j]);
      lines.push(`  ${dep_safe} --> ${safe_id}`);
    }
  }

  return [...lines, ...style_lines, ...node_classes].join('\n');
}
