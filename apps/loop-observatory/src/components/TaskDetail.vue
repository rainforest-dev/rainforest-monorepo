<script setup lang="ts">
import {
  AlertTriangle,
  Bot,
  Check,
  Circle,
  Cpu,
  ExternalLink,
  FileText,
  Hand,
  Loader2,
  Save,
  ShieldCheck,
  X,
} from '@lucide/vue';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { SprintTask } from '@/lib/tasks';
import type { ExecutionPlan, PlanCandidate } from '@/lib/taskPlan';
import {
  effectiveStatus,
  ownerMeta,
  priorityColor,
  scopeBadge,
  statusColor,
  taskOwner,
} from '@/lib/taskStatus';

const props = defineProps<{ task: SprintTask | null; open: boolean; statuses: string[] }>();
const emit = defineEmits<{ close: [] }>();

// The column the loop moved the task to (or the Notion status when untouched).
// The Status row leads with this so it never contradicts the ◆ Loop row below;
// the raw Notion status is shown as a muted secondary when the loop is ahead.
const effStatus = computed(() =>
  props.task ? effectiveStatus(props.task.status, props.task.loopStatus, props.statuses) : '',
);

// Whose turn this task is on — the small owner marker in the Status row.
const owner = computed(() =>
  props.task ? ownerMeta(taskOwner(props.task.status, props.task.loopStatus)) : null,
);
const OWNER_ICON = { ai: Bot, you: Hand, done: Check, parked: Circle } as const;

interface NoteResponse {
  found: boolean;
  id: string;
  scope?: 'work' | 'personal';
  path?: string;
  name?: string;
  html?: string;
  feedback?: string;
  hasFeedback?: boolean;
  notionUrl?: string | null;
  error?: string;
}

const note = ref<NoteResponse | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);

// Editable tuning feedback (the note's `## Feedback` section).
const feedbackDraft = ref('');
const saving = ref(false);
const saved = ref(false);
const saveError = ref<string | null>(null);
const dirty = ref(false);

interface DecisionResponse {
  found: boolean;
  id: string;
  recommendation: 'greenlight' | 'plan-first';
  title: string;
  summary: string;
  reasons: string[];
  suggestedComment: string;
  project: string | null;
  executorReady: boolean;
  deliveryMode: 'local' | 'remote-queue' | 'none';
  outboxState: 'none' | 'pending' | 'applied' | 'duplicate' | 'failed';
  greenlit: boolean;
  existing: { decision: 'greenlight' | 'plan-first'; comment: string; updatedAt: string | null } | null;
  executionPlan: ExecutionPlan | null;
}

const decision = ref<DecisionResponse | null>(null);
const decisionDraft = ref('');
const decisionLoading = ref(false);
const decisionSaving = ref(false);
const decisionError = ref<string | null>(null);
const decisionSaved = ref(false);
// Set when "Plan first" was recorded but the authorisation is already live on
// the remote executor. Recording the decision here cannot withdraw it — only
// that machine writes its own allowlist — so the drawer must not let "Decision
// saved." read as "revoked".
const revocationNote = ref<string | null>(null);

const greenlightLabel = computed(() =>
  decision.value?.deliveryMode === 'remote-queue' ? 'Greenlight → Air' : 'Greenlight',
);

const outboxMessage = computed(() => {
  switch (decision.value?.outboxState) {
    case 'pending':
      return 'Queued to Air — applies on its next pull (up to ~5 minutes).';
    case 'applied':
      return 'Applied on Air.';
    case 'duplicate':
      return 'Already on Air’s allowlist.';
    case 'failed':
      return 'Air rejected this request. Check the ack for the reason.';
    default:
      return null;
  }
});

interface PlanResponse {
  found: boolean;
  id: string;
  candidates: PlanCandidate[];
  saved: ExecutionPlan | null;
  error?: string;
}

const plan = ref<PlanResponse | null>(null);
const planLoading = ref(false);
const planSaving = ref(false);
const planError = ref<string | null>(null);
const planSaved = ref(false);
const selectedPlanId = ref('');

function planId(value: Pick<ExecutionPlan, 'provider' | 'model' | 'effort'>): string {
  return `${value.provider}:${value.model}:${value.effort}`;
}

const selectedPlan = computed<PlanCandidate | null>(() => {
  if (!plan.value) return null;
  return plan.value.candidates.find((candidate) => candidate.id === selectedPlanId.value) ?? null;
});

function formatTokens(value: number): string {
  return `${Math.round(value / 1000)}k`;
}

// Parse a JSON response defensively: an error status can come back with an
// empty body (e.g. a 500 from the node adapter), and `res.json()` on empty text
// throws a cryptic "Unexpected end of JSON input". Return null instead so
// callers can surface the real HTTP status.
async function readJson<T>(res: Response): Promise<T | null> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

async function fetchNote(id: string) {
  loading.value = true;
  error.value = null;
  saveError.value = null;
  saved.value = false;
  dirty.value = false;
  note.value = null;
  try {
    const res = await fetch(`/api/task-note?id=${encodeURIComponent(id)}`);
    const data = await readJson<NoteResponse>(res);
    if (!res.ok && res.status !== 404) {
      error.value = data?.error ?? `HTTP ${res.status}`;
    }
    if (data) {
      note.value = data;
      feedbackDraft.value = data.feedback ?? '';
    } else if (res.ok) {
      error.value = `HTTP ${res.status}: empty response`;
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

async function fetchDecision(id: string) {
  decisionLoading.value = true;
  decisionError.value = null;
  decisionSaved.value = false;
  revocationNote.value = null;
  decision.value = null;
  decisionDraft.value = '';
  try {
    const res = await fetch(`/api/task-decision?id=${encodeURIComponent(id)}`);
    const data = await readJson<DecisionResponse & { error?: string }>(res);
    if (!res.ok || !data) throw new Error(data?.error ?? `HTTP ${res.status}`);
    decision.value = data;
    decisionDraft.value = data.existing?.comment || data.suggestedComment;
  } catch (e) {
    decisionError.value = e instanceof Error ? e.message : String(e);
  } finally {
    decisionLoading.value = false;
  }
}

async function fetchPlan(id: string) {
  planLoading.value = true;
  planError.value = null;
  planSaved.value = false;
  plan.value = null;
  selectedPlanId.value = '';
  try {
    const res = await fetch(`/api/task-plan?id=${encodeURIComponent(id)}`);
    const data = await readJson<PlanResponse>(res);
    if (!res.ok || !data) throw new Error(data?.error ?? `HTTP ${res.status}`);
    plan.value = data;
    selectedPlanId.value = data.saved
      ? planId(data.saved)
      : data.candidates.find((candidate) => candidate.recommended)?.id ?? data.candidates[0]?.id ?? '';
  } catch (e) {
    planError.value = e instanceof Error ? e.message : String(e);
  } finally {
    planLoading.value = false;
  }
}

async function savePlan() {
  const id = props.task?.id;
  const candidate = selectedPlan.value;
  if (id == null || !candidate || planSaving.value) return;
  planSaving.value = true;
  planError.value = null;
  planSaved.value = false;
  try {
    const res = await fetch(`/api/task-plan?id=${encodeURIComponent(String(id))}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ plan: candidate }),
    });
    const data = await readJson<{ plan?: ExecutionPlan; error?: string }>(res);
    if (!res.ok || !data?.plan) throw new Error(data?.error ?? `HTTP ${res.status}`);
    if (plan.value) plan.value.saved = data.plan;
    selectedPlanId.value = planId(data.plan);
    planSaved.value = true;
    await fetchDecision(String(id));
  } catch (e) {
    planError.value = e instanceof Error ? e.message : String(e);
  } finally {
    planSaving.value = false;
  }
}

async function saveFeedback() {
  const id = props.task?.id;
  if (id == null || saving.value) return;
  saving.value = true;
  saveError.value = null;
  saved.value = false;
  try {
    const res = await fetch(`/api/task-feedback?id=${encodeURIComponent(String(id))}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ feedback: feedbackDraft.value }),
    });
    const data = await readJson<NoteResponse>(res);
    if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
    if (!data) throw new Error(`HTTP ${res.status}: empty response`);
    // Re-render the note view from the freshly written file.
    note.value = data;
    feedbackDraft.value = data.feedback ?? '';
    saved.value = true;
    dirty.value = false;
  } catch (e) {
    saveError.value = e instanceof Error ? e.message : String(e);
  } finally {
    saving.value = false;
  }
}

async function saveDecision(kind: 'greenlight' | 'plan-first') {
  const id = props.task?.id;
  if (id == null || decisionSaving.value) return;
  decisionSaving.value = true;
  decisionError.value = null;
  decisionSaved.value = false;
  revocationNote.value = null;
  try {
    const res = await fetch(`/api/task-decision?id=${encodeURIComponent(String(id))}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ decision: kind, comment: decisionDraft.value }),
    });
    const data = await readJson<{
      guidance?: DecisionResponse;
      revocationNote?: string | null;
      error?: string;
    }>(res);
    if (!res.ok || !data?.guidance) throw new Error(data?.error ?? `HTTP ${res.status}`);
    decision.value = data.guidance;
    decisionDraft.value = data.guidance.existing?.comment || data.guidance.suggestedComment;
    decisionSaved.value = true;
    revocationNote.value = data.revocationNote ?? null;
    // The greenlight file and note are server-side state; refresh the board so
    // the pending/owner indicators are not stale after the drawer action.
    window.dispatchEvent(new CustomEvent('lo:refresh'));
  } catch (e) {
    decisionError.value = e instanceof Error ? e.message : String(e);
  } finally {
    decisionSaving.value = false;
  }
}

function onFeedbackInput() {
  dirty.value = true;
  saved.value = false;
}

watch(
  () => [props.open, props.task?.id] as const,
  ([open, id]) => {
    if (open && id != null) {
      fetchNote(String(id));
      fetchDecision(String(id));
      fetchPlan(String(id));
    }
  },
  { immediate: true },
);

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close');
}
watch(
  () => props.open,
  (open) => {
    if (open) window.addEventListener('keydown', onKey);
    else window.removeEventListener('keydown', onKey);
  },
);
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));

// Teleport-to-body is a client-only concern (the drawer only ever opens from a
// user click, never on first paint). Rendering the <Teleport> during SSR emits
// teleport anchors that Vue then tries to hydrate against <body>'s real
// children — misaligning and clobbering the Layout's <header>. Gating the
// Teleport behind a mounted flag keeps SSR + initial client render identical (a
// bare comment placeholder), so hydration matches; the teleport then mounts
// purely client-side after mount.
const mounted = ref(false);
onMounted(() => {
  mounted.value = true;
});
</script>

<template>
  <Teleport v-if="mounted" to="body">
    <Transition name="drawer">
      <div v-if="open && task" class="fixed inset-0 z-50 flex justify-end">
        <!-- Overlay -->
        <div
          class="absolute inset-0 bg-black/40 backdrop-blur-sm"
          @click="emit('close')"
        />

        <!-- Panel -->
        <aside
          class="bg-card text-card-foreground border-border relative flex h-full w-full max-w-lg flex-col border-l shadow-xl"
          role="dialog"
          aria-modal="true"
          :aria-label="task.name"
        >
          <header class="border-border flex items-start gap-3 border-b px-5 py-4">
            <FileText class="text-muted-foreground mt-0.5 size-4 shrink-0" />
            <div class="min-w-0 flex-1">
              <p class="text-muted-foreground font-mono text-xs">
                #{{ task.id ?? '—' }}
              </p>
              <h2 class="text-foreground text-base font-semibold leading-snug">
                {{ task.name }}
              </h2>
            </div>
            <button
              type="button"
              class="text-muted-foreground hover:text-foreground hover:bg-muted/60 -mr-1 rounded-md p-1.5 transition-colors"
              aria-label="Close"
              @click="emit('close')"
            >
              <X class="size-4" />
            </button>
          </header>

          <!-- Metadata block -->
          <dl
            class="border-border grid grid-cols-2 gap-x-4 gap-y-2.5 border-b px-5 py-4 text-sm"
          >
            <div class="flex items-center gap-2">
              <dt class="text-muted-foreground text-xs">Status</dt>
              <dd class="flex items-center gap-1.5">
                <span
                  class="inline-block size-2 rounded-full"
                  :style="{ backgroundColor: statusColor(effStatus) }"
                  aria-hidden="true"
                />
                <span class="text-foreground">{{ effStatus }}</span>
                <!-- Notion is deliberately behind (loop stays vault-local until
                     `tune`); show it muted so the two never read as a conflict. -->
                <span
                  v-if="effStatus !== task.status"
                  class="text-muted-foreground/70 text-xs"
                  title="Notion board status — the loop is ahead until you tune"
                >
                  · Notion: {{ task.status }}
                </span>
                <span
                  v-if="owner"
                  class="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium"
                  :style="{ color: owner.color }"
                  :title="`Owner: ${owner.label}`"
                >
                  <component :is="OWNER_ICON[owner.key]" class="size-3" aria-hidden="true" />
                  {{ owner.key === 'you' ? 'Your action' : owner.label }}
                </span>
              </dd>
            </div>
            <div class="flex items-center gap-2">
              <dt class="text-muted-foreground text-xs">Scope</dt>
              <dd>
                <span
                  class="rounded px-1.5 py-0.5 text-[10px] font-medium"
                  :style="{
                    color: scopeBadge(task.scope).color,
                    backgroundColor: scopeBadge(task.scope).bg,
                  }"
                >
                  {{ scopeBadge(task.scope).label }}
                </span>
              </dd>
            </div>
            <div v-if="task.priority" class="flex items-center gap-2">
              <dt class="text-muted-foreground text-xs">Priority</dt>
              <dd
                class="font-semibold"
                :style="{ color: priorityColor(task.priority) ?? undefined }"
              >
                {{ task.priority }}
              </dd>
            </div>
            <div class="flex items-center gap-2">
              <dt class="text-muted-foreground text-xs">Points</dt>
              <dd class="text-foreground tabular-nums">{{ task.points ?? '—' }}</dd>
            </div>
            <div v-if="task.component" class="flex items-center gap-2">
              <dt class="text-muted-foreground text-xs">Component</dt>
              <dd class="text-foreground truncate">{{ task.component }}</dd>
            </div>
            <!-- Loop-progress overlay: what the loop actually did -->
            <div
              v-if="task.loopStatus || task.pr || task.loopNote"
              class="col-span-2 flex flex-col gap-1"
            >
              <div class="flex items-center gap-2">
                <dt
                  class="text-muted-foreground shrink-0 text-xs"
                  title="Tracked by the loop, not Notion"
                >
                  ◆ Loop
                </dt>
                <dd
                  v-if="task.loopStatus"
                  class="flex items-center gap-1.5 font-medium"
                  :style="{ color: statusColor(task.loopStatus) }"
                >
                  <span
                    class="inline-block size-2 rounded-full"
                    :style="{ backgroundColor: statusColor(task.loopStatus) }"
                    aria-hidden="true"
                  />
                  {{ task.loopStatus }}
                </dd>
                <a
                  v-if="task.pr"
                  :href="task.pr"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-primary ml-auto inline-flex items-center gap-1 text-xs hover:underline"
                >
                  PR <ExternalLink class="size-3" />
                </a>
              </div>
              <p v-if="task.loopNote" class="text-muted-foreground text-xs">
                {{ task.loopNote }}
              </p>
            </div>
            <div v-if="task.epic" class="col-span-2 flex items-center gap-2">
              <dt class="text-muted-foreground shrink-0 text-xs">Epic</dt>
              <dd class="text-foreground truncate" :title="task.epic.name">
                {{ task.epic.name }}
              </dd>
            </div>
            <div v-if="task.parent" class="col-span-2 flex items-center gap-2">
              <dt class="text-muted-foreground shrink-0 text-xs">Parent</dt>
              <dd class="text-foreground truncate" :title="task.parent.name">
                {{ task.parent.name }}
              </dd>
            </div>
          </dl>

          <!-- Note body + feedback editor -->
          <div class="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <!-- Provider/model selection is a required budget gate for both
                 plan-first and greenlight decisions. It never starts work. -->
            <section
              v-if="planLoading || plan || planError"
              class="border-border bg-muted/25 mb-5 rounded-lg border p-3.5"
              aria-label="Execution plan"
            >
              <div class="flex items-start gap-2">
                <Cpu class="text-primary mt-0.5 size-4 shrink-0" />
                <div class="min-w-0">
                  <h3 class="text-foreground text-sm font-semibold">Choose an execution plan</h3>
                  <p class="text-muted-foreground mt-1 text-xs leading-relaxed">
                    Compare all supported providers before deciding who should run this task.
                    Estimates are token/time caps; subscription quota is not a bill.
                  </p>
                </div>
              </div>
              <div v-if="planLoading" class="text-muted-foreground mt-3 flex items-center gap-2 text-sm">
                <Loader2 class="size-3.5 animate-spin" /> Reading provider budgets…
              </div>
              <p v-else-if="planError" class="text-destructive mt-3 text-xs">
                Unable to prepare provider plans: {{ planError }}
              </p>
              <div v-else-if="plan" class="mt-3 space-y-2">
                <button
                  v-for="candidate in plan.candidates"
                  :key="candidate.id"
                  type="button"
                  class="border-border bg-background hover:border-primary/60 w-full rounded-md border p-2.5 text-left transition-colors"
                  :class="selectedPlanId === candidate.id ? 'border-primary ring-primary/30 ring-2' : ''"
                  :aria-pressed="selectedPlanId === candidate.id"
                  @click="selectedPlanId = candidate.id"
                >
                  <div class="flex items-center justify-between gap-2">
                    <span class="text-foreground text-xs font-semibold">{{ candidate.label }}</span>
                    <span
                      v-if="candidate.recommended"
                      class="text-primary rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium"
                    >
                      Recommended
                    </span>
                  </div>
                  <div class="text-muted-foreground mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px]">
                    <span>{{ candidate.model }}</span>
                    <span>· {{ candidate.effort }}</span>
                    <span>· {{ formatTokens(candidate.inputTokens) }} in / {{ formatTokens(candidate.outputTokens) }} out</span>
                    <span>· {{ candidate.maxMinutes }} min cap</span>
                  </div>
                  <div class="text-muted-foreground mt-1 flex flex-wrap gap-x-2 text-[10px]">
                    <span>{{ candidate.quotaWindow }}</span>
                    <span>· {{ candidate.sourceMachine ?? 'no snapshot' }}</span>
                    <span v-if="candidate.usedPct !== null">· {{ candidate.usedPct }}% used</span>
                    <span v-else>· estimate only</span>
                    <span v-if="candidate.availability === 'stale'" class="text-status-warning">· stale</span>
                  </div>
                </button>
                <p class="text-muted-foreground text-[11px]">{{ selectedPlan?.rationale }}</p>
                <div class="flex items-center justify-between gap-2 pt-1">
                  <p v-if="planSaved || plan.saved" class="text-[11px]" :style="{ color: 'var(--status-good)' }">
                    Plan saved. You can still change it before greenlighting.
                  </p>
                  <span v-else />
                  <Button size="sm" :disabled="planSaving || !selectedPlan" @click="savePlan">
                    <Loader2 v-if="planSaving" class="size-3.5 animate-spin" />
                    <Cpu v-else class="size-3.5" />
                    {{ planSaving ? 'Saving…' : 'Save plan' }}
                  </Button>
                </div>
              </div>
            </section>

            <!-- Decision support is deliberately separate from execution: the
                 owner chooses the action, and neither button starts a loop run. -->
            <section
              v-if="decisionLoading || decision || decisionError"
              class="border-border bg-muted/25 mb-5 rounded-lg border p-3.5"
              aria-label="Loop decision"
            >
              <div v-if="decisionLoading" class="text-muted-foreground flex items-center gap-2 text-sm">
                <Loader2 class="size-3.5 animate-spin" /> Preparing decision guidance…
              </div>
              <p v-else-if="decisionError" class="text-destructive text-sm">
                Unable to load decision guidance: {{ decisionError }}
              </p>
              <template v-else-if="decision">
                <div class="flex items-start gap-2">
                  <ShieldCheck
                    v-if="decision.recommendation === 'greenlight'"
                    class="mt-0.5 size-4 shrink-0"
                    :style="{ color: 'var(--status-good)' }"
                  />
                  <AlertTriangle
                    v-else
                    class="text-status-warning mt-0.5 size-4 shrink-0"
                  />
                  <div class="min-w-0">
                    <h3 class="text-foreground text-sm font-semibold">{{ decision.title }}</h3>
                    <p class="text-muted-foreground mt-1 text-xs leading-relaxed">
                      {{ decision.summary }}
                    </p>
                  </div>
                </div>
                <ul v-if="decision.reasons.length" class="text-muted-foreground mt-2.5 space-y-1 pl-5 text-xs">
                  <li v-for="reason in decision.reasons" :key="reason">{{ reason }}</li>
                </ul>
                <label class="text-muted-foreground mt-3 block text-xs font-medium" for="decision-comment">
                  Owner comment
                </label>
                <textarea
                  id="decision-comment"
                  v-model="decisionDraft"
                  rows="3"
                  class="border-border bg-background text-foreground focus-visible:ring-ring mt-1.5 w-full resize-y rounded-md border p-2.5 text-xs focus-visible:outline-none focus-visible:ring-2"
                  placeholder="Add the context you want the executor to see…"
                />
                <p v-if="decisionError" class="text-destructive mt-1.5 text-xs">
                  {{ decisionError }}
                </p>
                <p v-if="decisionSaved" class="mt-1.5 text-xs" :style="{ color: 'var(--status-good)' }">
                  Decision saved. The loop remains stopped until its normal scheduler/command runs.
                </p>
                <p
                  v-if="revocationNote"
                  class="text-status-warning mt-1.5 text-xs leading-relaxed"
                  role="status"
                >
                  {{ revocationNote }}
                </p>
                <div class="mt-3 flex flex-wrap items-center justify-end gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    :disabled="decisionSaving"
                    @click="saveDecision('plan-first')"
                  >
                    <Loader2 v-if="decisionSaving" class="size-3.5 animate-spin" />
                    <AlertTriangle v-else class="size-3.5" />
                    Plan first
                  </Button>
                  <Button
                    v-if="decision.project"
                    size="sm"
                    :disabled="decisionSaving || decision.recommendation !== 'greenlight' || decision.greenlit"
                    :title="
                      decision.greenlit
                        ? 'Already on the owner-maintained greenlight list'
                        : decision.recommendation !== 'greenlight'
                          ? 'Resolve the planning notes first'
                          : 'Queue this task; do not start execution'
                    "
                    @click="saveDecision('greenlight')"
                  >
                    <Loader2 v-if="decisionSaving" class="size-3.5 animate-spin" />
                    <ShieldCheck v-else class="size-3.5" />
                    {{ decision.greenlit ? 'Greenlit' : greenlightLabel }}
                  </Button>
                </div>
                <p v-if="outboxMessage" class="text-muted-foreground mt-2 text-xs">{{ outboxMessage }}</p>
              </template>
            </section>
            <p v-if="loading" class="text-muted-foreground py-8 text-center text-sm">
              Loading note…
            </p>
            <p v-else-if="error" class="text-destructive py-8 text-center text-sm">
              Failed to load note: {{ error }}
            </p>
            <div
              v-else-if="note && !note.found"
              class="text-muted-foreground flex flex-col items-center gap-2 rounded-md border border-dashed py-10 text-center text-sm"
            >
              <FileText class="size-5" />
              <p>No local note found for this task.</p>
            </div>

            <template v-else-if="note && note.found">
              <!-- Rendered note (read-only context) -->
              <div v-if="note.html" class="note-body text-sm" v-html="note.html" />

              <!-- Editable feedback → written back into the note's ## Feedback -->
              <section class="border-border mt-5 border-t pt-4">
                <div class="mb-1.5 flex items-center justify-between gap-2">
                  <h3 class="text-foreground text-sm font-semibold">Feedback</h3>
                  <span
                    v-if="saved"
                    class="inline-flex items-center gap-1 text-[11px]"
                    :style="{ color: 'var(--status-good)' }"
                  >
                    <Check class="size-3" /> Saved
                  </span>
                </div>
                <p class="text-muted-foreground mb-2 text-xs">
                  Your tuning directives — saved to this note's
                  <code class="text-foreground">## Feedback</code> section (the loop's
                  outcome above stays untouched).
                </p>
                <textarea
                  v-model="feedbackDraft"
                  rows="6"
                  placeholder="Leave tuning directives — e.g. re-estimate points, split this task, wrong component…"
                  class="border-border bg-background text-foreground focus-visible:ring-ring w-full resize-y rounded-md border p-2.5 text-sm focus-visible:outline-none focus-visible:ring-2"
                  @input="onFeedbackInput"
                />
                <p v-if="saveError" class="text-destructive mt-1.5 text-xs">
                  {{ saveError }}
                </p>
                <div class="mt-2 flex items-center justify-between gap-3">
                  <p class="text-muted-foreground text-[11px]">
                    Run the <code class="text-foreground">tune</code> skill to apply this
                    feedback to Notion.
                  </p>
                  <Button size="sm" class="shrink-0" :disabled="saving || !dirty" @click="saveFeedback">
                    <Loader2 v-if="saving" class="size-3.5 animate-spin" />
                    <Save v-else class="size-3.5" />
                    {{ saving ? 'Saving…' : 'Save' }}
                  </Button>
                </div>
              </section>
            </template>
          </div>

          <!-- Secondary link: work tasks only -->
          <footer
            v-if="note && note.notionUrl"
            class="border-border border-t px-5 py-3"
          >
            <a
              :href="note.notionUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-xs"
            >
              Open in Notion <ExternalLink class="size-3" />
            </a>
          </footer>
          <footer
            v-else-if="note && note.path"
            class="border-border border-t px-5 py-3"
          >
            <span class="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
              <Badge variant="outline" class="text-[10px]">local</Badge>
              <code class="truncate">{{ note.path }}</code>
            </span>
          </footer>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.drawer-enter-active,
.drawer-leave-active {
  transition: opacity 0.2s ease;
}
.drawer-enter-active aside,
.drawer-leave-active aside {
  transition: transform 0.2s ease;
}
.drawer-enter-from,
.drawer-leave-to {
  opacity: 0;
}
.drawer-enter-from aside,
.drawer-leave-to aside {
  transform: translateX(100%);
}

/* Rendered-markdown styling (no typography plugin in this app). */
.note-body {
  /* Long inline code / URLs / unbreakable tokens wrap instead of forcing a
     horizontal scrollbar on the whole drawer (which scrolled the px-5 padding
     out from under the footer). Code blocks still scroll via `pre`'s own
     overflow-x below. */
  overflow-wrap: anywhere;
}
.note-body :deep(h1),
.note-body :deep(h2),
.note-body :deep(h3) {
  font-weight: 600;
  line-height: 1.3;
  margin: 1.1em 0 0.4em;
  color: var(--foreground);
}
.note-body :deep(h1) {
  font-size: 1.15rem;
}
.note-body :deep(h2) {
  font-size: 1.02rem;
}
.note-body :deep(h3) {
  font-size: 0.95rem;
}
.note-body :deep(p) {
  margin: 0.6em 0;
  color: var(--foreground);
  line-height: 1.6;
}
.note-body :deep(ul),
.note-body :deep(ol) {
  margin: 0.6em 0;
  padding-left: 1.25em;
  list-style: disc;
}
.note-body :deep(ol) {
  list-style: decimal;
}
.note-body :deep(li) {
  margin: 0.25em 0;
}
.note-body :deep(a) {
  color: var(--primary);
  text-decoration: underline;
}
.note-body :deep(code) {
  background: var(--muted);
  border-radius: 0.25rem;
  padding: 0.1em 0.35em;
  font-size: 0.85em;
}
.note-body :deep(pre) {
  background: var(--muted);
  border-radius: 0.5rem;
  padding: 0.75rem;
  overflow-x: auto;
  margin: 0.7em 0;
}
.note-body :deep(pre code) {
  background: none;
  padding: 0;
}
.note-body :deep(blockquote) {
  border-left: 3px solid var(--border);
  padding-left: 0.8em;
  margin: 0.7em 0;
  color: var(--muted-foreground);
}
</style>
