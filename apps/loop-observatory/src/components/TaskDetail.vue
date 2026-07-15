<script setup lang="ts">
import { Check, ExternalLink, FileText, Loader2, Save, X } from '@lucide/vue';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { SprintTask } from '@/lib/tasks';
import { effectiveStatus, priorityColor, scopeBadge, statusColor } from '@/lib/taskStatus';

const props = defineProps<{ task: SprintTask | null; open: boolean; statuses: string[] }>();
const emit = defineEmits<{ close: [] }>();

// The column the loop moved the task to (or the Notion status when untouched).
// The Status row leads with this so it never contradicts the ◆ Loop row below;
// the raw Notion status is shown as a muted secondary when the loop is ahead.
const effStatus = computed(() =>
  props.task ? effectiveStatus(props.task.status, props.task.loopStatus, props.statuses) : '',
);

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

async function fetchNote(id: string) {
  loading.value = true;
  error.value = null;
  saveError.value = null;
  saved.value = false;
  dirty.value = false;
  note.value = null;
  try {
    const res = await fetch(`/api/task-note?id=${encodeURIComponent(id)}`);
    const data = (await res.json()) as NoteResponse;
    note.value = data;
    feedbackDraft.value = data.feedback ?? '';
    if (!res.ok && res.status !== 404) {
      error.value = data.error ?? `HTTP ${res.status}`;
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
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
    const data = (await res.json()) as NoteResponse;
    if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
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

function onFeedbackInput() {
  dirty.value = true;
  saved.value = false;
}

watch(
  () => [props.open, props.task?.id] as const,
  ([open, id]) => {
    if (open && id != null) fetchNote(String(id));
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
