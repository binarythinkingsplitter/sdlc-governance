/**
 * =========================================================================
 * module: SdlcPackage.js
 * =========================================================================
 * 
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: canonical software development lifecycle business package factory
 * verbose: encapsulates all sdlc domain specifications, 10-phase macro statecharts,
 * 4 formal review gates, 6 specialized role agents, tdd engineering tools, and governance skills
 * into an exportable business package conforming to the define_business_package contract.
 * 
 * section: arguments
 * - options (object, optional): configuration options
 * 
 * section: return value
 * - pkg (object): canonical sdlc-core business package descriptor
 * 
 * section: example
 * import { create_sdlc_package } from './SdlcPackage.js';
 * const sdlc_package = create_sdlc_package();
 * =========================================================================
 */

import { define_business_package } from './BusinessPackage.js';
import {
  get_sovereign_project_config,
  get_work_item_machine_config
} from './MacroStatechartEngine.js';
import { get_work_item_stage_routing } from './index.js';
import { create_all_role_workflows } from './RoleWorkflows.js';
import {
  create_role_agents,
  create_harness_skills,
  GOVERNANCE_SKILLS
} from './HarnessSkills.js';
import { create_harness_tools } from './HarnessTools.js';
import {
  ProductManagerInputSchema,
  ProductManagerOutputSchema,
  SystemArchitectInputSchema,
  SystemArchitectOutputSchema,
  SoftwareEngineerInputSchema,
  SoftwareEngineerOutputSchema,
  SecurityEngineerInputSchema,
  SecurityEngineerOutputSchema,
  QaEngineerInputSchema,
  QaEngineerOutputSchema,
  DevopsEngineerInputSchema,
  DevopsEngineerOutputSchema,
  get_role_schema_pair
} from './MastraSchemas.js';

/**
 * =========================================================================
 * function: create_sdlc_package
 * =========================================================================
 * 
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: instantiates the canonical sdlc-core business package
 * verbose: bundles statechart machines, review gates, workflows, agents, tools, skills, and schemas.
 * 
 * section: arguments
 * - options (object, optional): configuration options
 * 
 * section: return value
 * - pkg (object): validated sdlc business package descriptor
 * 
 * section: example
 * const pkg = create_sdlc_package();
 * console.log(pkg.id); // 'sdlc-core'
 * =========================================================================
 */
export function create_sdlc_package(options = {}) {
  const tools = create_harness_tools(options);
  const skills = create_harness_skills({ ...options, load_governance: true });
  const agents = create_role_agents({ ...options, tools, skills, enable_governance_skills: true });
  const workflows = create_all_role_workflows();

  const gates = {
    gate_1_planning: {
      id: 'gate_1_planning',
      description: 'evaluates completeness of product requirements, user stories, and architecture decisions',
      required_phases: ['phase_00_inception', 'phase_01_specifications', 'phase_02_architecture']
    },
    gate_2_implementation: {
      id: 'gate_2_implementation',
      description: 'evaluates tdd implementation cycle, mutation score, and assertion densities',
      required_phases: ['phase_03_tdd_red', 'phase_04_tdd_green', 'phase_05_refactor']
    },
    gate_3_qa_security: {
      id: 'gate_3_qa_security',
      description: 'evaluates stride threat analysis, regression tests, and test immutability verification',
      required_phases: ['phase_06_security_review', 'phase_07_qa_verification']
    },
    gate_4_release: {
      id: 'gate_4_release',
      description: 'evaluates working tree cleanliness, semver packaging, and cryptographic gate receipts',
      required_phases: ['phase_08_release']
    }
  };

  const schemas = {
    'product-manager': { input: ProductManagerInputSchema, output: ProductManagerOutputSchema },
    'system-architect': { input: SystemArchitectInputSchema, output: SystemArchitectOutputSchema },
    'software-engineer': { input: SoftwareEngineerInputSchema, output: SoftwareEngineerOutputSchema },
    'security-engineer': { input: SecurityEngineerInputSchema, output: SecurityEngineerOutputSchema },
    'qa-engineer': { input: QaEngineerInputSchema, output: QaEngineerOutputSchema },
    'devops-engineer': { input: DevopsEngineerInputSchema, output: DevopsEngineerOutputSchema }
  };

  return define_business_package({
    id: 'sdlc-core',
    name: 'software development lifecycle package',
    version: '0.1.0',
    description: 'canonical 10-phase agile software development lifecycle package with tdd, review gates, and role agents',
    statecharts: {
      project_machine_config: get_sovereign_project_config(),
      work_item_machine_config: get_work_item_machine_config(),
      stage_routing: get_work_item_stage_routing()
    },
    gates,
    workflows,
    agents,
    tools,
    skills,
    schemas
  });
}
