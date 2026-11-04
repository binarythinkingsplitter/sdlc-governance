/**
 * =========================================================================
 * module: document entities schema
 * =========================================================================
 * 
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: zod schemas for structured document entities in the sdlc datastore
 * verbose: defines extensive validation schemas for all sdlc artefact entity
 * types (prd, user story, task, adr, interface, threat model, test report,
 * release manifest, retrospective) enforcing foreign key relations back to prd.
 * 
 * section: export catalog
 * - PrdEntitySchema: schema for product requirements document entity
 * - UserStoryEntitySchema: schema for user story and acceptance criteria entity
 * - TaskEntitySchema: schema for work breakdown task and subtasks entity
 * - AdrEntitySchema: schema for architectural decision record entity
 * - InterfaceEntitySchema: schema for system interface contract entity
 * - ThreatModelEntitySchema: schema for stride threat model entity
 * - TestReportEntitySchema: schema for qa test report entity
 * - ReleaseEntitySchema: schema for release manifest entity
 * - RetrospectiveEntitySchema: schema for continuous learning retrospective entity
 * - DocumentEntityTypes: dictionary of supported document entity type strings
 * - get_schema_for_type: returns zod schema for given document entity type
 * - validate_document_entity: validates data object against entity schema
 * =========================================================================
 */

import { z } from 'zod';

export const DocumentEntityTypes = Object.freeze({
  PRD: 'prd',
  USER_STORY: 'user_story',
  TASK: 'task',
  ADR: 'adr',
  INTERFACE_CONTRACT: 'interface_contract',
  THREAT_MODEL: 'threat_model',
  TEST_REPORT: 'test_report',
  RELEASE_MANIFEST: 'release_manifest',
  RETROSPECTIVE: 'retrospective',
  TICKET: 'ticket',
  AGENT_MESSAGE: 'agent_message'
});

/**
 * schema for product requirements document entity
 */
export const PrdEntitySchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  title: z.string().min(1),
  status: z.enum(['draft', 'proposed', 'in_review', 'approved', 'deprecated']).default('approved'),
  author: z.string().min(1).default('autonomous agent'),
  date: z.string().default(() => new Date().toISOString().split('T')[0]),
  system_component: z.string().default('@thing/sdlc-dual_engine_harness'),
  executive_summary: z.object({
    vision: z.string().default(''),
    problem: z.string().default(''),
    strategic_context: z.string().default(''),
    primary_objectives: z.array(z.string()).default([])
  }).default({}),
  target_audience: z.array(z.object({
    id: z.string(),
    role: z.string(),
    description: z.string(),
    responsibilities: z.array(z.string()).default([])
  })).default([]),
  functional_requirements: z.array(z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    priority: z.enum(['must_have', 'should_have', 'could_have', 'wont_have']).default('must_have'),
    status: z.string().default('approved')
  })).default([]),
  non_functional_requirements: z.object({
    performance: z.string().default(''),
    immutability: z.string().default(''),
    sovereignty: z.string().default(''),
    style: z.string().default('')
  }).default({}),
  scope_boundaries: z.object({
    in_scope: z.array(z.string()).default([]),
    out_of_scope: z.array(z.string()).default([])
  }).default({}),
  metadata: z.array(z.object({
    key: z.string(),
    value: z.string()
  })).default([])
});

/**
 * schema for agile user story and acceptance criteria entity
 */
export const UserStoryEntitySchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  title: z.string().min(1),
  linked_prd_id: z.string().min(1),
  epic: z.string().default(''),
  narrative: z.object({
    as_a: z.string().default('user'),
    i_want: z.string().default(''),
    so_that: z.string().default('')
  }).default({}),
  acceptance_criteria: z.array(z.object({
    id: z.string(),
    scenario: z.string(),
    given: z.array(z.string()).default([]),
    when: z.array(z.string()).default([]),
    then: z.array(z.string()).default([]),
    and: z.array(z.string()).default([])
  })).default([]),
  story_points: z.number().int().nonnegative().optional(),
  priority: z.enum(['critical', 'high', 'medium', 'low']).default('high'),
  status: z.enum(['draft', 'ready', 'in_progress', 'completed', 'approved']).default('completed')
});

/**
 * schema for work breakdown task and subtasks entity
 */
export const TaskEntitySchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  title: z.string().min(1),
  linked_prd_id: z.string().min(1),
  linked_story_id: z.string().optional(),
  objective: z.string().default(''),
  assigned_role: z.enum([
    'product-manager',
    'system-architect',
    'software-engineer',
    'security-engineer',
    'qa-engineer',
    'devops-engineer'
  ]).default('software-engineer'),
  status: z.enum(['pending', 'in_progress', 'completed', 'blocked']).default('completed'),
  inputs: z.array(z.string()).default([]),
  outputs: z.array(z.string()).default([]),
  criteria: z.array(z.string()).default([]),
  tasks: z.array(z.object({
    number: z.number().int().positive(),
    slug: z.string(),
    title: z.string(),
    description: z.string(),
    steps: z.array(z.string()).default([]),
    status: z.string().default('pending')
  })).default([])
});

/**
 * schema for architectural decision record entity
 */
export const AdrEntitySchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  title: z.string().min(1),
  linked_prd_id: z.string().min(1),
  status: z.enum(['proposed', 'accepted', 'rejected', 'deprecated', 'superseded']).default('accepted'),
  author: z.string().default('autonomous system architect agent'),
  date: z.string().default(() => new Date().toISOString().split('T')[0]),
  context: z.string().min(1),
  decision: z.string().min(1),
  consequences: z.object({
    positive: z.array(z.string()).default([]),
    negative: z.array(z.string()).default([]),
    neutral: z.array(z.string()).default([])
  }).default({}),
  considered_options: z.array(z.object({
    title: z.string(),
    description: z.string(),
    pros: z.array(z.string()).default([]),
    cons: z.array(z.string()).default([])
  })).default([]),
  compliance_rules: z.array(z.string()).default([])
});

/**
 * schema for interface contract specification entity
 */
export const InterfaceEntitySchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  linked_prd_id: z.string().min(1),
  component: z.string().min(1),
  version: z.string().default('0.1.0'),
  methods: z.array(z.object({
    name: z.string(),
    description: z.string(),
    parameters: z.array(z.object({
      name: z.string(),
      type: z.string(),
      description: z.string().default('')
    })).default([]),
    returns: z.object({
      type: z.string(),
      description: z.string().default('')
    }).default({ type: 'void', description: '' }),
    throws: z.array(z.string()).default([])
  })).default([]),
  events: z.array(z.object({
    name: z.string(),
    payload_schema: z.string(),
    description: z.string().default('')
  })).default([]),
  schemas: z.array(z.object({
    name: z.string(),
    schema_definition: z.string()
  })).default([])
});

/**
 * schema for stride threat model entity
 */
export const ThreatModelEntitySchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  linked_prd_id: z.string().min(1),
  component: z.string().min(1),
  threat_vectors: z.array(z.object({
    category: z.enum([
      'spoofing',
      'tampering',
      'repudiation',
      'information_disclosure',
      'denial_of_service',
      'elevation_of_privilege'
    ]),
    risk: z.string(),
    mitigation: z.string(),
    status: z.enum(['mitigated', 'open', 'accepted']).default('mitigated')
  })).default([]),
  boundaries: z.array(z.object({
    name: z.string(),
    description: z.string()
  })).default([]),
  sign_off: z.object({
    approved: z.boolean().default(true),
    date: z.string().default(() => new Date().toISOString().split('T')[0]),
    auditor: z.string().default('autonomous security auditor agent')
  }).default({})
});

/**
 * schema for qa test report entity
 */
export const TestReportEntitySchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  linked_prd_id: z.string().min(1),
  target_version: z.string().default('0.1.0'),
  suites: z.array(z.object({
    suite_name: z.string(),
    pass_count: z.number().int().nonnegative().default(0),
    fail_count: z.number().int().nonnegative().default(0),
    duration_ms: z.number().nonnegative().default(0)
  })).default([]),
  pass_rate: z.number().min(0).max(100).default(100),
  immutability_audit: z.object({
    baseline_assertions: z.number().int().nonnegative().default(0),
    current_assertions: z.number().int().nonnegative().default(0),
    delta: z.number().int().default(0),
    valid: z.boolean().default(true)
  }).default({}),
  gate_verdict: z.enum(['pass', 'blocked']).default('pass')
});

/**
 * schema for release manifest entity
 */
export const ReleaseEntitySchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  version: z.string().min(1),
  linked_prd_ids: z.array(z.string()).min(1),
  timestamp: z.string().default(() => new Date().toISOString()),
  deliverables: z.array(z.object({
    path: z.string(),
    checksum: z.string(),
    description: z.string().default('')
  })).default([]),
  gate_receipts: z.array(z.object({
    gate: z.number().int().positive(),
    signature: z.string(),
    timestamp: z.string()
  })).default([]),
  changelog: z.array(z.string()).default([])
});

/**
 * schema for continuous learning retrospective entity
 */
export const RetrospectiveEntitySchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  linked_prd_ids: z.array(z.string()).min(1),
  milestone: z.string().min(1),
  what_went_well: z.array(z.string()).default([]),
  what_could_improve: z.array(z.string()).default([]),
  action_items: z.array(z.object({
    action: z.string(),
    owner: z.string().default('engineering'),
    status: z.string().default('open')
  })).default([])
});

/**
 * schema for work board ticket entity
 */
export const TicketEntitySchema = z.object({
  id: z.string().min(1),
  epic_id: z.string().min(1),
  title: z.string().min(1),
  workflow_id: z.string().min(1),
  role: z.string().min(1),
  phase: z.string().default('inception'),
  status: z.enum([
    'backlog',
    'blocked',
    'ready',
    'in_progress',
    'awaiting_input',
    'in_review',
    'rework',
    'escalated',
    'completed'
  ]).default('backlog'),
  depends_on: z.array(z.string()).default([]),
  affinity: z.string().nullable().default(null),
  lease: z.object({
    worker_id: z.string(),
    supervisor_token: z.string(),
    leased_at: z.number(),
    expires_at: z.number()
  }).nullable().default(null),
  retry_count: z.number().int().nonnegative().default(0),
  max_retries: z.number().int().positive().default(3),
  linked_prd_id: z.string().optional(),
  inputs: z.record(z.string(), z.unknown()).default({}),
  output: z.record(z.string(), z.unknown()).nullable().default(null),
  artefact_refs: z.array(z.object({
    type: z.string(),
    id: z.string()
  })).default([]),
  thread: z.array(z.object({
    author: z.string(),
    role: z.string().default('system'),
    type: z.string().default('comment'),
    message: z.string(),
    timestamp: z.string()
  })).default([]),
  created_at: z.string().default(() => new Date().toISOString()),
  updated_at: z.string().default(() => new Date().toISOString())
});

/**
 * schema for inter-agent message entity
 */
export const AgentMessageEntitySchema = z.object({
  id: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1),
  topic: z.enum([
    'clarification_request',
    'clarification_reply',
    'escalation',
    'ticket_ready',
    'review_feedback',
    'direct'
  ]).default('direct'),
  ticket_id: z.string().nullable().default(null),
  payload: z.record(z.string(), z.unknown()).default({}),
  status: z.enum(['unread', 'read', 'resolved']).default('unread'),
  timestamp: z.string().default(() => new Date().toISOString())
});

const schema_registry = {
  [DocumentEntityTypes.PRD]: PrdEntitySchema,
  [DocumentEntityTypes.USER_STORY]: UserStoryEntitySchema,
  [DocumentEntityTypes.TASK]: TaskEntitySchema,
  [DocumentEntityTypes.ADR]: AdrEntitySchema,
  [DocumentEntityTypes.INTERFACE_CONTRACT]: InterfaceEntitySchema,
  [DocumentEntityTypes.THREAT_MODEL]: ThreatModelEntitySchema,
  [DocumentEntityTypes.TEST_REPORT]: TestReportEntitySchema,
  [DocumentEntityTypes.RELEASE_MANIFEST]: ReleaseEntitySchema,
  [DocumentEntityTypes.RETROSPECTIVE]: RetrospectiveEntitySchema,
  [DocumentEntityTypes.TICKET]: TicketEntitySchema,
  [DocumentEntityTypes.AGENT_MESSAGE]: AgentMessageEntitySchema
};

/**
 * =========================================================================
 * function: get_schema_for_type
 * =========================================================================
 * 
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: resolves zod schema for a document entity type
 * verbose: looks up the corresponding schema from the internal schema registry.
 * 
 * section: arguments
 * - type (string): canonical document entity type string
 * 
 * section: return value
 * - schema (zod.ZodType): resolved zod schema or null if unknown
 * 
 * section: example
 * const schema = get_schema_for_type('prd');
 * =========================================================================
 */
export function get_schema_for_type(type) {
  return schema_registry[type] || null;
}

/**
 * =========================================================================
 * function: validate_document_entity
 * =========================================================================
 * 
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: validates a document entity object against its schema
 * verbose: performs safe schema parsing and returns validated object or throws descriptive error.
 * 
 * section: arguments
 * - type (string): canonical document entity type string
 * - data (object): raw entity data object
 * 
 * section: return value
 * - entity (object): validated and sanitised entity object
 * 
 * section: example
 * const validated = validate_document_entity('prd', raw_prd);
 * =========================================================================
 */
export function validate_document_entity(type, data) {
  const schema = get_schema_for_type(type);
  if (!schema) {
    throw new Error(`unknown document entity type: "${type}"`);
  }
  const result = schema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
    throw new Error(`validation error for "${type}" entity (${data?.id || 'unknown'}): ${issues}`);
  }
  return result.data;
}
