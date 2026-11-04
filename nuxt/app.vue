<script setup>
import { ref, computed, onMounted, watch } from 'vue';

const active_nav = ref('overview');
const loading = ref(false);
const action_busy = ref(false);
const toast_message = ref('');
const toast_type = ref('info');

const dashboard = ref({
  status: {
    session_id: 'loading...',
    project_state: 'active_development',
    macro_phase: 'phase_00_inception',
    active_phase: 'phase_00_inception',
    active_gate: null,
    active_work_item: null,
    work_items: []
  },
  phases: [],
  gates: [],
  work_item_types: [],
  processes: [],
  board: {
    tickets: [],
    summary: { counts: { total: 0, ready: 0, in_progress: 0, completed: 0, blocked: 0, awaiting_input: 0 } }
  },
  worker_pool: {
    workers: [],
    requests: []
  },
  agents: [],
  controller_modes: [],
  workflows: [],
  dynamic_templates: {},
  skills: [],
  architecture: {
    objects: { phases: [], gates: [], roles: [], workflows: [], work_item_types: [], artefact_types: [] },
    definitions: [],
    project_config: { project_id: 'dual-engine-harness', disabled_processes: [], gate_policies: {}, worker_pool_config: { role_counts: {} } }
  },
  store: {
    counts: {},
    entities: {}
  },
  pull_requests: [],
  logs: []
});

// Modal & Launcher State
const show_launch_modal = ref(false);
const launch_form = ref({
  process_type: 'develop-feature',
  name: 'oauth-token-rotation',
  description: 'Implement OAuth2 refresh token rotation with TDD red-green-refactor and STRIDE threat model.',
  background: false
});

// Gate Evaluation State
const gate_eval_receipt = ref(null);

// Kanban State
const kanban_epic_filter = ref('');
const selected_ticket = ref(null);
const clarification_answer = ref('Approved by operator: proceed with strict JWT expiry of 15m and rotating refresh tokens.');

// Agent Playground State
const selected_agent_id = ref('product-manager');
const selected_controller_mode = ref('discovery');
const chat_input = ref('Outline the key acceptance criteria and STRIDE security invariants for OAuth2 refresh token rotation.');
const chat_history = ref([
  {
    role: 'system',
    agent_id: 'sdlc-supervisor',
    text: 'Dual-Engine SDLC Agent Controller initialized. Select any of the 8 specialist roles or AgentController modes to run governed turns or apply live IMastraEditor overrides.',
    timestamp: new Date().toISOString()
  }
]);
const override_form = ref({
  description: '',
  instructions: ''
});

// Workflows & Dynamic Builder State
const selected_workflow_id = ref('helloworld-workflow');
const workflow_input_json = ref(JSON.stringify({
  message: 'hello from nuxt 4 sdlc admin studio',
  feature_name: 'oauth-token-rotation',
  project_id: 'dual-engine-harness'
}, null, 2));
const workflow_output = ref(null);
const selected_dynamic_template_key = ref('dynamic-sdlc-hello-verification');
const dynamic_workflow_json = ref('');

// 3-Level SDLC Architecture State
const arch_level_tab = ref('level2');
const selected_process_id = ref('develop-feature');
const new_phase_form = ref({
  id: 'compliance_audit',
  name: 'compliance audit',
  description: 'SOC2 and regulatory compliance verification phase',
  gate: null
});
const new_gate_form = ref({
  id: 'gate_compliance',
  name: 'compliance sign-off gate',
  description: 'Formal regulatory compliance gate',
  invariants: 'soc2_controls_verified, audit_trail_signed'
});
const clone_process_form = ref({
  new_id: 'develop-regulated-feature',
  title: 'Develop Regulated Feature'
});
const insert_stage_form = ref({
  after_suffix: 'sec',
  suffix: 'compliance-check',
  title: 'Run Compliance Check',
  role: 'security-engineer',
  workflow_id: 'sec-threat-modeling',
  phase: 'phase_06_security_review'
});

// Document Entity Store & RAG State
const selected_entity_type = ref('prd');
const selected_entity_id = ref('');
const selected_document_preview = ref({
  entity: null,
  markdown: ''
});
const rag_query = ref('statechart governance mastra workflow');
const rag_hits = ref([]);
const sync_direction = ref('bidirectional');
const sync_receipt = ref(null);

function show_toast(msg, type = 'info') {
  toast_message.value = msg;
  toast_type.value = type;
  setTimeout(() => {
    if (toast_message.value === msg) {
      toast_message.value = '';
    }
  }, 4500);
}

async function fetch_dashboard() {
  loading.value = true;
  try {
    const res = await fetch('/api/mastra/sdlc/dashboard');
    if (res.ok) {
      const data = await res.json();
      dashboard.value = data;

      // Sync agent override form if empty
      const current_agent = (data.agents || []).find((a) => a.id === selected_agent_id.value);
      if (current_agent && !override_form.value.description) {
        override_form.value.description = current_agent.description || '';
        override_form.value.instructions = current_agent.instructions || '';
      }

      // Sync dynamic workflow template preview if empty
      if (!dynamic_workflow_json.value && data.dynamic_templates?.[selected_dynamic_template_key.value]) {
        dynamic_workflow_json.value = JSON.stringify(
          data.dynamic_templates[selected_dynamic_template_key.value],
          null,
          2
        );
      }

      // Sync store preview selection
      const entities_for_type = data.store?.entities?.[selected_entity_type.value] || [];
      if (entities_for_type.length > 0 && !selected_entity_id.value) {
        select_store_entity(selected_entity_type.value, entities_for_type[0].id);
      }
    }
  } catch (err) {
    show_toast(`Failed to load dashboard telemetry: ${err.message}`, 'error');
  } finally {
    loading.value = false;
  }
}

watch(selected_agent_id, (new_id) => {
  const found = (dashboard.value.agents || []).find((a) => a.id === new_id);
  if (found) {
    override_form.value.description = found.description || '';
    override_form.value.instructions = found.instructions || '';
  }
});

watch(selected_dynamic_template_key, (new_key) => {
  const tpl = dashboard.value.dynamic_templates?.[new_key];
  if (tpl) {
    dynamic_workflow_json.value = JSON.stringify(tpl, null, 2);
  }
});

const kanban_columns = computed(() => {
  const all_tickets = (dashboard.value.board?.tickets || []).filter((t) => {
    if (!kanban_epic_filter.value) return true;
    return t.epic_id === kanban_epic_filter.value;
  });

  const cols = [
    { key: 'blocked', label: 'Backlog / Blocked', color: '#64748b', items: [] },
    { key: 'ready', label: 'Ready Queue', color: '#38bdf8', items: [] },
    { key: 'in_progress', label: 'In Progress', color: '#f59e0b', items: [] },
    { key: 'awaiting_input', label: 'Awaiting Input', color: '#ec4899', items: [] },
    { key: 'in_review', label: 'Gate / Review', color: '#a855f7', items: [] },
    { key: 'rework', label: 'Rework / Escalated', color: '#ef4444', items: [] },
    { key: 'completed', label: 'Verified & Done', color: '#10b981', items: [] }
  ];

  for (const t of all_tickets) {
    if (t.status === 'ready') cols[1].items.push(t);
    else if (t.status === 'in_progress') cols[2].items.push(t);
    else if (t.status === 'awaiting_input') cols[3].items.push(t);
    else if (t.status === 'in_review') cols[4].items.push(t);
    else if (t.status === 'rework' || t.status === 'escalated') cols[5].items.push(t);
    else if (t.status === 'completed') cols[6].items.push(t);
    else cols[0].items.push(t);
  }

  return cols;
});

const epic_list = computed(() => {
  const set = new Set();
  for (const t of dashboard.value.board?.tickets || []) {
    if (t.epic_id) set.add(t.epic_id);
  }
  return Array.from(set);
});

const worker_role_groups = computed(() => {
  const roles = [
    'product-manager',
    'system-architect',
    'software-engineer',
    'security-engineer',
    'qa-engineer',
    'devops-engineer'
  ];
  const workers = dashboard.value.worker_pool?.workers || [];
  return roles.map((role) => {
    const matching = workers.filter((w) => w.role === role);
    const completed = matching.reduce((acc, w) => acc + (w.completed_count || 0), 0);
    const busy = matching.filter((w) => w.status !== 'idle').length;
    return {
      role,
      count: matching.length,
      busy,
      completed,
      workers: matching
    };
  });
});

const selected_process_profile = computed(() => {
  const defs = dashboard.value.architecture?.definitions || [];
  return defs.find((d) => d.id === selected_process_id.value) || defs[0] || null;
});

const total_store_entities = computed(() => {
  const counts = dashboard.value.store?.counts || {};
  return Object.values(counts).reduce((a, b) => a + (Number(b) || 0), 0);
});

// Actions
async function submit_governed_work() {
  action_busy.value = true;
  try {
    const res = await fetch('/api/mastra/sdlc/work/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(launch_form.value)
    });
    const data = await res.json();
    if (data.ok) {
      show_toast(`Dispatched '${launch_form.value.process_type}' (${launch_form.value.name}) via Worker Pool`, 'success');
      show_launch_modal.value = false;
      await fetch_dashboard();
    } else {
      show_toast(data.error || 'Failed to submit work item', 'error');
    }
  } catch (err) {
    show_toast(err.message, 'error');
  } finally {
    action_busy.value = false;
  }
}

async function advance_active_work_item(work_item_name = null) {
  action_busy.value = true;
  try {
    const res = await fetch('/api/mastra/sdlc/work/advance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(work_item_name ? { name: work_item_name } : {})
    });
    const data = await res.json();
    if (data.ok) {
      show_toast(`Stage executed -> active phase: ${data.active_phase}`, 'success');
      await fetch_dashboard();
    } else {
      show_toast(data.error || 'Cannot advance stage', 'error');
    }
  } catch (err) {
    show_toast(err.message, 'error');
  } finally {
    action_busy.value = false;
  }
}

async function focus_work_item(name) {
  action_busy.value = true;
  try {
    await fetch('/api/mastra/sdlc/work/focus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    show_toast(`Focused work item: ${name}`, 'info');
    await fetch_dashboard();
  } finally {
    action_busy.value = false;
  }
}

async function evaluate_review_gate(gate_id) {
  action_busy.value = true;
  try {
    const res = await fetch('/api/mastra/sdlc/gates/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gate_id })
    });
    const data = await res.json();
    gate_eval_receipt.value = data;
    show_toast(`Gate ${gate_id} evaluated: ${data.evaluation?.decision || 'done'}`, 'success');
    await fetch_dashboard();
  } catch (err) {
    show_toast(err.message, 'error');
  } finally {
    action_busy.value = false;
  }
}

async function scale_worker_role(role, next_count) {
  if (next_count < 1) return;
  action_busy.value = true;
  try {
    const res = await fetch('/api/mastra/sdlc/pool/scale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, count: next_count })
    });
    const data = await res.json();
    if (data.ok) {
      show_toast(`Scaled ${role} pool to ${next_count} daemon worker(s)`, 'success');
      await fetch_dashboard();
    }
  } finally {
    action_busy.value = false;
  }
}

async function drain_worker_board() {
  action_busy.value = true;
  try {
    const res = await fetch('/api/mastra/sdlc/pool/drain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const data = await res.json();
    if (data.ok) {
      show_toast('Worker pool drained ready tickets across board', 'success');
      await fetch_dashboard();
    }
  } finally {
    action_busy.value = false;
  }
}

async function resolve_ticket_clarification(ticket) {
  action_busy.value = true;
  try {
    const res = await fetch('/api/mastra/sdlc/work/clarify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ticket_id: ticket.id,
        epic_id: ticket.epic_id,
        answer: clarification_answer.value
      })
    });
    const data = await res.json();
    if (data.ok) {
      show_toast(`Clarification resolved for ${ticket.id}`, 'success');
      selected_ticket.value = null;
      await fetch_dashboard();
    }
  } finally {
    action_busy.value = false;
  }
}

async function send_agent_chat() {
  if (!chat_input.value.trim()) return;
  const user_msg = chat_input.value.trim();
  chat_history.value.push({
    role: 'user',
    agent_id: 'operator',
    text: user_msg,
    timestamp: new Date().toISOString()
  });
  chat_input.value = '';
  action_busy.value = true;
  try {
    const res = await fetch('/api/mastra/sdlc/agents/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_id: selected_agent_id.value,
        mode: selected_controller_mode.value,
        prompt: user_msg
      })
    });
    const data = await res.json();
    chat_history.value.push({
      role: 'assistant',
      agent_id: data.role || selected_agent_id.value,
      mode: data.mode,
      text: data.reply || JSON.stringify(data.outcome, null, 2),
      outcome: data.outcome,
      timestamp: data.timestamp || new Date().toISOString()
    });
    await fetch_dashboard();
  } catch (err) {
    chat_history.value.push({
      role: 'assistant',
      agent_id: selected_agent_id.value,
      text: `Error: ${err.message}`,
      timestamp: new Date().toISOString()
    });
  } finally {
    action_busy.value = false;
  }
}

async function save_agent_override() {
  action_busy.value = true;
  try {
    const res = await fetch('/api/mastra/stored/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: selected_agent_id.value,
        name: selected_agent_id.value,
        description: override_form.value.description,
        instructions: override_form.value.instructions
      })
    });
    if (res.ok) {
      show_toast(`Saved IMastraEditor override for ${selected_agent_id.value}`, 'success');
      await fetch_dashboard();
    } else {
      show_toast('Failed to save stored agent override', 'error');
    }
  } finally {
    action_busy.value = false;
  }
}

async function run_selected_workflow() {
  action_busy.value = true;
  try {
    let parsed_inputs = {};
    try {
      parsed_inputs = JSON.parse(workflow_input_json.value || '{}');
    } catch (_e) {
      show_toast('Invalid JSON in workflow inputs', 'error');
      action_busy.value = false;
      return;
    }
    const res = await fetch('/api/mastra/sdlc/workflows/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workflow_id: selected_workflow_id.value,
        inputs: parsed_inputs
      })
    });
    const data = await res.json();
    workflow_output.value = data;
    show_toast(`Workflow '${selected_workflow_id.value}' completed`, 'success');
    await fetch_dashboard();
  } catch (err) {
    show_toast(err.message, 'error');
  } finally {
    action_busy.value = false;
  }
}

async function register_and_run_dynamic_workflow() {
  action_busy.value = true;
  try {
    const definition = JSON.parse(dynamic_workflow_json.value);
    const reg_res = await fetch('/api/mastra/sdlc/workflows/register-dynamic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ definition })
    });
    const reg_data = await reg_res.json();
    if (reg_data.ok) {
      selected_workflow_id.value = reg_data.id;
      show_toast(`Registered dynamic workflow '${reg_data.id}' into Mastra runtime`, 'success');
      await fetch_dashboard();
    } else {
      show_toast(reg_data.error || 'Registration failed', 'error');
    }
  } catch (err) {
    show_toast(`Dynamic workflow error: ${err.message}`, 'error');
  } finally {
    action_busy.value = false;
  }
}

async function mutate_architecture(payload) {
  action_busy.value = true;
  try {
    const res = await fetch('/api/mastra/sdlc/architecture/configure', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.ok) {
      dashboard.value.architecture = data.architecture;
      if (payload.action === 'clone_process' && payload.new_id) {
        selected_process_id.value = payload.new_id;
      }
      show_toast(`SDLC Architecture updated (${payload.action})`, 'success');
    } else {
      show_toast(data.error || 'Architecture update failed', 'error');
    }
  } catch (err) {
    show_toast(err.message, 'error');
  } finally {
    action_busy.value = false;
  }
}

async function select_store_entity(type, id) {
  selected_entity_type.value = type;
  selected_entity_id.value = id;
  if (!id) {
    selected_document_preview.value = { entity: null, markdown: '' };
    return;
  }
  try {
    const res = await fetch(`/api/mastra/sdlc/store/document?type=${encodeURIComponent(type)}&id=${encodeURIComponent(id)}`);
    if (res.ok) {
      selected_document_preview.value = await res.json();
    }
  } catch (_err) {
    // ignore
  }
}

async function run_rag_search() {
  if (!rag_query.value.trim()) return;
  action_busy.value = true;
  try {
    const res = await fetch('/api/mastra/sdlc/store/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: rag_query.value, top_k: 8 })
    });
    const data = await res.json();
    rag_hits.value = data.hits || [];
    show_toast(`Hybrid RAG returned ${rag_hits.value.length} chunk(s)`, 'info');
  } finally {
    action_busy.value = false;
  }
}

async function sync_doc_stores() {
  action_busy.value = true;
  try {
    const res = await fetch('/api/mastra/sdlc/store/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        direction: sync_direction.value,
        reindex_rag: true,
        sync_knowledge: true
      })
    });
    const data = await res.json();
    sync_receipt.value = data;
    if (data.ok) {
      show_toast(
        `Statechart '${data.statechart_id}' reached '${data.final_state}' (imported: ${data.migrated_count}, exported: ${data.exported_count}, RAG: ${data.indexed_chunks})`,
        'success'
      );
      await fetch_dashboard();
    } else {
      show_toast(data.error || 'Doc store sync blocked', 'error');
    }
  } catch (err) {
    show_toast(`Doc store sync error: ${err.message}`, 'error');
  } finally {
    action_busy.value = false;
  }
}

onMounted(() => {
  fetch_dashboard();
});
</script>

<template>
  <div class="sdlc-shell">
    <!-- Left Navigation Sidebar -->
    <aside class="sdlc-sidebar">
      <div class="brand-box">
        <div class="brand-logo">⚡</div>
        <div>
          <div class="brand-title">SDLC Control Plane</div>
          <div class="brand-sub">Mastra v1 + XState v5 Studio</div>
        </div>
      </div>

      <div class="nav-group-label">GOVERNANCE & EXECUTION</div>
      <nav class="side-nav">
        <button :class="['nav-item', { active: active_nav === 'overview' }]" @click="active_nav = 'overview'">
          <span class="nav-icon">◉</span>
          <span>Executive Pipeline & Pool</span>
        </button>
        <button :class="['nav-item', { active: active_nav === 'kanban' }]" @click="active_nav = 'kanban'">
          <span class="nav-icon">▦</span>
          <span>Agile Kanban & Work Board</span>
          <span class="nav-badge">{{ dashboard.board?.tickets?.length || 0 }}</span>
        </button>
        <button :class="['nav-item', { active: active_nav === 'agents' }]" @click="active_nav = 'agents'">
          <span class="nav-icon">✦</span>
          <span>Agent Playground & Builder</span>
          <span class="nav-badge">{{ dashboard.agents?.length || 8 }}</span>
        </button>
        <button :class="['nav-item', { active: active_nav === 'workflows' }]" @click="active_nav = 'workflows'">
          <span class="nav-icon">⇄</span>
          <span>Workflows & Dynamic DAGs</span>
          <span class="nav-badge">{{ dashboard.workflows?.length || 14 }}</span>
        </button>
        <button :class="['nav-item', { active: active_nav === 'architecture' }]" @click="active_nav = 'architecture'">
          <span class="nav-icon">❖</span>
          <span>3-Level SDLC Architecture</span>
          <span class="nav-badge">{{ dashboard.architecture?.definitions?.length || 25 }}</span>
        </button>
        <button :class="['nav-item', { active: active_nav === 'store' }]" @click="active_nav = 'store'">
          <span class="nav-icon">▤</span>
          <span>Document Store & RAG</span>
          <span class="nav-badge">{{ total_store_entities }}</span>
        </button>
      </nav>

      <div class="nav-group-label" style="margin-top: 1.25rem;">EMBEDDED MASTRA SPAs</div>
      <nav class="side-nav">
        <button :class="['nav-item', { active: active_nav === 'studio_spa' }]" @click="active_nav = 'studio_spa'">
          <span class="nav-icon">⬡</span>
          <span>Mastra Studio UI (`/_studio`)</span>
        </button>
        <button :class="['nav-item', { active: active_nav === 'factory_spa' }]" @click="active_nav = 'factory_spa'">
          <span class="nav-icon">⚙</span>
          <span>Mastra Factory UI (`/_factory`)</span>
        </button>
      </nav>

      <div class="sidebar-footer">
        <div class="sys-pill">
          <span class="dot-online"></span>
          <span>Session: {{ dashboard.status?.session_id }}</span>
        </div>
        <div class="sys-meta">
          State: <strong>{{ dashboard.status?.project_state }}</strong>
        </div>
        <div class="sys-meta">
          Phase: <strong>{{ dashboard.status?.active_phase }}</strong>
        </div>
      </div>
    </aside>

    <!-- Main Content Area -->
    <div class="sdlc-main">
      <!-- Top Telemetry Header -->
      <header class="sdlc-topbar">
        <div class="topbar-left">
          <span class="status-chip state-chip">{{ dashboard.status?.project_state }}</span>
          <span class="status-chip phase-chip">Phase: {{ dashboard.status?.active_phase }}</span>
          <span v-if="dashboard.status?.active_work_item" class="status-chip item-chip">
            Active Work Item: {{ dashboard.status.active_work_item.name }} ({{ dashboard.status.active_work_item.type }} @ {{ dashboard.status.active_work_item.phase }})
          </span>
        </div>
        <div class="topbar-right">
          <button class="btn btn-primary" @click="show_launch_modal = true">
            + Launch SDLC Process / Work Item
          </button>
          <button class="btn btn-secondary" :disabled="loading" @click="fetch_dashboard">
            {{ loading ? 'Syncing...' : '↻ Refresh Telemetry' }}
          </button>
        </div>
      </header>

      <!-- Toast Banner -->
      <div v-if="toast_message" :class="['toast-banner', `toast-${toast_type}`]">
        <span>{{ toast_message }}</span>
        <button class="toast-close" @click="toast_message = ''">×</button>
      </div>

      <!-- VIEW 1: EXECUTIVE PIPELINE & WORKER POOL -->
      <main v-if="active_nav === 'overview'" class="workspace-scroll">
        <!-- KPI Cards -->
        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-label">SOVEREIGN MACRO PHASE</div>
            <div class="kpi-value">{{ dashboard.status?.active_phase }}</div>
            <div class="kpi-sub">XState v5 Tier 1 Governor</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">ACTIVE WORK ITEMS</div>
            <div class="kpi-value">{{ dashboard.status?.work_items?.length || 0 }}</div>
            <div class="kpi-sub">
              Focused: {{ dashboard.status?.active_work_item?.name || 'None (Idle)' }}
            </div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">WORK BOARD TICKETS</div>
            <div class="kpi-value">
              {{ dashboard.board?.summary?.counts?.completed || 0 }} / {{ dashboard.board?.summary?.counts?.total || 0 }}
            </div>
            <div class="kpi-sub">
              Ready: {{ dashboard.board?.summary?.counts?.ready || 0 }} · Awaiting Input: {{ dashboard.board?.summary?.counts?.awaiting_input || 0 }}
            </div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">DAEMON WORKER POOL</div>
            <div class="kpi-value">{{ dashboard.worker_pool?.workers?.length || 0 }} Workers</div>
            <div class="kpi-sub">
              Requests Routed: {{ dashboard.worker_pool?.requests?.length || 0 }}
            </div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">CLEAN-ROOM ARTEFACTS</div>
            <div class="kpi-value">{{ total_store_entities }} Entities</div>
            <div class="kpi-sub">
              PRDs: {{ dashboard.store?.counts?.prd || 0 }} · ADRs: {{ dashboard.store?.counts?.adr || 0 }} · Stories: {{ dashboard.store?.counts?.user_story || 0 }}
            </div>
          </div>
        </div>

        <!-- 10-Phase Macro Statechart Pipeline -->
        <section class="panel-card">
          <div class="panel-header">
            <div>
              <h2>10-Phase SDLC Macro Statechart & Active Work Item Stage Runner</h2>
              <p class="panel-sub">Deterministic XState v5 lifecycle with cryptographic gate transitions and role workflow bindings.</p>
            </div>
            <div class="panel-actions">
              <button
                v-if="dashboard.status?.active_work_item"
                class="btn btn-accent"
                :disabled="action_busy"
                @click="advance_active_work_item()"
              >
                ▶ Execute Current Work Item Stage ({{ dashboard.status.active_work_item.phase }})
              </button>
              <button class="btn btn-primary" @click="show_launch_modal = true">
                + Start Work Item
              </button>
            </div>
          </div>

          <div class="phase-pipeline">
            <div
              v-for="phase in dashboard.phases"
              :key="phase.id"
              :class="[
                'phase-step',
                {
                  active: dashboard.status?.active_phase === phase.id,
                  completed: phase.order < (dashboard.phases.find((p) => p.id === dashboard.status?.active_phase)?.order ?? 0)
                }
              ]"
            >
              <div class="phase-step-top">
                <span class="phase-index">0{{ phase.order }}</span>
                <span v-if="phase.gate" class="gate-pill">🔒 {{ phase.gate }}</span>
              </div>
              <div class="phase-name">{{ phase.name }}</div>
              <div class="phase-desc">{{ phase.description }}</div>
            </div>
          </div>
        </section>

        <!-- Dual Grid: Formal Review Gates + Active Work Items -->
        <div class="two-col-grid">
          <!-- Review Gates -->
          <section class="panel-card">
            <div class="panel-header">
              <div>
                <h2>Formal Review Gates (Scorer & Gatekeeper Verification)</h2>
                <p class="panel-sub">Evaluate any of the formal review gates with live Mastra scorers and immutability checks.</p>
              </div>
            </div>

            <div class="gate-list">
              <div v-for="gate in dashboard.gates" :key="gate.id" class="gate-row">
                <div class="gate-info">
                  <div class="gate-title">
                    <strong>{{ gate.name }}</strong>
                    <code class="code-badge">{{ gate.id }}</code>
                  </div>
                  <div class="gate-desc">{{ gate.description }}</div>
                  <div class="gate-criteria">
                    <span v-for="c in (gate.criteria || [])" :key="c" class="tag-chip">{{ c }}</span>
                  </div>
                </div>
                <button
                  class="btn btn-secondary btn-sm"
                  :disabled="action_busy"
                  @click="evaluate_review_gate(gate.id)"
                >
                  ✓ Verify Gate
                </button>
              </div>
            </div>

            <div v-if="gate_eval_receipt" class="code-output-box" style="margin-top: 0.75rem;">
              <div class="code-box-header">
                <span>Gate Evaluation Receipt: {{ gate_eval_receipt.gate_id }}</span>
                <span :class="['badge-status', gate_eval_receipt.evaluation?.decision === 'passed' ? 'ok' : 'err']">
                  {{ gate_eval_receipt.evaluation?.decision }}
                </span>
              </div>
              <pre>{{ JSON.stringify(gate_eval_receipt.evaluation, null, 2) }}</pre>
            </div>
          </section>

          <!-- Daemon Worker Pool & Scaling -->
          <section class="panel-card">
            <div class="panel-header">
              <div>
                <h2>Scalable Worker Pool Daemon (`WorkerPoolDaemon`)</h2>
                <p class="panel-sub">Scale specialist role worker daemons (1..100) and drain ready tickets on the Work Board.</p>
              </div>
              <button class="btn btn-accent btn-sm" :disabled="action_busy" @click="drain_worker_board">
                ⚡ Drain Ready Queue
              </button>
            </div>

            <div class="worker-role-table">
              <div v-for="group in worker_role_groups" :key="group.role" class="worker-role-row">
                <div>
                  <div class="worker-role-name">{{ group.role }}</div>
                  <div class="worker-role-sub">
                    {{ group.count }} daemon(s) · {{ group.completed }} tickets completed
                  </div>
                </div>
                <div class="worker-scale-controls">
                  <button class="btn-icon" @click="scale_worker_role(group.role, group.count - 1)">−</button>
                  <span class="worker-count-badge">{{ group.count }}</span>
                  <button class="btn-icon" @click="scale_worker_role(group.role, group.count + 1)">+</button>
                </div>
              </div>
            </div>

            <div v-if="dashboard.status?.work_items?.length" style="margin-top: 1rem;">
              <h3 class="sub-heading">Tracked Work Items</h3>
              <div class="work-item-list">
                <div
                  v-for="wi in dashboard.status.work_items"
                  :key="wi.name"
                  :class="['work-item-row', { focused: dashboard.status.active_work_item?.name === wi.name }]"
                >
                  <div>
                    <strong>{{ wi.name }}</strong>
                    <span class="tag-chip" style="margin-left: 0.5rem;">{{ wi.type }}</span>
                    <span class="tag-chip">Phase: {{ wi.phase }}</span>
                  </div>
                  <div class="row-actions">
                    <button class="btn btn-secondary btn-xs" @click="focus_work_item(wi.name)">Focus</button>
                    <button class="btn btn-primary btn-xs" @click="advance_active_work_item(wi.name)">Advance Stage</button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      <!-- VIEW 2: AGILE KANBAN & WORK BOARD -->
      <main v-else-if="active_nav === 'kanban'" class="workspace-scroll">
        <section class="panel-card">
          <div class="panel-header">
            <div>
              <h2>Agile Kanban & Dependency-Aware Pull Queue (`WorkBoard` + `MastraFactory`)</h2>
              <p class="panel-sub">Tickets are automatically decomposed from SDLC processes, dependency-unlocked via TaskDagEngine, and executed by role workers.</p>
            </div>
            <div class="panel-actions">
              <select v-model="kanban_epic_filter" class="input-select">
                <option value="">All Epics ({{ dashboard.board?.tickets?.length || 0 }} tickets)</option>
                <option v-for="ep in epic_list" :key="ep" :value="ep">Epic: {{ ep }}</option>
              </select>
              <button class="btn btn-accent" :disabled="action_busy" @click="drain_worker_board">
                ⚡ Drain Ready Queue
              </button>
              <button class="btn btn-primary" @click="show_launch_modal = true">
                + New Process / Epic
              </button>
            </div>
          </div>

          <div class="kanban-board">
            <div v-for="col in kanban_columns" :key="col.key" class="kanban-col">
              <div class="kanban-col-header" :style="{ borderTopColor: col.color }">
                <span>{{ col.label }}</span>
                <span class="kanban-count">{{ col.items.length }}</span>
              </div>
              <div class="kanban-cards">
                <div
                  v-for="ticket in col.items"
                  :key="ticket.id"
                  class="kanban-card"
                  @click="selected_ticket = ticket"
                >
                  <div class="kanban-card-top">
                    <code class="ticket-id">{{ ticket.id }}</code>
                    <span class="role-pill">{{ ticket.role }}</span>
                  </div>
                  <div class="kanban-card-title">{{ ticket.title }}</div>
                  <div class="kanban-card-meta">
                    <span>Epic: <strong>{{ ticket.epic_id }}</strong></span>
                    <span>WF: <code>{{ ticket.workflow_id }}</code></span>
                  </div>
                  <div v-if="ticket.depends_on?.length" class="kanban-deps">
                    Depends on: {{ ticket.depends_on.join(', ') }}
                  </div>
                  <div v-if="ticket.status === 'awaiting_input'" class="kanban-alert">
                    ⚠ Clarification Needed — Click to Resolve
                  </div>
                </div>
                <div v-if="col.items.length === 0" class="kanban-empty">
                  No tickets
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Ticket Inspector Drawer / Card -->
        <section v-if="selected_ticket" class="panel-card" style="margin-top: 1rem;">
          <div class="panel-header">
            <div>
              <h2>Ticket Inspector: {{ selected_ticket.id }} — {{ selected_ticket.title }}</h2>
              <p class="panel-sub">
                Role: <strong>{{ selected_ticket.role }}</strong> · Workflow: <code>{{ selected_ticket.workflow_id }}</code> · Status: <strong>{{ selected_ticket.status }}</strong>
              </p>
            </div>
            <button class="btn btn-secondary btn-sm" @click="selected_ticket = null">Close Inspector</button>
          </div>

          <div v-if="selected_ticket.status === 'awaiting_input'" class="clarify-box">
            <h3>Resolve Clarification Pause (`awaiting_input`)</h3>
            <textarea v-model="clarification_answer" rows="3" class="input-textarea"></textarea>
            <button class="btn btn-primary" style="margin-top: 0.5rem;" @click="resolve_ticket_clarification(selected_ticket)">
              ✓ Submit Clarification & Resume Worker Pool
            </button>
          </div>

          <div class="two-col-grid" style="margin-top: 0.75rem;">
            <div class="code-output-box">
              <div class="code-box-header">Ticket Thread & Audit History</div>
              <pre>{{ JSON.stringify(selected_ticket.thread || [], null, 2) }}</pre>
            </div>
            <div class="code-output-box">
              <div class="code-box-header">Ticket Inputs & Output Payload</div>
              <pre>{{ JSON.stringify({ inputs: selected_ticket.inputs, output: selected_ticket.output }, null, 2) }}</pre>
            </div>
          </div>
        </section>
      </main>

      <!-- VIEW 3: AGENT PLAYGROUND & IMastraEditor BUILDER -->
      <main v-else-if="active_nav === 'agents'" class="workspace-scroll">
        <div class="two-col-grid">
          <!-- Left: Multi-Mode Agent Chat Playground -->
          <section class="panel-card">
            <div class="panel-header">
              <div>
                <h2>Multi-Mode AgentController & Specialist Role Playground</h2>
                <p class="panel-sub">Interact directly with any of the 8 Dual-Engine role agents and 8 AgentController modes.</p>
              </div>
            </div>

            <div class="form-row-2">
              <div>
                <label class="field-label">Specialist Role Agent (`Mastra.getAgent`)</label>
                <select v-model="selected_agent_id" class="input-select full-width">
                  <option v-for="ag in dashboard.agents" :key="ag.id" :value="ag.id">
                    {{ ag.id }} — {{ ag.description?.slice(0, 55) }}
                  </option>
                </select>
              </div>
              <div>
                <label class="field-label">AgentController Mode (`@mastra/core/agent-controller`)</label>
                <select v-model="selected_controller_mode" class="input-select full-width">
                  <option v-for="m in dashboard.controller_modes" :key="m.id" :value="m.id">
                    {{ m.id }} ({{ m.role_id }}) {{ m.transitionsTo ? `→ ${m.transitionsTo}` : '' }}
                  </option>
                </select>
              </div>
            </div>

            <div class="chat-transcript">
              <div v-for="(msg, idx) in chat_history" :key="idx" :class="['chat-bubble', `chat-${msg.role}`]">
                <div class="chat-bubble-meta">
                  <strong>{{ msg.agent_id }}</strong>
                  <span v-if="msg.mode" class="tag-chip">mode: {{ msg.mode }}</span>
                  <span>{{ msg.timestamp?.slice(11, 19) }}</span>
                </div>
                <pre class="chat-bubble-text">{{ msg.text }}</pre>
              </div>
            </div>

            <div class="chat-composer">
              <textarea
                v-model="chat_input"
                rows="3"
                class="input-textarea"
                placeholder="Ask the selected role agent to draft a PRD, ADR, TDD suite, STRIDE threat matrix, or evaluate governance..."
                @keydown.ctrl.enter="send_agent_chat"
              ></textarea>
              <div class="chat-composer-bar">
                <div class="quick-prompts">
                  <button class="chip-btn" @click="chat_input = 'Draft a PRD for zero-trust mutual TLS service authentication.'">PRD Prompt</button>
                  <button class="chip-btn" @click="chat_input = 'Author an ADR comparing event sourcing vs statechart snapshots.'">ADR Prompt</button>
                  <button class="chip-btn" @click="chat_input = 'Run STRIDE threat modelling on the OAuth2 token endpoint.'">STRIDE Prompt</button>
                </div>
                <button class="btn btn-primary" :disabled="action_busy" @click="send_agent_chat">
                  {{ action_busy ? 'Running Agent...' : 'Send Turn (Ctrl+Enter)' }}
                </button>
              </div>
            </div>
          </section>

          <!-- Right: IMastraEditor Live Agent Override Builder -->
          <section class="panel-card">
            <div class="panel-header">
              <div>
                <h2>Mastra Studio Agent Override Editor (`IMastraEditor`)</h2>
                <p class="panel-sub">Persist custom description & instructions to `/api/mastra/stored/agents` and apply via `editor.agent.applyStoredOverrides`.</p>
              </div>
            </div>

            <div class="form-stack">
              <div>
                <label class="field-label">Target Agent ID</label>
                <input :value="selected_agent_id" disabled class="input-text full-width" />
              </div>
              <div>
                <label class="field-label">Agent Description Override</label>
                <input v-model="override_form.description" class="input-text full-width" placeholder="Custom role description..." />
              </div>
              <div>
                <label class="field-label">System Instructions Override</label>
                <textarea v-model="override_form.instructions" rows="7" class="input-textarea" placeholder="Custom system prompt instructions..."></textarea>
              </div>
              <button class="btn btn-accent" :disabled="action_busy" @click="save_agent_override">
                💾 Save Stored Agent Override (`/api/mastra/stored/agents`)
              </button>
            </div>

            <div style="margin-top: 1.25rem;">
              <h3 class="sub-heading">Registered Governance Skills (`HarnessSkills.js`)</h3>
              <div class="skills-grid">
                <div v-for="sk in dashboard.skills" :key="sk.name" class="skill-card">
                  <div class="skill-name">{{ sk.name }}</div>
                  <div class="skill-desc">{{ sk.description }}</div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      <!-- VIEW 4: MASTRA WORKFLOWS & DYNAMIC WORKFLOW BUILDER -->
      <main v-else-if="active_nav === 'workflows'" class="workspace-scroll">
        <div class="two-col-grid">
          <!-- Left: Registered Mastra Workflow Runner -->
          <section class="panel-card">
            <div class="panel-header">
              <div>
                <h2>Mastra v1 Workflow Runner (`harness.execute_workflow`)</h2>
                <p class="panel-sub">Execute any of the 14 compiled role workflows or registered dynamic workflows with live JSON inputs.</p>
              </div>
            </div>

            <div class="form-stack">
              <div>
                <label class="field-label">Select Registered Mastra Workflow ({{ dashboard.workflows?.length || 0 }})</label>
                <select v-model="selected_workflow_id" class="input-select full-width">
                  <option v-for="wf in dashboard.workflows" :key="wf.name || wf.id || wf" :value="wf.name || wf.id || wf">
                    {{ wf.name || wf.id || wf }}
                  </option>
                </select>
              </div>
              <div>
                <label class="field-label">Workflow Input Context (JSON)</label>
                <textarea v-model="workflow_input_json" rows="7" class="input-textarea mono"></textarea>
              </div>
              <button class="btn btn-primary" :disabled="action_busy" @click="run_selected_workflow">
                ▶ Execute Workflow (`{{ selected_workflow_id }}`)
              </button>
            </div>

            <div v-if="workflow_output" class="code-output-box" style="margin-top: 1rem;">
              <div class="code-box-header">
                <span>Workflow Execution Output (`{{ workflow_output.workflow_id }}`)</span>
                <span class="badge-status ok">{{ workflow_output.execution?.status || 'completed' }}</span>
              </div>
              <pre>{{ JSON.stringify(workflow_output.execution, null, 2) }}</pre>
            </div>
          </section>

          <!-- Right: Declarative Dynamic Workflow Builder -->
          <section class="panel-card">
            <div class="panel-header">
              <div>
                <h2>Declarative Workflow Builder (`@mastra/core/workflows/builder`)</h2>
                <p class="panel-sub">Compose, normalize, preflight-check, and register dynamic workflows (`mastra.addDynamicWorkflow`).</p>
              </div>
            </div>

            <div class="form-stack">
              <div>
                <label class="field-label">Load Built-in Dynamic Workflow Template (14 Templates)</label>
                <select v-model="selected_dynamic_template_key" class="input-select full-width">
                  <option v-for="(tpl, key) in dashboard.dynamic_templates" :key="key" :value="key">
                    {{ key }} — {{ tpl.description?.slice(0, 55) }}
                  </option>
                </select>
              </div>
              <div>
                <label class="field-label">WorkflowBuilderDefinition JSON (`graph`, `inputSchema`, `outputSchema`)</label>
                <textarea v-model="dynamic_workflow_json" rows="12" class="input-textarea mono"></textarea>
              </div>
              <button class="btn btn-accent" :disabled="action_busy" @click="register_and_run_dynamic_workflow">
                ⚡ Normalize, Preflight & Register Dynamic Workflow
              </button>
            </div>
          </section>
        </div>
      </main>

      <!-- VIEW 5: 3-LEVEL SDLC PROCESS ARCHITECTURE STUDIO -->
      <main v-else-if="active_nav === 'architecture'" class="workspace-scroll">
        <section class="panel-card">
          <div class="panel-header">
            <div>
              <h2>3-Level SDLC Process Architecture Studio (`SdlcProcessArchitecture.js`)</h2>
              <p class="panel-sub">Manipulate Level 1 Building Blocks, Level 2 DAG Process Definitions, and Level 3 Project Overrides.</p>
            </div>
            <div class="tab-pills">
              <button :class="['pill-tab', { active: arch_level_tab === 'level1' }]" @click="arch_level_tab = 'level1'">
                Level 1: Process Objects ({{ dashboard.architecture?.objects?.phases?.length || 10 }} Phases / {{ dashboard.architecture?.objects?.gates?.length || 5 }} Gates)
              </button>
              <button :class="['pill-tab', { active: arch_level_tab === 'level2' }]" @click="arch_level_tab = 'level2'">
                Level 2: Process Definitions ({{ dashboard.architecture?.definitions?.length || 25 }} DAGs)
              </button>
              <button :class="['pill-tab', { active: arch_level_tab === 'level3' }]" @click="arch_level_tab = 'level3'">
                Level 3: Project SDLC Config
              </button>
            </div>
          </div>

          <!-- LEVEL 1: PROCESS OBJECTS -->
          <div v-if="arch_level_tab === 'level1'" class="two-col-grid">
            <div>
              <h3 class="sub-heading">Registered Phases ({{ dashboard.architecture?.objects?.phases?.length || 0 }})</h3>
              <div class="compact-list">
                <div v-for="p in dashboard.architecture?.objects?.phases" :key="p.id" class="compact-item">
                  <div>
                    <strong>{{ p.id }}</strong> — {{ p.name }}
                    <div class="muted-xs">{{ p.description }}</div>
                  </div>
                  <span v-if="p.gate" class="gate-pill">{{ p.gate }}</span>
                </div>
              </div>

              <div class="form-card" style="margin-top: 1rem;">
                <h4>+ Register Custom Phase Object</h4>
                <div class="form-row-2">
                  <input v-model="new_phase_form.id" class="input-text" placeholder="phase id (e.g. compliance_audit)" />
                  <input v-model="new_phase_form.name" class="input-text" placeholder="phase name" />
                </div>
                <input v-model="new_phase_form.description" class="input-text full-width" style="margin-top:0.5rem;" placeholder="description" />
                <button
                  class="btn btn-primary btn-sm"
                  style="margin-top: 0.5rem;"
                  @click="mutate_architecture({ action: 'register_phase', phase: new_phase_form })"
                >
                  + Register Phase
                </button>
              </div>
            </div>

            <div>
              <h3 class="sub-heading">Registered Review Gates ({{ dashboard.architecture?.objects?.gates?.length || 0 }})</h3>
              <div class="compact-list">
                <div v-for="g in dashboard.architecture?.objects?.gates" :key="g.id" class="compact-item">
                  <div>
                    <strong>{{ g.id }}</strong> — {{ g.name }}
                    <div class="muted-xs">{{ g.description }}</div>
                  </div>
                </div>
              </div>

              <div class="form-card" style="margin-top: 1rem;">
                <h4>+ Register Custom Review Gate Object</h4>
                <div class="form-row-2">
                  <input v-model="new_gate_form.id" class="input-text" placeholder="gate id (e.g. gate_compliance)" />
                  <input v-model="new_gate_form.name" class="input-text" placeholder="gate name" />
                </div>
                <input v-model="new_gate_form.description" class="input-text full-width" style="margin-top:0.5rem;" placeholder="description" />
                <button
                  class="btn btn-primary btn-sm"
                  style="margin-top: 0.5rem;"
                  @click="mutate_architecture({
                    action: 'register_gate',
                    gate: {
                      id: new_gate_form.id,
                      name: new_gate_form.name,
                      description: new_gate_form.description,
                      invariants: new_gate_form.invariants.split(',').map((s) => s.trim()).filter(Boolean)
                    }
                  })"
                >
                  + Register Gate
                </button>
              </div>
            </div>
          </div>

          <!-- LEVEL 2: PROCESS DEFINITIONS -->
          <div v-else-if="arch_level_tab === 'level2'" class="two-col-grid">
            <div>
              <label class="field-label">Select SDLC Process Definition ({{ dashboard.architecture?.definitions?.length || 0 }})</label>
              <select v-model="selected_process_id" class="input-select full-width">
                <option v-for="def in dashboard.architecture?.definitions" :key="def.id" :value="def.id">
                  [{{ def.domain }}] {{ def.id }} — {{ def.title }} ({{ def.stages?.length || 0 }} stages)
                </option>
              </select>

              <div v-if="selected_process_profile" class="stage-dag-list" style="margin-top: 1rem;">
                <div v-for="(st, idx) in selected_process_profile.stages" :key="st.suffix" class="stage-dag-item">
                  <div class="stage-dag-left">
                    <span class="stage-num">{{ idx + 1 }}</span>
                    <div>
                      <div class="stage-title">
                        <strong>{{ st.title }}</strong>
                        <code class="code-badge">{{ st.suffix }}</code>
                      </div>
                      <div class="muted-xs">
                        Role: <strong>{{ st.role }}</strong> · Workflow: <code>{{ st.workflow_id }}</code> · Phase: <code>{{ st.phase }}</code>
                      </div>
                      <div v-if="st.depends_on?.length" class="muted-xs">
                        Depends on: {{ st.depends_on.join(', ') }}
                      </div>
                    </div>
                  </div>
                  <button
                    class="btn btn-secondary btn-xs"
                    @click="mutate_architecture({ action: 'remove_stage', process_id: selected_process_profile.id, suffix: st.suffix })"
                  >
                    Remove Stage
                  </button>
                </div>
              </div>
            </div>

            <div class="form-stack">
              <div class="form-card">
                <h4>Clone Process Definition (`registry.clone_definition`)</h4>
                <div class="form-row-2">
                  <input v-model="clone_process_form.new_id" class="input-text" placeholder="new process id" />
                  <input v-model="clone_process_form.title" class="input-text" placeholder="new title" />
                </div>
                <button
                  class="btn btn-accent btn-sm"
                  style="margin-top: 0.5rem;"
                  @click="mutate_architecture({
                    action: 'clone_process',
                    source_id: selected_process_id,
                    new_id: clone_process_form.new_id,
                    overrides: { title: clone_process_form.title }
                  })"
                >
                  ⧉ Clone '{{ selected_process_id }}' → '{{ clone_process_form.new_id }}'
                </button>
              </div>

              <div class="form-card">
                <h4>Insert Stage into '{{ selected_process_id }}' (`def.insert_stage_after`)</h4>
                <div class="form-row-2">
                  <div>
                    <label class="field-label">Insert After Stage Suffix</label>
                    <input v-model="insert_stage_form.after_suffix" class="input-text full-width" />
                  </div>
                  <div>
                    <label class="field-label">New Stage Suffix</label>
                    <input v-model="insert_stage_form.suffix" class="input-text full-width" />
                  </div>
                </div>
                <div class="form-row-2" style="margin-top: 0.5rem;">
                  <div>
                    <label class="field-label">Stage Title</label>
                    <input v-model="insert_stage_form.title" class="input-text full-width" />
                  </div>
                  <div>
                    <label class="field-label">Assigned Specialist Role</label>
                    <select v-model="insert_stage_form.role" class="input-select full-width">
                      <option v-for="ag in dashboard.agents" :key="ag.id" :value="ag.id">{{ ag.id }}</option>
                    </select>
                  </div>
                </div>
                <button
                  class="btn btn-primary btn-sm"
                  style="margin-top: 0.5rem;"
                  @click="mutate_architecture({
                    action: 'insert_stage',
                    process_id: selected_process_id,
                    after_suffix: insert_stage_form.after_suffix,
                    stage: {
                      suffix: insert_stage_form.suffix,
                      title: insert_stage_form.title,
                      role: insert_stage_form.role,
                      workflow_id: insert_stage_form.workflow_id,
                      phase: insert_stage_form.phase
                    }
                  })"
                >
                  + Insert Stage into DAG
                </button>
              </div>
            </div>
          </div>

          <!-- LEVEL 3: PROJECT SDLC CONFIG -->
          <div v-else class="two-col-grid">
            <div>
              <h3 class="sub-heading">Project Gate Policies (`project_sdlc_config.gate_policies`)</h3>
              <div class="compact-list">
                <div
                  v-for="(pol, gate_id) in (dashboard.architecture?.project_config?.gate_policies || {})"
                  :key="gate_id"
                  class="compact-item"
                >
                  <div>
                    <strong>{{ gate_id }}</strong>
                    <div class="muted-xs">Enabled: {{ pol.enabled }} · Auto-Advance: {{ pol.auto_advance }}</div>
                  </div>
                  <button
                    class="btn btn-secondary btn-xs"
                    @click="mutate_architecture({
                      action: 'set_gate_policy',
                      gate_id,
                      policy: { enabled: !pol.enabled, auto_advance: pol.auto_advance }
                    })"
                  >
                    Toggle ({{ pol.enabled ? 'Enabled' : 'Disabled' }})
                  </button>
                </div>
              </div>
            </div>
            <div class="code-output-box">
              <div class="code-box-header">Live Level 3 Project Configuration Snapshot</div>
              <pre>{{ JSON.stringify(dashboard.architecture?.project_config, null, 2) }}</pre>
            </div>
          </div>
        </section>
      </main>

      <!-- VIEW 6: DOCUMENT ENTITY STORE & HYBRID RAG -->
      <main v-else-if="active_nav === 'store'" class="workspace-scroll">
        <div class="two-col-grid">
          <!-- Left: Clean-Room Entity Explorer & Hybrid RAG -->
          <section class="panel-card">
            <div class="panel-header">
              <div>
                <h2>Tier 1 Document Entity Store & Hybrid RAG Search</h2>
                <p class="panel-sub">Explore validated `.sdlc/store/` entities and run structure-aware BM25 + 64-dim vector RRF search.</p>
              </div>
              <div style="display: flex; gap: 0.5rem; align-items: center;">
                <select v-model="sync_direction" class="input-select">
                  <option value="bidirectional">⇄ Bidirectional (docs/ ↔ .sdlc/store/)</option>
                  <option value="import">📥 Import Only (docs/ → .sdlc/store/)</option>
                  <option value="export">📤 Export Only (.sdlc/store/ → docs/)</option>
                </select>
                <button class="btn btn-accent btn-sm" :disabled="action_busy" @click="sync_doc_stores">
                  ⇄ Sync Stores (`doc-store-sync-lifecycle`)
                </button>
              </div>
            </div>

            <!-- Statechart Sync Receipt Banner -->
            <div v-if="sync_receipt" class="code-output-box" style="margin-bottom: 0.85rem;">
              <div class="code-box-header">
                Statechart `{{ sync_receipt.statechart_id }}` → `{{ sync_receipt.final_state }}`
                (Imported: {{ sync_receipt.migrated_count }} · Exported: {{ sync_receipt.exported_count }} · RAG Chunks: {{ sync_receipt.indexed_chunks }} · Knowledge Nodes: {{ sync_receipt.knowledge_synced }})
              </div>
              <div class="muted-xs" style="padding: 0.45rem 0.75rem; font-family: monospace;">
                <span v-for="(step, idx) in (sync_receipt.transitions || [])" :key="idx">
                  {{ step.from }} --[{{ step.event }}]--> <strong>{{ step.to }}</strong><span v-if="idx < sync_receipt.transitions.length - 1">  ➔  </span>
                </span>
              </div>
            </div>

            <!-- Hybrid RAG Search -->
            <div class="rag-search-bar">
              <input
                v-model="rag_query"
                class="input-text"
                style="flex: 1;"
                placeholder="Search PRDs, ADRs, user stories, threat models via Hybrid RAG..."
                @keydown.enter="run_rag_search"
              />
              <button class="btn btn-primary" :disabled="action_busy" @click="run_rag_search">
                🔍 Hybrid RAG Search
              </button>
            </div>

            <div v-if="rag_hits.length" class="rag-hits-box">
              <div v-for="hit in rag_hits" :key="hit.id" class="rag-hit-row" @click="select_store_entity(hit.type, hit.doc_id)">
                <div class="rag-hit-top">
                  <strong>{{ hit.title || hit.doc_id }}</strong>
                  <span class="tag-chip">{{ hit.type }}</span>
                  <span class="score-pill">RRF: {{ hit.rrf_score }} (BM25: {{ hit.bm25_score }} | Vec: {{ hit.vector_score }})</span>
                </div>
                <div class="muted-xs">{{ hit.text?.slice(0, 160) }}...</div>
              </div>
            </div>

            <!-- Entity Type Filter Pills -->
            <div class="entity-type-pills" style="margin-top: 1rem;">
              <button
                v-for="(count, type) in (dashboard.store?.counts || {})"
                :key="type"
                :class="['chip-btn', { active: selected_entity_type === type }]"
                @click="selected_entity_type = type; select_store_entity(type, dashboard.store?.entities?.[type]?.[0]?.id || '')"
              >
                {{ type }} ({{ count }})
              </button>
            </div>

            <div class="compact-list" style="margin-top: 0.75rem;">
              <div
                v-for="ent in (dashboard.store?.entities?.[selected_entity_type] || [])"
                :key="ent.id"
                :class="['compact-item clickable', { selected: selected_entity_id === ent.id }]"
                @click="select_store_entity(selected_entity_type, ent.id)"
              >
                <div>
                  <strong>{{ ent.id }}</strong> — {{ ent.title || ent.component || ent.slug || ent.id }}
                  <div class="muted-xs">Status: {{ ent.status || 'verified' }} · Linked PRD: {{ ent.linked_prd_id || 'root' }}</div>
                </div>
                <span class="tag-chip">Inspect →</span>
              </div>
              <div v-if="!(dashboard.store?.entities?.[selected_entity_type]?.length)" class="kanban-empty">
                No stored entities of type '{{ selected_entity_type }}' yet. Launch an SDLC process to populate!
              </div>
            </div>
          </section>

          <!-- Right: Rendered Markdown & Validated JSON Preview -->
          <section class="panel-card">
            <div class="panel-header">
              <div>
                <h2>Document Builder Markdown & Entity Schema Inspector</h2>
                <p class="panel-sub">
                  {{ selected_entity_id ? `Viewing ${selected_entity_type} / ${selected_entity_id}` : 'Select an entity on the left' }}
                </p>
              </div>
            </div>

            <div v-if="selected_document_preview.entity">
              <div class="code-output-box">
                <div class="code-box-header">Compiled Markdown (`store.generate_document`)</div>
                <pre>{{ selected_document_preview.markdown }}</pre>
              </div>
              <div class="code-output-box" style="margin-top: 0.75rem;">
                <div class="code-box-header">Validated Zod Entity JSON</div>
                <pre>{{ JSON.stringify(selected_document_preview.entity, null, 2) }}</pre>
              </div>
            </div>
            <div v-else class="kanban-empty" style="padding: 3rem;">
              Select any stored entity or RAG search hit to inspect its compiled Markdown and Zod schema payload.
            </div>
          </section>
        </div>
      </main>

      <!-- VIEW 7: EMBEDDED MASTRA STUDIO SPA -->
      <main v-else-if="active_nav === 'studio_spa'" class="iframe-container">
        <div class="iframe-bar">
          <span>Native Mastra Studio SPA (`/_studio`) connected to `/api/mastra`</span>
          <a href="/_studio" target="_blank" class="btn btn-secondary btn-xs">↗ Open `/_studio` in New Tab</a>
        </div>
        <iframe src="/_studio" class="studio-iframe" title="Mastra Studio"></iframe>
      </main>

      <!-- VIEW 8: EMBEDDED MASTRA FACTORY SPA -->
      <main v-else-if="active_nav === 'factory_spa'" class="iframe-container">
        <div class="iframe-bar">
          <span>Native Mastra Software Factory SPA (`/_factory/factories`) connected to `/web/factory/*`</span>
          <a href="/_factory/factories" target="_blank" class="btn btn-secondary btn-xs">↗ Open `/_factory` in New Tab</a>
        </div>
        <iframe src="/_factory/factories" class="studio-iframe" title="Mastra Software Factory"></iframe>
      </main>
    </div>

    <!-- MODAL: LAUNCH SDLC PROCESS / WORK ITEM -->
    <div v-if="show_launch_modal" class="modal-backdrop" @click.self="show_launch_modal = false">
      <div class="modal-dialog">
        <div class="panel-header">
          <div>
            <h2>Launch Governed SDLC Process / Work Item</h2>
            <p class="panel-sub">Dispatches tickets onto the WorkBoard and routes execution through the WorkerPoolDaemon.</p>
          </div>
          <button class="toast-close" @click="show_launch_modal = false">×</button>
        </div>

        <div class="form-stack">
          <div>
            <label class="field-label">High-Level SDLC Process (25 Governed Profiles)</label>
            <select v-model="launch_form.process_type" class="input-select full-width">
              <option v-for="p in dashboard.processes" :key="p.id" :value="p.id">
                [{{ p.domain }}] {{ p.id }} — {{ p.title }} ({{ p.stages?.length || 0 }} stages)
              </option>
            </select>
          </div>
          <div>
            <label class="field-label">Feature / Epic / Defect Slug Name</label>
            <input v-model="launch_form.name" class="input-text full-width" placeholder="e.g. oauth-token-rotation" />
          </div>
          <div>
            <label class="field-label">Specification Brief & Acceptance Context</label>
            <textarea v-model="launch_form.description" rows="4" class="input-textarea"></textarea>
          </div>
          <div class="modal-actions">
            <button class="btn btn-secondary" @click="show_launch_modal = false">Cancel</button>
            <button class="btn btn-primary" :disabled="action_busy" @click="submit_governed_work">
              {{ action_busy ? 'Dispatching to Worker Pool...' : '🚀 Launch Process into Worker Pool' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sdlc-shell {
  display: flex;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  background: #090d16;
  color: #e2e8f0;
  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

/* Sidebar */
.sdlc-sidebar {
  width: 265px;
  min-width: 265px;
  background: #0f172a;
  border-right: 1px solid #1e293b;
  display: flex;
  flex-direction: column;
  padding: 1rem 0.75rem;
}

.brand-box {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.4rem 0.5rem 1rem;
  border-bottom: 1px solid #1e293b;
  margin-bottom: 1rem;
}

.brand-logo {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: linear-gradient(135deg, #2563eb, #7c3aed);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
}

.brand-title {
  font-weight: 700;
  font-size: 0.95rem;
  color: #f8fafc;
}

.brand-sub {
  font-size: 0.72rem;
  color: #94a3b8;
}

.nav-group-label {
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #64748b;
  padding: 0 0.5rem 0.4rem;
}

.side-nav {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  width: 100%;
  text-align: left;
  background: transparent;
  color: #cbd5e1;
  border: 1px solid transparent;
  padding: 0.55rem 0.65rem;
  border-radius: 7px;
  cursor: pointer;
  font-size: 0.84rem;
  transition: all 0.15s ease;
}

.nav-item:hover {
  background: #1e293b;
  color: #f8fafc;
}

.nav-item.active {
  background: rgba(37, 99, 235, 0.18);
  border-color: #3b82f6;
  color: #60a5fa;
  font-weight: 600;
}

.nav-icon {
  font-size: 0.95rem;
  width: 18px;
  text-align: center;
}

.nav-badge {
  margin-left: auto;
  background: #1e293b;
  color: #94a3b8;
  font-size: 0.7rem;
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
}

.sidebar-footer {
  margin-top: auto;
  padding: 0.75rem;
  background: #090d16;
  border: 1px solid #1e293b;
  border-radius: 8px;
  font-size: 0.75rem;
}

.sys-pill {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  color: #38bdf8;
  font-weight: 600;
  margin-bottom: 0.35rem;
}

.dot-online {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #10b981;
  box-shadow: 0 0 8px #10b981;
}

.sys-meta {
  color: #94a3b8;
  margin-top: 0.2rem;
}

/* Main Content */
.sdlc-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sdlc-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1.25rem;
  background: #0f172a;
  border-bottom: 1px solid #1e293b;
}

.topbar-left,
.topbar-right {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.status-chip {
  font-size: 0.76rem;
  padding: 0.25rem 0.65rem;
  border-radius: 999px;
  font-weight: 600;
  border: 1px solid #334155;
}

.state-chip {
  background: rgba(16, 185, 129, 0.12);
  color: #34d399;
  border-color: rgba(16, 185, 129, 0.35);
}

.phase-chip {
  background: rgba(59, 130, 246, 0.14);
  color: #60a5fa;
  border-color: rgba(59, 130, 246, 0.35);
}

.item-chip {
  background: rgba(168, 85, 247, 0.14);
  color: #c084fc;
  border-color: rgba(168, 85, 247, 0.35);
}

.workspace-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

/* KPI Grid */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0.9rem;
}

.kpi-card {
  background: #0f172a;
  border: 1px solid #1e293b;
  border-radius: 10px;
  padding: 1rem;
}

.kpi-label {
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: #64748b;
}

.kpi-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: #f8fafc;
  margin: 0.35rem 0 0.2rem;
}

.kpi-sub {
  font-size: 0.75rem;
  color: #94a3b8;
}

/* Panels */
.panel-card {
  background: #0f172a;
  border: 1px solid #1e293b;
  border-radius: 10px;
  padding: 1.15rem;
}

.panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid #1e293b;
}

.panel-header h2 {
  margin: 0;
  font-size: 1rem;
  color: #f8fafc;
}

.panel-sub {
  margin: 0.25rem 0 0;
  font-size: 0.78rem;
  color: #94a3b8;
}

.panel-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

/* 10-Phase Pipeline */
.phase-pipeline {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 0.65rem;
}

.phase-step {
  background: #090d16;
  border: 1px solid #1e293b;
  border-radius: 8px;
  padding: 0.75rem;
  transition: all 0.15s ease;
}

.phase-step.active {
  border-color: #3b82f6;
  background: rgba(37, 99, 235, 0.12);
  box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.4);
}

.phase-step.completed {
  border-color: rgba(16, 185, 129, 0.4);
}

.phase-step-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.35rem;
}

.phase-index {
  font-size: 0.72rem;
  font-weight: 700;
  color: #60a5fa;
}

.gate-pill {
  font-size: 0.65rem;
  background: rgba(245, 158, 11, 0.15);
  color: #fbbf24;
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
}

.phase-name {
  font-weight: 700;
  font-size: 0.85rem;
  color: #f8fafc;
  text-transform: capitalize;
}

.phase-desc {
  font-size: 0.72rem;
  color: #94a3b8;
  margin-top: 0.25rem;
  line-height: 1.35;
}

/* Two Column Grid */
.two-col-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.15rem;
}

@media (max-width: 1100px) {
  .two-col-grid {
    grid-template-columns: 1fr;
  }
}

/* Gates & Workers */
.gate-list,
.worker-role-table,
.work-item-list {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.gate-row,
.worker-role-row,
.work-item-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  background: #090d16;
  border: 1px solid #1e293b;
  border-radius: 8px;
  padding: 0.7rem 0.85rem;
}

.work-item-row.focused {
  border-color: #a855f7;
}

.gate-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
}

.gate-desc {
  font-size: 0.75rem;
  color: #94a3b8;
  margin-top: 0.2rem;
}

.gate-criteria {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.35rem;
}

.worker-role-name {
  font-weight: 600;
  font-size: 0.85rem;
  color: #f8fafc;
}

.worker-role-sub {
  font-size: 0.72rem;
  color: #94a3b8;
}

.worker-scale-controls {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.worker-count-badge {
  min-width: 26px;
  text-align: center;
  font-weight: 700;
  color: #38bdf8;
}

/* Kanban Board */
.kanban-board {
  display: grid;
  grid-template-columns: repeat(7, minmax(210px, 1fr));
  gap: 0.75rem;
  overflow-x: auto;
  padding-bottom: 0.5rem;
}

.kanban-col {
  background: #090d16;
  border: 1px solid #1e293b;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  min-height: 430px;
}

.kanban-col-header {
  padding: 0.65rem 0.75rem;
  border-top: 3px solid #3b82f6;
  border-bottom: 1px solid #1e293b;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.78rem;
  font-weight: 700;
}

.kanban-count {
  background: #1e293b;
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
  font-size: 0.7rem;
}

.kanban-cards {
  padding: 0.6rem;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.kanban-card {
  background: #0f172a;
  border: 1px solid #1e293b;
  border-radius: 7px;
  padding: 0.65rem;
  cursor: pointer;
  transition: border-color 0.15s;
}

.kanban-card:hover {
  border-color: #3b82f6;
}

.kanban-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.35rem;
}

.ticket-id {
  font-size: 0.7rem;
  color: #93c5fd;
}

.role-pill {
  font-size: 0.65rem;
  background: #1e293b;
  color: #cbd5e1;
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
}

.kanban-card-title {
  font-size: 0.8rem;
  font-weight: 600;
  color: #f8fafc;
  margin-bottom: 0.35rem;
}

.kanban-card-meta {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  font-size: 0.7rem;
  color: #94a3b8;
}

.kanban-deps {
  margin-top: 0.35rem;
  font-size: 0.68rem;
  color: #64748b;
}

.kanban-alert {
  margin-top: 0.4rem;
  padding: 0.25rem 0.4rem;
  background: rgba(236, 72, 153, 0.15);
  color: #f472b6;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 600;
}

.kanban-empty {
  color: #64748b;
  font-size: 0.76rem;
  text-align: center;
  padding: 1.5rem 0.5rem;
}

/* Chat Playground */
.chat-transcript {
  margin-top: 0.85rem;
  background: #090d16;
  border: 1px solid #1e293b;
  border-radius: 8px;
  padding: 0.85rem;
  height: 320px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.chat-bubble {
  padding: 0.65rem 0.8rem;
  border-radius: 8px;
  border: 1px solid #1e293b;
}

.chat-user {
  background: rgba(37, 99, 235, 0.14);
  border-color: rgba(59, 130, 246, 0.35);
  align-self: flex-end;
  max-width: 88%;
}

.chat-assistant,
.chat-system {
  background: #0f172a;
  max-width: 94%;
}

.chat-bubble-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.72rem;
  color: #94a3b8;
  margin-bottom: 0.3rem;
}

.chat-bubble-text {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
  font-size: 0.82rem;
  line-height: 1.45;
  color: #f1f5f9;
}

.chat-composer {
  margin-top: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.chat-composer-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.quick-prompts {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}

/* Forms & Buttons */
.form-stack {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.form-row-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.65rem;
}

.field-label {
  display: block;
  font-size: 0.74rem;
  font-weight: 600;
  color: #94a3b8;
  margin-bottom: 0.3rem;
}

.input-text,
.input-select,
.input-textarea {
  background: #090d16;
  color: #f8fafc;
  border: 1px solid #334155;
  border-radius: 6px;
  padding: 0.5rem 0.65rem;
  font-size: 0.82rem;
}

.input-textarea.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.76rem;
}

.full-width {
  width: 100%;
  box-sizing: border-box;
}

.btn {
  border: 1px solid transparent;
  border-radius: 6px;
  padding: 0.48rem 0.85rem;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: #2563eb;
  color: #ffffff;
}

.btn-primary:hover:not(:disabled) {
  background: #1d4ed8;
}

.btn-secondary {
  background: #1e293b;
  color: #e2e8f0;
  border-color: #334155;
}

.btn-secondary:hover:not(:disabled) {
  background: #334155;
}

.btn-accent {
  background: #7c3aed;
  color: #ffffff;
}

.btn-accent:hover:not(:disabled) {
  background: #6d28d9;
}

.btn-sm {
  padding: 0.35rem 0.65rem;
  font-size: 0.75rem;
}

.btn-xs {
  padding: 0.22rem 0.5rem;
  font-size: 0.7rem;
}

.btn-icon {
  width: 26px;
  height: 26px;
  border-radius: 5px;
  border: 1px solid #334155;
  background: #1e293b;
  color: #f8fafc;
  cursor: pointer;
  font-weight: 700;
}

.chip-btn {
  background: #1e293b;
  color: #cbd5e1;
  border: 1px solid #334155;
  border-radius: 999px;
  padding: 0.25rem 0.65rem;
  font-size: 0.72rem;
  cursor: pointer;
}

.chip-btn.active,
.chip-btn:hover {
  background: #2563eb;
  color: #ffffff;
  border-color: #3b82f6;
}

/* Code & Output Boxes */
.code-output-box {
  background: #090d16;
  border: 1px solid #1e293b;
  border-radius: 8px;
  overflow: hidden;
}

.code-box-header {
  background: #1e293b;
  padding: 0.45rem 0.75rem;
  font-size: 0.74rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.code-output-box pre {
  margin: 0;
  padding: 0.75rem;
  font-size: 0.75rem;
  max-height: 340px;
  overflow: auto;
  color: #cbd5e1;
}

.tag-chip,
.code-badge {
  font-size: 0.68rem;
  background: #1e293b;
  color: #93c5fd;
  padding: 0.12rem 0.45rem;
  border-radius: 4px;
}

/* Architecture & Store Lists */
.compact-list,
.stage-dag-list {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  max-height: 380px;
  overflow-y: auto;
}

.compact-item,
.stage-dag-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  background: #090d16;
  border: 1px solid #1e293b;
  border-radius: 7px;
  padding: 0.6rem 0.75rem;
  font-size: 0.8rem;
}

.compact-item.clickable {
  cursor: pointer;
}

.compact-item.selected {
  border-color: #3b82f6;
  background: rgba(37, 99, 235, 0.12);
}

.stage-dag-left {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.stage-num {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #1e293b;
  color: #60a5fa;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.72rem;
  font-weight: 700;
}

.muted-xs {
  font-size: 0.72rem;
  color: #94a3b8;
  margin-top: 0.15rem;
}

.form-card {
  background: #090d16;
  border: 1px solid #1e293b;
  border-radius: 8px;
  padding: 0.85rem;
}

.form-card h4 {
  margin: 0 0 0.6rem;
  font-size: 0.84rem;
  color: #f8fafc;
}

.tab-pills,
.entity-type-pills {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.pill-tab {
  background: #090d16;
  color: #94a3b8;
  border: 1px solid #334155;
  padding: 0.4rem 0.75rem;
  border-radius: 6px;
  font-size: 0.76rem;
  cursor: pointer;
}

.pill-tab.active {
  background: #2563eb;
  color: #ffffff;
  border-color: #3b82f6;
}

.rag-search-bar {
  display: flex;
  gap: 0.5rem;
}

.rag-hits-box {
  margin-top: 0.65rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.rag-hit-row {
  background: rgba(37, 99, 235, 0.08);
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 6px;
  padding: 0.5rem 0.65rem;
  cursor: pointer;
}

.rag-hit-top {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.78rem;
}

.score-pill {
  margin-left: auto;
  font-size: 0.68rem;
  color: #34d399;
}

.skills-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}

.skill-card {
  background: #090d16;
  border: 1px solid #1e293b;
  border-radius: 6px;
  padding: 0.55rem;
}

.skill-name {
  font-weight: 600;
  font-size: 0.76rem;
  color: #60a5fa;
}

.skill-desc {
  font-size: 0.68rem;
  color: #94a3b8;
  margin-top: 0.2rem;
}

/* Embedded Iframes */
.iframe-container {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.iframe-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.45rem 1rem;
  background: #090d16;
  border-bottom: 1px solid #1e293b;
  font-size: 0.76rem;
  color: #94a3b8;
}

.studio-iframe {
  flex: 1;
  width: 100%;
  border: 0;
  background: #090d16;
}

/* Modal & Toast */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.modal-dialog {
  width: 560px;
  max-width: 92vw;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 12px;
  padding: 1.25rem;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.6rem;
  margin-top: 0.5rem;
}

.toast-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.55rem 1.25rem;
  font-size: 0.8rem;
  font-weight: 600;
}

.toast-info {
  background: #1e3a8a;
  color: #bfdbfe;
}

.toast-success {
  background: #065f46;
  color: #a7f3d0;
}

.toast-error {
  background: #7f1d1d;
  color: #fecaca;
}

.toast-close {
  background: transparent;
  border: 0;
  color: inherit;
  font-size: 1.1rem;
  cursor: pointer;
}
</style>
