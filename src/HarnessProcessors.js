/**
 * =========================================================================
 * module: HarnessProcessors.js
 * =========================================================================
 *
 * section: version number
 * version: 0.1.0
 *
 * section: documentation
 * tldr: native mastra input/output processors, guardrails, and request context schemas
 * verbose: integrates @mastra/core/processors (UnicodeNormalizer, RegexFilterProcessor,
 * TokenLimiterProcessor, ToolCallFilter, ResponseCache with InMemoryServerCache) and
 * custom sdlc guardrails (supervisor token verification via RequestContext, xstate
 * phase-lock processor on sdlc-supervisor, and output self-correction / store isolation).
 *
 * section: arguments
 * - options (object, optional): processor suite configuration
 *
 * section: return value
 * - suite (object): configured mastra processors and request context helpers
 *
 * section: example
 * import { create_sdlc_processor_suite } from './HarnessProcessors.js';
 * const suite = create_sdlc_processor_suite();
 * =========================================================================
 */

import { z } from 'zod';
import { TripWire } from '@mastra/core/agent';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryServerCache } from '@mastra/core/cache';
import {
  UnicodeNormalizer,
  RegexFilterProcessor,
  TokenLimiterProcessor,
  ToolCallFilter,
  ResponseCache
} from '@mastra/core/processors';

/**
 * zod schema for validating the mastra request context on specialist agents, workflows, and tools.
 */
export const SupervisorRequestContextSchema = z.object({
  supervisor_token: z.string().min(1),
  ticket_id: z.string().min(1),
  worker_id: z.string().min(1),
  epic_id: z.string().optional(),
  role: z.string().optional(),
  xstate_phase: z.string().optional()
});

/**
 * default regex rules for blocking direct store access.
 */
export const SDLC_REGEX_GUARDRAIL_RULES = Object.freeze([
  {
    name: 'direct_sdlc_store_access',
    pattern: /\.sdlc\/store\b/g,
    replacement: '[blocked_sdlc_store]'
  }
]);

/**
 * section: version number
 * version: 0.1.0
 *
 * section: documentation
 * tldr: instantiates a native mastra RequestContext populated with sdlc supervisor metadata
 * verbose: wraps @mastra/core/request-context RequestContext so tier 1 sdlc-supervisor tokens
 * and xstate phase metadata flow through agents, workflows, steps, and tools.
 *
 * section: arguments
 * - initial_values (object, optional): key-value pairs to seed into the request context
 *
 * section: return value
 * - request_context (RequestContext): populated mastra request context instance
 *
 * section: example
 * const ctx = create_request_context({ supervisor_token: 'sup-1', ticket_id: 't-1', worker_id: 'se-01' });
 */
export function create_request_context(initial_values = {}) {
  const entries = Object.entries(initial_values || {});
  return new RequestContext(entries);
}

/**
 * section: version number
 * version: 0.1.0
 *
 * section: documentation
 * tldr: extracts concatenated text content from mastra message arrays or string payloads
 * verbose: supports string messages, content strings, and parts arrays in mastra db messages.
 *
 * section: arguments
 * - messages (array|string): messages passed to a processor hook
 *
 * section: return value
 * - combined_text (string): extracted text content
 *
 * section: example
 * const text = extract_text_from_messages([{ role: 'user', content: 'hello' }]);
 */
export function extract_text_from_messages(messages) {
  if (typeof messages === 'string') {
    return messages;
  }
  if (!Array.isArray(messages)) {
    return '';
  }
  const chunks = [];
  for (const msg of messages) {
    if (typeof msg === 'string') {
      chunks.push(msg);
    } else if (msg && typeof msg.content === 'string') {
      chunks.push(msg.content);
    } else if (msg && msg.content && Array.isArray(msg.content.parts)) {
      for (const part of msg.content.parts) {
        if (part && typeof part.text === 'string') {
          chunks.push(part.text);
        }
      }
    } else if (msg && Array.isArray(msg.parts)) {
      for (const part of msg.parts) {
        if (part && typeof part.text === 'string') {
          chunks.push(part.text);
        }
      }
    }
  }
  return chunks.join('\n');
}

/**
 * section: version number
 * version: 0.1.0
 *
 * section: documentation
 * tldr: creates a mastra input processor that enforces supervisor token authorisation
 * verbose: inspects requestContext on processInput and processInputStep; calls abort() with
 * retry: false (throwing TripWire) when an unsupervised execution is attempted.
 *
 * section: arguments
 * - options (object, optional): configuration with verify_token callback and require_token flag
 *
 * section: return value
 * - processor (object): mastra-compatible input processor instance
 *
 * section: example
 * const proc = create_supervisor_token_input_processor({ require_token: true });
 */
export function create_supervisor_token_input_processor(options = {}) {
  const verify_token = options.verify_token || options.verify_token_fn || null;
  const require_token = options.require_token !== undefined ? options.require_token : Boolean(verify_token);

  const default_abort = (reason, tripwire_options = {}) => {
    throw new TripWire(reason || 'tripwire_unauthorized_execution: unauthorized_unsupervised_execution', tripwire_options, 'sdlc-supervisor-token-guard');
  };

  const validate_context = (request_context, abort_fn = default_abort) => {
    if (!require_token && !verify_token) {
      return true;
    }

    const token = request_context && typeof request_context.get === 'function'
      ? request_context.get('supervisor_token')
      : request_context?.supervisor_token;
    const ticket_id = request_context && typeof request_context.get === 'function'
      ? request_context.get('ticket_id')
      : request_context?.ticket_id;
    const worker_id = request_context && typeof request_context.get === 'function'
      ? request_context.get('worker_id')
      : request_context?.worker_id;
    const workflow_id = request_context && typeof request_context.get === 'function'
      ? request_context.get('workflow_id')
      : request_context?.workflow_id;

    if (require_token && (!token || !ticket_id || !worker_id)) {
      abort_fn('tripwire_unauthorized_execution: unauthorized_unsupervised_execution: missing supervisor_token, ticket_id, or worker_id in requestContext', {
        retry: false,
        metadata: {
          processor_id: 'sdlc-supervisor-token-guard',
          has_token: Boolean(token),
          ticket_id: ticket_id || null,
          worker_id: worker_id || null
        }
      });
    }

    if (typeof verify_token === 'function' && (require_token || token)) {
      const check_res = verify_token({
        supervisor_token: token,
        ticket_id,
        worker_id,
        workflow_id
      });
      const is_valid = typeof check_res === 'boolean' ? check_res : Boolean(check_res?.valid);
      if (!is_valid) {
        abort_fn('tripwire_unauthorized_execution: invalid_supervisor_token: token rejected by sdlc-supervisor', {
          retry: false,
          metadata: {
            processor_id: 'sdlc-supervisor-token-guard',
            ticket_id: ticket_id || null,
            worker_id: worker_id || null
          }
        });
      }
    }

    return true;
  };

  return {
    id: 'sdlc-supervisor-token-guard',
    name: 'sdlc supervisor token guard',
    async processInput({ messages, requestContext, abort = default_abort }) {
      validate_context(requestContext, abort);
      return messages;
    },
    async processInputStep({ messages, requestContext, abort = default_abort }) {
      validate_context(requestContext, abort);
      return { messages };
    }
  };
}

/**
 * section: version number
 * version: 0.1.0
 *
 * section: documentation
 * tldr: creates a mastra processor that locks sdlc-supervisor to its xstate machine
 * verbose: ensures sdlc-supervisor cannot execute or delegate outside the active xstate phase
 * and stamps the live xstate phase onto requestContext.
 *
 * section: arguments
 * - options (object, optional): configuration with get_active_phase and disallowed_states
 *
 * section: return value
 * - processor (object): mastra input processor enforcing xstate phase boundaries
 *
 * section: example
 * const lock = create_xstate_phase_lock_processor({ get_active_phase: () => 'phase_00_inception' });
 */
export function create_xstate_phase_lock_processor(options = {}) {
  const get_active_phase = options.get_active_phase || options.get_active_phase_fn || null;
  const disallowed_states = options.disallowed_states || ['halted', 'aborted', 'failed'];
  const allowed_phases = Array.isArray(options.allowed_phases) ? options.allowed_phases : null;

  const default_abort = (reason, tripwire_options = {}) => {
    throw new TripWire(reason || 'xstate_phase_lock_violation', tripwire_options, 'xstate-phase-lock');
  };

  const check_phase_lock = (request_context, abort_fn = default_abort) => {
    if (typeof get_active_phase !== 'function') {
      return null;
    }
    const active_phase = get_active_phase();
    if (!active_phase) {
      abort_fn('xstate_phase_lock_violation: active xstate phase is unavailable', {
        retry: false,
        metadata: { processor_id: 'xstate-phase-lock' }
      });
    }

    if (disallowed_states.includes(active_phase)) {
      abort_fn(`xstate_phase_lock_violation: statechart is in disallowed state '${active_phase}'`, {
        retry: false,
        metadata: {
          processor_id: 'xstate-phase-lock',
          active_phase
        }
      });
    }

    if (allowed_phases && !allowed_phases.includes(active_phase)) {
      abort_fn(`xstate_phase_lock_violation: active phase '${active_phase}' is not in allowed_phases [${allowed_phases.join(', ')}]`, {
        retry: false,
        metadata: {
          processor_id: 'xstate-phase-lock',
          active_phase,
          allowed_phases
        }
      });
    }

    const requested_phase = request_context && typeof request_context.get === 'function'
      ? request_context.get('required_xstate_phase')
      : request_context?.required_xstate_phase;

    if (requested_phase && requested_phase !== active_phase) {
      abort_fn(
        `xstate_phase_lock_violation: required phase '${requested_phase}' does not match active phase '${active_phase}'`,
        {
          retry: false,
          metadata: {
            processor_id: 'xstate-phase-lock',
            required_phase: requested_phase,
            active_phase
          }
        }
      );
    }

    if (request_context && typeof request_context.set === 'function') {
      request_context.set('xstate_phase', active_phase);
    }

    return active_phase;
  };

  return {
    id: 'xstate-phase-lock',
    name: 'xstate phase lock processor',
    async processInput({ messages, requestContext, systemMessages = [], abort = default_abort }) {
      const active_phase = check_phase_lock(requestContext, abort);
      if (active_phase && Array.isArray(systemMessages)) {
        return {
          messages,
          systemMessages: [
            ...systemMessages,
            {
              role: 'system',
              content: `active xstate phase: ${active_phase}`
            }
          ]
        };
      }
      return messages;
    },
    async processInputStep({ messages, requestContext, abort = default_abort }) {
      check_phase_lock(requestContext, abort);
      return { messages };
    }
  };
}

/**
 * section: version number
 * version: 0.1.0
 *
 * section: documentation
 * tldr: scans text or tool arguments for architectural and governance guardrail violations
 * verbose: enforces store
 * isolation (no direct .sdlc/store access by tier 2 specialists).
 *
 * section: arguments
 * - text (string): text or serialised arguments to inspect
 * - options (object, optional): flags controlling store and lowercase checks
 *
 * section: return value
 * - violations (array): list of detected violations with rule name and message
 *
 * section: example
 * const v = scan_sdlc_governance_violations('const m = new Map();');
 */
export function scan_sdlc_governance_violations(text = '', options = {}) {
  const {
    forbid_host_collections = true,
    forbid_es6_classes = false,
    forbid_direct_store_access = true,
    enforce_lowercase_prose = false
  } = options;

  const content = typeof text === 'string' ? text : JSON.stringify(text || '');
  const violations = [];

  if (forbid_direct_store_access) {
    if (/\.sdlc\/store\b/.test(content)) {
      violations.push({
        rule: 'direct_sdlc_store_access',
        message: 'specialist attempted direct access to .sdlc/store; all store access must go through sdlc-supervisor'
      });
    }
  }

  if (enforce_lowercase_prose) {
    if (/[A-Z]/.test(content)) {
      violations.push({
        rule: 'uppercase_prose_violation',
        message: 'uppercase characters detected where strictly lowercase british english is required'
      });
    }
  }

  return violations;
}

/**
 * section: version number
 * version: 0.1.0
 *
 * section: documentation
 * tldr: creates a mastra output processor implementing self-correction and store isolation
 * verbose: uses processOutputStep to call abort(reason, { retry: true }) when retryCount is
 * below max_retries so the agent self-corrects before tool calls run; uses processToolResult
 * to redact any .sdlc/store paths from tool outputs.
 *
 * section: arguments
 * - options (object, optional): configuration with max_retries and rule toggles
 *
 * section: return value
 * - processor (object): mastra output processor instance
 *
 * section: example
 * const out_proc = create_sdlc_governance_output_processor({ max_retries: 3 });
 */
export function create_sdlc_governance_output_processor(options = {}) {
  const {
    max_retries = 3,
    forbid_host_collections = true,
    forbid_es6_classes = false,
    forbid_direct_store_access = true,
    enforce_lowercase_prose = false
  } = options;

  const default_abort = (reason, tripwire_options = {}) => {
    throw new TripWire(reason || 'sdlc_governance_violation', tripwire_options, 'sdlc-governance-output');
  };

  return {
    id: 'sdlc-governance-output',
    name: 'sdlc governance output processor',
    async processOutputStep({ text = '', toolCalls = [], messages = [], abort = default_abort, retryCount = 0 }) {
      const tool_args_text = Array.isArray(toolCalls)
        ? toolCalls.map((tc) => JSON.stringify(tc.args || tc.input || {})).join('\n')
        : '';
      const assistant_messages = Array.isArray(messages)
        ? messages.filter((m) => !m || !m.role || m.role === 'assistant')
        : [];
      const fallback_msg_text = !text && !tool_args_text ? extract_text_from_messages(assistant_messages) : '';
      const combined = [text, tool_args_text, fallback_msg_text].filter(Boolean).join('\n');

      const violations = scan_sdlc_governance_violations(combined, {
        forbid_host_collections,
        forbid_es6_classes,
        forbid_direct_store_access,
        enforce_lowercase_prose
      });

      if (violations.length > 0) {
        const reason = `sdlc_governance_output_violation: ${violations.map((v) => `${v.rule}: ${v.message}`).join('; ')}`;
        const should_retry = retryCount < max_retries;
        abort(reason, {
          retry: should_retry,
          metadata: {
            processor_id: 'sdlc-governance-output',
            violations,
            retry_count: retryCount,
            max_retries
          }
        });
      }

      return messages;
    },
    async processToolResult({ result, messages, messageList, abort = default_abort }) {
      const serialised = typeof result === 'string' ? result : JSON.stringify(result ?? '');
      if (forbid_direct_store_access && /\.sdlc\/store\b/.test(serialised)) {
        if (typeof result === 'string') {
          const redacted_str = result.replace(/\.sdlc\/store\b/g, '[redacted_sdlc_store]');
          return messageList || messages || redacted_str;
        }
        if (result && typeof result === 'object') {
          const parsed = JSON.parse(serialised.replace(/\.sdlc\/store\b/g, '[redacted_sdlc_store]'));
          const redacted_obj = {
            ...parsed,
            redacted: true
          };
          return messageList || messages || redacted_obj;
        }
        abort('tool attempted to expose .sdlc/store directly', {
          retry: false,
          metadata: { processor_id: 'sdlc-governance-output' }
        });
      }
      if (messageList) {
        return messageList;
      }
      if (Array.isArray(messages)) {
        return messages;
      }
      return result;
    },
    async processOutputResult({ messages = [], abort = default_abort }) {
      const assistant_messages = Array.isArray(messages)
        ? messages.filter((m) => !m || !m.role || m.role === 'assistant')
        : [];
      const text = extract_text_from_messages(assistant_messages);
      const violations = scan_sdlc_governance_violations(text, {
        forbid_host_collections,
        forbid_es6_classes,
        forbid_direct_store_access,
        enforce_lowercase_prose
      });
      if (violations.length > 0) {
        const reason = violations.map((v) => `${v.rule}: ${v.message}`).join('; ');
        abort(reason, {
          retry: false,
          metadata: {
            processor_id: 'sdlc-governance-output',
            violations
          }
        });
      }
      return messages;
    }
  };
}

/**
 * section: version number
 * version: 0.1.0
 *
 * section: documentation
 * tldr: builds the complete suite of built-in and custom mastra processors for sdlc agents
 * verbose: instantiates native @mastra/core/processors (UnicodeNormalizer, RegexFilterProcessor,
 * TokenLimiterProcessor, ToolCallFilter, ResponseCache with InMemoryServerCache) alongside
 * custom sdlc processors.
 *
 * section: arguments
 * - options (object, optional): configuration for cache, token limits, token verification, and xstate
 *
 * section: return value
 * - suite (object): structured collection of input/output processors and shared server cache
 *
 * section: example
 * const suite = create_sdlc_processor_suite();
 */
export function create_sdlc_processor_suite(options = {}) {
  const {
    cache = new InMemoryServerCache({ maxSize: 500, ttlMs: 300_000 }),
    token_limit = 64_000,
    max_processor_retries = 3,
    verify_token = null,
    require_token = false,
    get_active_phase = null,
    regex_strategy = 'block',
    forbid_es6_classes = false,
    enforce_lowercase_prose = false
  } = options;

  const unicode_normalizer = new UnicodeNormalizer({
    stripControlChars: true,
    preserveEmojis: true,
    collapseWhitespace: false,
    trim: true
  });

  const regex_filter = new RegexFilterProcessor({
    rules: [...SDLC_REGEX_GUARDRAIL_RULES],
    presets: ['secrets'],
    strategy: regex_strategy,
    phase: 'all'
  });

  const token_limiter = new TokenLimiterProcessor({
    limit: token_limit,
    strategy: 'truncate',
    countMode: 'cumulative'
  });

  const tool_call_filter = new ToolCallFilter({
    filterAfterToolSteps: 6,
    preserveModelOutput: true
  });

  const response_cache = new ResponseCache({
    cache,
    ttl: 300,
    agentId: 'sdlc-harness-agent'
  });

  const supervisor_token_guard = create_supervisor_token_input_processor({
    verify_token: verify_token || options.verify_token_fn || null,
    require_token
  });

  const xstate_phase_lock = create_xstate_phase_lock_processor({
    get_active_phase: get_active_phase || options.get_active_phase_fn || null,
    allowed_phases: options.allowed_phases || null
  });

  const governance_output_guard = create_sdlc_governance_output_processor({
    max_retries: max_processor_retries,
    forbid_host_collections: true,
    forbid_es6_classes,
    forbid_direct_store_access: true,
    enforce_lowercase_prose
  });

  return {
    cache,
    max_processor_retries,
    built_in: {
      unicode_normalizer,
      regex_filter,
      token_limiter,
      tool_call_filter,
      response_cache
    },
    custom: {
      supervisor_token_guard,
      xstate_phase_lock,
      governance_output_guard
    },
    specialist_input_processors: [
      unicode_normalizer,
      supervisor_token_guard,
      tool_call_filter,
      token_limiter,
      response_cache
    ],
    specialist_output_processors: [
      regex_filter,
      governance_output_guard
    ],
    supervisor_input_processors: [
      unicode_normalizer,
      xstate_phase_lock,
      token_limiter,
      response_cache
    ],
    supervisor_output_processors: [
      governance_output_guard
    ]
  };
}
