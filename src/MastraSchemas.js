/**
 * =========================================================================
 * module: MastraSchemas.js
 * =========================================================================
 * 
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: canonical zod schemas for structured agent input and output contracts
 * verbose: defines fail-closed zod input and output schemas for all 6 specialized sdlc role agents
 * (product manager, system architect, software engineer, security engineer, qa engineer, and devops engineer),
 * along with safe validation helpers and role schema pairing utilities.
 * 
 * section: arguments
 * none
 * 
 * section: return value
 * - object: exports schemas and validation helpers
 * 
 * section: example
 * import { ProductManagerInputSchema, validate_agent_input } from './MastraSchemas.js';
 * const parsed = validate_agent_input(ProductManagerInputSchema, { feature_name: 'auth' });
 * =========================================================================
 */

import { z } from 'zod';

// =============================================================================
// section: product manager schemas
// =============================================================================

export const ProductManagerInputSchema = z.object({
  feature_name: z.string().min(1),
  problem_statement: z.string().optional(),
  target_audience: z.string().optional(),
  constraints: z.array(z.string()).optional(),
  description: z.string().optional(),
  workspace_root: z.string().optional()
});

export const UserStorySchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  given: z.string().min(1),
  when: z.string().min(1),
  then: z.string().min(1)
});

export const ProductManagerOutputSchema = z.object({
  prd: z.object({
    title: z.string().min(1),
    document_id: z.string().optional(),
    problem_statement: z.string().min(1),
    scope: z.array(z.string()),
    non_goals: z.array(z.string()),
    acceptance_criteria: z.array(z.string())
  }),
  stories: z.array(UserStorySchema)
});

// =============================================================================
// section: system architect schemas
// =============================================================================

export const SystemArchitectInputSchema = z.object({
  feature_name: z.string().min(1),
  title: z.string().optional(),
  prd: z.any().optional(),
  stories: z.array(z.any()).optional(),
  decision: z.string().optional(),
  workspace_root: z.string().optional()
});

export const AdrSchema = z.object({
  id: z.string().min(1),
  document_id: z.string().optional(),
  title: z.string().min(1),
  status: z.enum(['proposed', 'accepted', 'superseded', 'deprecated']),
  context: z.string().min(1),
  decision: z.string().min(1),
  consequences: z.array(z.string())
});

export const InterfaceMethodSchema = z.object({
  name: z.string().min(1),
  params: z.array(z.string()),
  return_type: z.string().min(1),
  description: z.string().optional()
});

export const InterfaceContractSchema = z.object({
  document_id: z.string().optional(),
  schema_version: z.string().min(1),
  methods: z.array(InterfaceMethodSchema)
});

export const SystemArchitectOutputSchema = z.object({
  adr: AdrSchema,
  interface_contract: InterfaceContractSchema
});

// =============================================================================
// section: software engineer schemas
// =============================================================================

export const SoftwareEngineerInputSchema = z.object({
  feature_name: z.string().min(1),
  code_file: z.string().optional(),
  test_file: z.string().optional(),
  adr: z.any().optional(),
  interface_contract: z.any().optional(),
  workspace_root: z.string().optional()
});

export const SoftwareEngineerOutputSchema = z.object({
  implementation: z.object({
    source_code: z.string().min(1),
    code_file: z.string().optional(),
    exported_symbols: z.array(z.string()),
    banner_documentation_present: z.boolean(),
    es6_standards_preserved: z.boolean().optional()
  })
});

// =============================================================================
// section: security engineer schemas
// =============================================================================

export const SecurityEngineerInputSchema = z.object({
  feature_name: z.string().min(1),
  adr: z.any().optional(),
  interface_contract: z.any().optional(),
  source_code: z.string().optional(),
  workspace_root: z.string().optional()
});

export const StrideVectorSchema = z.object({
  category: z.enum([
    'spoofing',
    'tampering',
    'repudiation',
    'information_disclosure',
    'denial_of_service',
    'elevation_of_privilege'
  ]),
  threat: z.string().min(1),
  mitigation: z.string().min(1),
  status: z.enum(['mitigated', 'residual', 'unmitigated'])
});

export const SecurityEngineerOutputSchema = z.object({
  threat_model: z.object({
    document_id: z.string().optional(),
    stride_vectors: z.array(StrideVectorSchema),
    sign_off: z.boolean(),
    residual_risk: z.enum(['low', 'medium', 'high'])
  })
});

// =============================================================================
// section: qa engineer schemas
// =============================================================================

export const QaEngineerInputSchema = z.object({
  feature_name: z.string().min(1),
  test_file: z.string().optional(),
  test_results: z.any().optional(),
  assertion_delta: z.number().optional(),
  skipped_tests: z.number().optional(),
  workspace_root: z.string().optional()
});

export const QaEngineerOutputSchema = z.object({
  test_report: z.object({
    document_id: z.string().optional(),
    total_tests: z.number().int().nonnegative(),
    assertions_count: z.number().int().nonnegative(),
    immutability_verified: z.boolean(),
    mutation_score: z.number().min(0).max(100),
    sign_off: z.boolean()
  })
});

// =============================================================================
// section: devops engineer schemas
// =============================================================================

export const DevopsEngineerInputSchema = z.object({
  feature_name: z.string().min(1),
  version: z.string().optional(),
  gate_receipts: z.array(z.any()).optional(),
  test_report: z.any().optional(),
  threat_model: z.any().optional(),
  workspace_root: z.string().optional()
});

export const SealedReceiptSchema = z.object({
  gate_id: z.string().min(1),
  hash: z.string().min(1),
  timestamp: z.string().min(1)
});

export const DevopsEngineerOutputSchema = z.object({
  release_manifest: z.object({
    document_id: z.string().optional(),
    version: z.string().min(1),
    semver_bump: z.enum(['major', 'minor', 'patch']),
    changelog_entry: z.string().min(1),
    sealed_receipt: SealedReceiptSchema
  }),
  retrospective: z.object({
    document_id: z.string().optional(),
    key_learnings: z.array(z.string()),
    improvements: z.array(z.string()),
    metrics: z.record(z.any()).optional()
  }).optional()
});

// =============================================================================
// section: validation helpers
// =============================================================================

/**
 * =========================================================================
 * function: validate_agent_input
 * =========================================================================
 * 
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: validates raw input against a zod agent input schema
 * verbose: safely parses the input against the provided zod schema and throws a
 * descriptive validation_failed error if parsing fails, logging to central log store if logger provided.
 * 
 * section: arguments
 * - schema (z.ZodSchema): schema to validate against
 * - input (any): raw input object
 * - logger (object, optional): logger instance for boundary telemetry
 * 
 * section: return value
 * - parsed (object): strongly-typed validated input
 * 
 * section: example
 * const val = validate_agent_input(ProductManagerInputSchema, { feature_name: 'test' });
 * =========================================================================
 */
export function validate_agent_input(schema, input, logger = null) {
  const result = schema.safeParse(input);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
    if (logger) {
      logger.error({
        event: 'schema:validation_failed',
        component: 'schema',
        type: 'input',
        issues: result.error.issues
      });
    }
    throw new Error(`validation_failed: agent input validation failed - ${issues}`);
  }
  return result.data;
}

/**
 * =========================================================================
 * function: validate_agent_output
 * =========================================================================
 * 
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: validates raw output against a zod agent output schema
 * verbose: safely parses the output against the provided zod schema and throws a
 * descriptive validation_failed error if parsing fails, logging to central log store if logger provided.
 * 
 * section: arguments
 * - schema (z.ZodSchema): schema to validate against
 * - output (any): raw output object
 * - logger (object, optional): logger instance for boundary telemetry
 * 
 * section: return value
 * - parsed (object): strongly-typed validated output
 * 
 * section: example
 * const val = validate_agent_output(ProductManagerOutputSchema, valid_obj);
 * =========================================================================
 */
export function validate_agent_output(schema, output, logger = null) {
  const result = schema.safeParse(output);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
    if (logger) {
      logger.error({
        event: 'schema:validation_failed',
        component: 'schema',
        type: 'output',
        issues: result.error.issues
      });
    }
    throw new Error(`validation_failed: agent output validation failed - ${issues}`);
  }
  return result.data;
}

/**
 * =========================================================================
 * function: get_role_schema_pair
 * =========================================================================
 * 
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: resolves input and output schemas for a designated agent role
 * verbose: maps role identifier strings to their canonical zod schema pair.
 * 
 * section: arguments
 * - role (string): agent role name
 * 
 * section: return value
 * - pair (object): { input: z.ZodSchema, output: z.ZodSchema }
 * 
 * section: example
 * const pair = get_role_schema_pair('product-manager');
 * =========================================================================
 */
export function get_role_schema_pair(role) {
  const mapping = {
    'product-manager': { input: ProductManagerInputSchema, output: ProductManagerOutputSchema },
    'system-architect': { input: SystemArchitectInputSchema, output: SystemArchitectOutputSchema },
    'software-engineer': { input: SoftwareEngineerInputSchema, output: SoftwareEngineerOutputSchema },
    'security-engineer': { input: SecurityEngineerInputSchema, output: SecurityEngineerOutputSchema },
    'qa-engineer': { input: QaEngineerInputSchema, output: QaEngineerOutputSchema },
    'devops-engineer': { input: DevopsEngineerInputSchema, output: DevopsEngineerOutputSchema }
  };
  return mapping[role] || { input: z.any(), output: z.any() };
}
