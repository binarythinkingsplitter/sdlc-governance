/**
 * =========================================================================
 * module: agent message bus
 * =========================================================================
 * 
 * section: version number
 * version: 0.1.0
 * 
 * section: documentation
 * tldr: inter-agent communication bus for direct messaging, clarifications, and pub-sub events
 * verbose: manages asynchronous agent mailboxes, clarification requests/replies between specialist
 * worker daemons and lead/supervisor agents, and event-driven wakeups for the work board.
 * persists message records via the tier 1 document entity store when provided.
 * 
 * section: export catalog
 * - AgentMessageBus: class implementing the inter-agent message bus
 * - create_agent_message_bus: convenience constructor returning an AgentMessageBus
 * =========================================================================
 */

import { EventEmitter } from 'node:events';
import { EventEmitterPubSub } from '@mastra/core/events';
import { createSignal, createMessageSignal, signalToXmlMarkup } from '@mastra/core/agent';
import { createNotificationSignal, summarizeNotifications } from '@mastra/core/notifications';
import { A2AAgent } from '@mastra/core/a2a';
import { DocumentEntityTypes } from './DocumentEntitiesSchema.js';

/**
 * =========================================================================
 * class: AgentMessageBus
 * =========================================================================
 * 
 * section: version number
 * version: 0.2.0
 * 
 * section: documentation
 * tldr: inter-agent communication bus and pub-sub notification hub
 * verbose: provides direct mailbox routing, clarification handshakes, escalation alerts,
 * and topic subscriptions so idle worker daemons wake immediately on board changes.
 * subscribers, signal inboxes, a2a agents, and leases are held in native Map/Set collections.
 * 
 * section: arguments
 * - options (object, optional): { store, logger, pubsub, max_listeners }
 * 
 * section: example
 * const bus = new AgentMessageBus({ store });
 * bus.send_message({ from: 'se-worker-01', to: 'system-architect', topic: 'clarification_request' });
 * =========================================================================
 */
export class AgentMessageBus {
  store;
  logger;
  emitter;
  pubsub;
  memory_messages = new Map();
  subscribers = new Map();
  signal_inboxes = new Map();
  a2a_agents = new Map();
  active_leases = new Map();
  #msg_seq = 0;

  constructor(options = {}) {
    this.store = options.store || null;
    this.logger = options.logger || null;
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(options.max_listeners || 100);
    this.pubsub = options.pubsub || new EventEmitterPubSub(this.emitter);
  }

  #next_message_id() {
    this.#msg_seq += 1;
    return `msg-${Date.now()}-${String(this.#msg_seq).padStart(4, '0')}`;
  }

  #persist_message(record) {
    if (this.store) {
      return this.store.save_entity(DocumentEntityTypes.AGENT_MESSAGE, record);
    }
    this.memory_messages.set(record.id, record);
    return record;
  }

  #load_all_messages() {
    if (this.store) {
      return this.store.list_entities(DocumentEntityTypes.AGENT_MESSAGE);
    }
    return [...this.memory_messages.values()];
  }

  #inbox_for(agent_id) {
    if (!this.signal_inboxes.has(agent_id)) {
      this.signal_inboxes.set(agent_id, []);
    }
    return this.signal_inboxes.get(agent_id);
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: subscribes a listener callback to a message bus topic
   * verbose: registers an event handler for real-time notifications (e.g. ticket:ready).
   * 
   * section: arguments
   * - topic (string): event topic name
   * - handler (function): callback invoked with event payload
   * 
   * section: return value
   * - unsubscribe (function): function to remove the subscription
   * 
   * section: example
   * const unsub = bus.subscribe('ticket:ready', (ev) => console.log(ev));
   */
  subscribe(topic, handler) {
    if (!this.subscribers.has(topic)) {
      this.subscribers.set(topic, new Set());
    }
    this.subscribers.get(topic).add(handler);
    return () => {
      this.subscribers.get(topic)?.delete(handler);
    };
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: publishes an event payload to all subscribers of a topic
   * verbose: notifies all registered listeners on the specified topic and wildcard listeners.
   * 
   * section: arguments
   * - topic (string): event topic name
   * - event_payload (object, optional): structured event data
   * 
   * section: return value
   * - delivered_count (number): number of invoked subscribers
   * 
   * section: example
   * bus.publish('ticket:ready', { ticket_id: 't-01', role: 'software-engineer' });
   */
  publish(topic, event_payload = {}) {
    const list = [...(this.subscribers.get(topic) ?? []), ...(this.subscribers.get('*') ?? [])];
    let delivered = 0;
    const timestamp = new Date().toISOString();
    const reactive_signal = createSignal({
      type: 'reactive',
      tagName: String(topic).replace(/[^a-zA-Z0-9_-]/g, '-'),
      contents: JSON.stringify(event_payload),
      attributes: {
        topic: String(topic),
        ticket_id: event_payload.ticket_id ?? null,
        role: event_payload.role ?? null
      },
      transient: true
    });
    void this.pubsub.publish(`sdlc:${topic}`, {
      type: String(topic),
      data: {
        topic,
        ...event_payload,
        signal_xml: signalToXmlMarkup(reactive_signal),
        timestamp
      }
    });
    for (const listener of list) {
      try {
        listener({ topic, ...event_payload, signal: reactive_signal, timestamp });
        delivered += 1;
      } catch (_err) {
        // ignore listener errors to preserve bus stability
      }
    }
    return delivered;
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: sends and persists a structured inter-agent message
   * verbose: stores the message in the recipient's mailbox and emits a notification event.
   * 
   * section: arguments
   * - params (object): message parameters { id, from, to, topic, ticket_id, payload }
   * 
   * section: return value
   * - message (object): persisted message entity
   * 
   * section: example
   * const msg = bus.send_message({ from: 'se-01', to: 'arch-01', topic: 'direct', payload: { text: 'hi' } });
   */
  send_message(params = {}) {
    const record = {
      id: params.id || this.#next_message_id(),
      from: params.from || 'system',
      to: params.to || 'sdlc-supervisor',
      topic: params.topic || 'direct',
      ticket_id: params.ticket_id || null,
      payload: params.payload || {},
      status: 'unread',
      timestamp: new Date().toISOString()
    };

    const saved = this.#persist_message(record);

    if (this.logger) {
      this.logger.info({
        event: 'agent_bus:message_sent',
        message_id: saved.id,
        from: saved.from,
        to: saved.to,
        topic: saved.topic,
        ticket_id: saved.ticket_id
      });
    }

    this.publish(`mailbox:${saved.to}`, saved);
    this.publish(saved.topic, saved);
    return saved;
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: dispatches a clarification request from a worker to a target role or supervisor
   * verbose: creates a clarification_request message linked to the paused ticket.
   * 
   * section: arguments
   * - params (object): { from_worker, to_role, ticket_id, question, context }
   * 
   * section: return value
   * - message (object): created clarification request message
   * 
   * section: example
   * const req = bus.request_clarification({ from_worker: 'se-01', to_role: 'system-architect', ticket_id: 't-02', question: 'missing field?' });
   */
  request_clarification(params = {}) {
    return this.send_message({
      from: params.from_worker || 'worker',
      to: params.to_role || 'system-architect',
      topic: 'clarification_request',
      ticket_id: params.ticket_id || null,
      payload: {
        question: params.question || '',
        context: params.context || {}
      }
    });
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: replies to a pending clarification request message
   * verbose: marks the original clarification request resolved and sends a clarification_reply back to the requester.
   * 
   * section: arguments
   * - params (object): { request_id, from_worker, answer }
   * 
   * section: return value
   * - reply (object): created clarification reply message
   * 
   * section: example
   * const rep = bus.reply_clarification({ request_id: 'msg-1', from_worker: 'arch-01', answer: 'use string uuid' });
   */
  reply_clarification(params = {}) {
    const all = this.#load_all_messages();
    const original = all.find((m) => m.id === params.request_id);
    if (original) {
      this.#persist_message({
        ...original,
        status: 'resolved'
      });
    }

    return this.send_message({
      from: params.from_worker || 'system-architect',
      to: original ? original.from : (params.to || 'sdlc-supervisor'),
      topic: 'clarification_reply',
      ticket_id: original ? original.ticket_id : (params.ticket_id || null),
      payload: {
        request_id: params.request_id || null,
        answer: params.answer || ''
      }
    });
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: retrieves messages addressed to a specific agent or role
   * verbose: filters stored messages by recipient and optional status/topic criteria.
   * 
   * section: arguments
   * - recipient (string): target agent id or role name
   * - filter (object, optional): optional { status, topic, ticket_id }
   * 
   * section: return value
   * - messages (array): matching messages
   * 
   * section: example
   * const inbox = bus.get_inbox('system-architect', { status: 'unread' });
   */
  get_inbox(recipient, filter = {}) {
    const all = this.#load_all_messages();
    return all.filter((m) => {
      if (recipient && m.to !== recipient) {
        return false;
      }
      if (filter.status && m.status !== filter.status) {
        return false;
      }
      if (filter.topic && m.topic !== filter.topic) {
        return false;
      }
      if (filter.ticket_id && m.ticket_id !== filter.ticket_id) {
        return false;
      }
      return true;
    });
  }

  /**
   * section: version number
   * version: 0.1.0
   * 
   * section: documentation
   * tldr: lists all messages across the bus
   * verbose: returns all persisted messages with optional topic or ticket filtering.
   * 
   * section: arguments
   * - filter (object, optional): optional filter { topic, ticket_id, status }
   * 
   * section: return value
   * - messages (array): array of message records
   * 
   * section: example
   * const all = bus.list_messages();
   */
  list_messages(filter = {}) {
    return this.get_inbox(null, filter);
  }

  /**
   * section: version number
   * version: 0.1.0
   *
   * section: documentation
   * tldr: creates and queues a native mastra CreatedAgentSignal for a target agent
   * verbose: uses @mastra/core/agent createSignal or createMessageSignal and queues the
   * signal into the recipient agent's signal inbox.
   *
   * section: arguments
   * - to_agent (string): recipient agent or worker id
   * - signal_input (object): mastra AgentSignalInput ({ type, contents, tagName, attributes })
   *
   * section: return value
   * - created_signal (object): CreatedAgentSignal instance
   *
   * section: example
   * const sig = bus.send_signal('se-worker-01', { type: 'reactive', contents: 'ticket ready' });
   */
  send_signal(to_agent, signal_input = {}) {
    const contents = signal_input.contents || signal_input.text || JSON.stringify(signal_input);
    const created_signal = signal_input.use_message_signal === true
      ? createMessageSignal(contents, {
        attributes: {
          from: signal_input.from || 'sdlc-supervisor',
          kind: signal_input.kind || 'message',
          ...(signal_input.attributes || {})
        }
      })
      : createSignal({
        type: signal_input.type || 'reactive',
        tagName: signal_input.tagName || 'signal',
        contents,
        attributes: {
          from: signal_input.from || 'sdlc-supervisor',
          kind: signal_input.kind || 'message',
          ...(signal_input.attributes || {})
        }
      });
    const xml = signalToXmlMarkup(created_signal);
    const wrapped = {
      ...created_signal,
      signal: created_signal,
      xml
    };
    this.#inbox_for(to_agent).push(wrapped);
    return wrapped;
  }

  /**
   * section: version number
   * version: 0.1.0
   *
   * section: documentation
   * tldr: creates a native mastra notification signal and delivers it to an agent's inbox
   * verbose: uses @mastra/core/notifications createNotificationSignal and summarizeNotifications.
   *
   * section: arguments
   * - to_agent (string): recipient agent id
   * - notification (object): notification details (title, message, priority, source)
   *
   * section: return value
   * - result (object): { record, signal, xml, summary }
   *
   * section: example
   * const n = bus.create_notification('se-worker-01', { title: 'rework', message: 'fix tests' });
   */
  create_notification(to_agent, notification = {}) {
    const now = new Date();
    const summary_text = notification.summary || notification.body || notification.message || notification.subject || notification.title || 'sdlc notification';
    const record = {
      id: notification.id || this.#next_message_id(),
      threadId: notification.threadId || `thread-${to_agent}`,
      resourceId: notification.resourceId || to_agent,
      source: notification.source || 'sdlc-supervisor',
      type: notification.type || notification.category || 'ticket_event',
      category: notification.category || 'general',
      priority: notification.priority || 'high',
      title: notification.title || notification.subject || 'sdlc notification',
      subject: notification.subject || notification.title || 'sdlc notification',
      message: summary_text,
      summary: summary_text,
      metadata: notification.metadata || {},
      status: 'pending',
      createdAt: now,
      updatedAt: now
    };
    const signal = createNotificationSignal(record);
    const xml = signalToXmlMarkup(signal);
    const summary = summarizeNotifications([record]);
    const entry = { record, signal, xml, summary };
    this.#inbox_for(to_agent).push(entry);
    return entry;
  }

  /**
   * section: version number
   * version: 0.1.0
   *
   * section: documentation
   * tldr: drains all pending mastra CreatedAgentSignals for an agent
   * verbose: returns and clears the queued signal inbox for the specified agent.
   *
   * section: arguments
   * - agent_id (string): recipient agent or worker identifier
   *
   * section: return value
   * - drained (object): { signals, count, summary }
   *
   * section: example
   * const sigs = bus.drain_signals('se-worker-01');
   */
  drain_signals(agent_id) {
    const pending = [...(this.signal_inboxes.get(agent_id) ?? [])];
    this.signal_inboxes.set(agent_id, []);
    const summary = pending.map((item) => item.xml || signalToXmlMarkup(item.signal || item)).join('\n');
    return {
      signals: pending,
      count: pending.length,
      summary
    };
  }

  /**
   * section: version number
   * version: 0.1.0
   *
   * section: documentation
   * tldr: instantiates and registers a native mastra A2AAgent for remote subagent delegation
   * verbose: wraps @mastra/core/a2a A2AAgent and verifies SubAgent compatibility.
   *
   * section: arguments
   * - config (object): A2AAgentOptions ({ id, name, description, url, agent_url, protocolVersion, fetch })
   *
   * section: return value
   * - registration (object): registered A2AAgent descriptor with compatible flag
   *
   * section: example
   * const a2a = bus.register_a2a_agent({ id: 'remote-sec', url: 'https://a2a.local/sec' });
   */
  register_a2a_agent(config = {}) {
    const target_url = config.url || config.agent_url || 'https://a2a.local/sdlc-specialist';
    const agent = new A2AAgent({
      id: config.id || 'remote-a2a-specialist',
      name: config.name || config.id || 'remote a2a specialist',
      description: config.description || 'remote a2a specialist subagent governed by sdlc-supervisor',
      url: target_url,
      protocolVersion: config.protocolVersion || '1.0',
      fetch: config.fetch
    });
    const entry = {
      id: agent.id,
      name: agent.name,
      agent,
      compatible: typeof agent.generate === 'function' && typeof agent.stream === 'function',
      protocol_version: config.protocolVersion || '1.0',
      url: target_url
    };
    this.a2a_agents.set(agent.id, entry);
    return entry;
  }

  /**
   * section: version number
   * version: 0.1.0
   *
   * section: documentation
   * tldr: returns all registered remote A2AAgent instances
   * verbose: returns array of registered A2AAgent descriptors.
   *
   * section: arguments
   * none
   *
   * section: return value
   * - list (array): array of A2AAgent registration descriptors
   *
   * section: example
   * const list = bus.list_a2a_agents();
   */
  list_a2a_agents() {
    return [...this.a2a_agents.values()];
  }

  /**
   * section: version number
   * version: 0.1.0
   *
   * section: documentation
   * tldr: acquires a distributed lease via mastra's native EventEmitterPubSub LeaseProvider
   * verbose: checks lease ownership and expiry and delegates to pubsub.acquireLease(key, owner, ttl_ms).
   *
   * section: arguments
   * - key (string): lease resource key
   * - owner (string): worker id acquiring the lease
   * - ttl_ms (number, optional): lease time-to-live in milliseconds
   *
   * section: return value
   * - acquired (boolean): true if lease was acquired or renewed by owner
   *
   * section: example
   * const ok = bus.acquire_lease('ticket:t-1', 'se-01', 60000);
   */
  acquire_lease(key, owner, ttl_ms = 60_000) {
    const now = Date.now();
    const existing = this.active_leases.get(key);
    if (existing && existing.expires_at > now && existing.owner !== owner) {
      return false;
    }
    this.active_leases.set(key, {
      owner,
      expires_at: now + ttl_ms
    });
    void this.pubsub.acquireLease(key, owner, ttl_ms);
    return true;
  }

  /**
   * section: version number
   * version: 0.1.0
   *
   * section: documentation
   * tldr: releases a lease held on mastra's native EventEmitterPubSub LeaseProvider
   * verbose: releases the lease if owned by owner and delegates to pubsub.releaseLease(key, owner).
   *
   * section: arguments
   * - key (string): lease resource key
   * - owner (string): worker id releasing the lease
   *
   * section: return value
   * - released (boolean): true if released
   *
   * section: example
   * bus.release_lease('ticket:t-1', 'se-01');
   */
  release_lease(key, owner) {
    const existing = this.active_leases.get(key);
    if (!existing || existing.owner !== owner) {
      return false;
    }
    this.active_leases.delete(key);
    void this.pubsub.releaseLease(key, owner);
    return true;
  }

  /**
   * section: version number
   * version: 0.1.0
   *
   * section: documentation
   * tldr: returns the underlying mastra EventEmitterPubSub instance
   * verbose: exposes the EventEmitterPubSub instance so Mastra({ pubsub }) shares the bus.
   *
   * section: arguments
   * none
   *
   * section: return value
   * - pubsub (EventEmitterPubSub): native mastra pubsub instance
   *
   * section: example
   * const ps = bus.get_pubsub();
   */
  get_pubsub() {
    return this.pubsub;
  }
}

/**
 * function: create_agent_message_bus
 * tldr: convenience constructor returning a new AgentMessageBus
 */
export function create_agent_message_bus(options = {}) {
  return new AgentMessageBus(options);
}
