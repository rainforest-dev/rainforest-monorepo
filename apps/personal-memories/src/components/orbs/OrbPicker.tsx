import {
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@rainforest-dev/rainforest-react';
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
} from '@tanstack/react-query';
import { actions } from 'astro:actions';
import { StarIcon } from 'lucide-react';
import { type Dispatch, type SetStateAction, useState } from 'react';

import {
  applyPatch,
  EMOTIONS,
  isCore,
  ISLANDS,
  orbBackground,
  type OrbEntry,
  orbHalves,
  type OrbPatch,
} from '@/lib';
import type { OrbPerson } from '@/lib/server';

export type OrbTarget = { key: string; label: string; thumb?: string };

type Props = {
  pair: OrbPerson[];
  viewer?: string | undefined;
  writable: boolean;
  targets: OrbTarget[];
  initial: Record<string, OrbEntry>;
  title: string;
};

type Entries = Record<string, OrbEntry>;

const queryClient = new QueryClient();

export function OrbPicker({ initial, title, ...props }: Props) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<Entries>(initial);
  const ids = props.pair.map((p) => p.id);
  const day = entries[props.targets[0]?.key ?? ''];
  return (
    <QueryClientProvider client={queryClient}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="bg-card/95 fixed bottom-[188px] right-4 z-20 flex items-center gap-2 rounded-full border py-1.5 pe-4 ps-1.5 text-sm font-medium shadow-lg backdrop-blur lg:bottom-6"
      >
        <span
          data-orb
          data-core={isCore(day, ids) ? '' : undefined}
          className="size-9 rounded-full"
          style={{ background: orbBackground(orbHalves(day, ids)) }}
        />
        記憶球
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              各自選一種情緒和一座島，兩人都摘星就成為核心記憶。
            </DialogDescription>
          </DialogHeader>
          <Picker {...props} entries={entries} setEntries={setEntries} />
        </DialogContent>
      </Dialog>
    </QueryClientProvider>
  );
}

function Picker({
  pair,
  viewer,
  writable,
  targets,
  entries,
  setEntries,
}: Omit<Props, 'initial' | 'title'> & {
  entries: Entries;
  setEntries: Dispatch<SetStateAction<Entries>>;
}) {
  const [key, setKey] = useState(targets[0]?.key ?? '');
  const ids = pair.map((p) => p.id);
  const entry = entries[key];
  const core = isCore(entry, ids);
  const canEdit = writable && !!viewer;

  const save = useMutation({
    mutationFn: (input: { key: string } & OrbPatch) =>
      actions.setOrb.orThrow(input),
    onMutate: (input) => {
      const before = entries[input.key];
      const { key: k, ...patch } = input;
      setEntries((all) => {
        const next = applyPatch(
          { version: 1, orbs: all },
          k,
          viewer ?? '',
          patch,
          new Date().toISOString(),
        );
        return { ...all, [k]: next.orbs[k] ?? {} };
      });
      return { before };
    },
    onSuccess: (data: { entry: OrbEntry }, input) =>
      setEntries((all) => ({ ...all, [input.key]: data.entry })),
    onError: (_error, input, context) =>
      setEntries((all) => ({ ...all, [input.key]: context?.before ?? {} })),
  });

  const patch = (p: OrbPatch) => {
    if (canEdit) save.mutate({ key, ...p });
  };

  return (
    <section aria-label="記憶球選擇">
      <header className="mb-4 flex items-center gap-4">
        <span
          data-orb
          data-core={core ? '' : undefined}
          className="size-16 shrink-0 rounded-full"
          style={{ background: orbBackground(orbHalves(entry, ids)) }}
        />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">
            {targets.find((t) => t.key === key)?.label}
          </p>
          <p className="text-muted-foreground text-sm">
            {core ? '★ 核心記憶：兩個人都摘星了' : '還不是核心記憶'}
          </p>
        </div>
      </header>

      {targets.length > 1 && (
        <div
          role="radiogroup"
          aria-label="要替哪一顆記憶球選"
          className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1"
        >
          {targets.map((t) => (
            <button
              key={t.key}
              type="button"
              role="radio"
              aria-checked={t.key === key}
              aria-label={t.label}
              onClick={() => setKey(t.key)}
              className={cn(
                'relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-full border-2 text-xs',
                t.key === key ? 'border-primary' : 'border-transparent',
              )}
              style={{
                background: orbBackground(orbHalves(entries[t.key], ids)),
              }}
            >
              {t.thumb ? (
                <img
                  src={t.thumb}
                  alt=""
                  loading="lazy"
                  className="size-9 rounded-full object-cover"
                />
              ) : (
                <span className="text-(--io-on-orb) font-semibold [text-shadow:0_1px_2px_rgb(0_0_0/0.5)]">
                  整天
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-4">
        {pair.map((person) => {
          const pick = entry?.[person.id];
          const mine = canEdit && person.id === viewer;
          return (
            <div key={person.id} className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span
                  className="text-(--io-ink) rounded-full px-2.5 py-0.5 text-xs font-semibold"
                  style={{ background: person.color }}
                >
                  {person.name}
                </span>
                {!mine && (
                  <span className="text-muted-foreground text-xs">
                    {pick?.emotion || pick?.island ? '' : '還沒選'}
                  </span>
                )}
                <button
                  type="button"
                  disabled={!mine}
                  aria-pressed={!!pick?.core}
                  aria-label={`${person.name}摘星為核心記憶`}
                  onClick={() => patch({ core: !pick?.core })}
                  className="ms-auto flex items-center gap-1 rounded-full px-2 py-1 text-xs disabled:cursor-default"
                  style={{ color: pick?.core ? person.color : undefined }}
                >
                  <StarIcon
                    className="size-4"
                    fill={pick?.core ? 'currentColor' : 'none'}
                  />
                  {pick?.core ? '已摘星' : mine ? '摘星' : '未摘星'}
                </button>
              </div>
              <div
                role="group"
                aria-label={`${person.name}的情緒`}
                className="flex flex-wrap gap-1.5"
              >
                {EMOTIONS.map((e) => {
                  const on = pick?.emotion === e.id;
                  if (!mine && !on) return null;
                  return (
                    <button
                      key={e.id}
                      type="button"
                      disabled={!mine}
                      aria-pressed={on}
                      onClick={() => patch({ emotion: on ? null : e.id })}
                      className={cn(
                        'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm disabled:cursor-default',
                        on
                          ? 'text-(--io-ink) border-transparent'
                          : 'bg-background',
                      )}
                      style={on ? { background: e.color } : undefined}
                    >
                      <span
                        className="size-2.5 rounded-full"
                        style={{ background: e.color }}
                      />
                      {e.label}
                    </button>
                  );
                })}
              </div>
              <div
                role="group"
                aria-label={`${person.name}的島`}
                className="flex flex-wrap gap-1.5"
              >
                {ISLANDS.map((i) => {
                  const on = pick?.island === i.id;
                  if (!mine && !on) return null;
                  return (
                    <button
                      key={i.id}
                      type="button"
                      disabled={!mine}
                      aria-pressed={on}
                      onClick={() => patch({ island: on ? null : i.id })}
                      className={cn(
                        'rounded-full border px-2.5 py-1 text-sm disabled:cursor-default',
                        on
                          ? 'bg-primary text-primary-foreground border-transparent'
                          : 'bg-background',
                      )}
                    >
                      <span aria-hidden="true">{i.glyph}</span> {i.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {!canEdit && (
        <p className="text-muted-foreground mt-4 text-xs">
          {writable
            ? '用 Access 登入後才能替自己選。'
            : '這個環境的記憶球是唯讀的。'}
        </p>
      )}
      {save.isError && (
        <p role="alert" className="text-destructive mt-3 text-xs">
          沒存到，再試一次。
        </p>
      )}
    </section>
  );
}
