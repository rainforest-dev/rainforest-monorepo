<script setup lang="ts">
import { ExternalLink, FileText, X } from '@lucide/vue';
import { onBeforeUnmount, ref, watch } from 'vue';

import { Badge } from '@/components/ui/badge';
import type { SprintTask } from '@/lib/tasks';
import { priorityColor, scopeBadge, statusColor } from '@/lib/taskStatus';

const props = defineProps<{ task: SprintTask | null; open: boolean }>();
const emit = defineEmits<{ close: [] }>();

interface NoteResponse {
  found: boolean;
  id: string;
  scope?: 'work' | 'personal';
  path?: string;
  name?: string;
  html?: string;
  notionUrl?: string | null;
  error?: string;
}

const note = ref<NoteResponse | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);

async function fetchNote(id: string) {
  loading.value = true;
  error.value = null;
  note.value = null;
  try {
    const res = await fetch(`/api/task-note?id=${encodeURIComponent(id)}`);
    const data = (await res.json()) as NoteResponse;
    note.value = data;
    if (!res.ok && res.status !== 404) {
      error.value = data.error ?? `HTTP ${res.status}`;
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
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
</script>

<template>
  <Teleport to="body">
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
                  :style="{ backgroundColor: statusColor(task.status) }"
                  aria-hidden="true"
                />
                <span class="text-foreground">{{ task.status }}</span>
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

          <!-- Note body -->
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
            <div
              v-else-if="note && note.html"
              class="note-body text-sm"
              v-html="note.html"
            />
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
