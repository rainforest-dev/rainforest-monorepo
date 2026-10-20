import { useLibraryT } from '@rainforest-dev/library-shell';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
  Kbd,
  Separator,
  Sheet,
  SheetBody,
  SheetContent,
  SheetTitle,
  Spinner,
} from '@rainforest-dev/rainforest-react';
import { CheckIcon, CopyIcon, ExternalLinkIcon, XIcon } from 'lucide-react';
import { type ReactNode, useState } from 'react';

import type { Source } from '@/lib';
import {
  canResubscribe,
  categoryLabel,
  daysAgo,
  staleCopy,
  UNCATEGORISED,
  visibleStale,
} from '@/lib/desk';
import { ROOM_NAMESPACE } from '@/locales';

import { SourceActions } from './SourceActions';
import { STALE_ICON, StaleBadge, StatusBadge } from './StatusBadges';
import { useFeedValidation } from './useFeedValidation';
import type { SourceActionsState } from './useRegistryActions';
import { ValidateForm } from './ValidateForm';
import { ValidateResult } from './ValidateResult';

export const SOURCE_DETAIL_ID = 'source-detail';

export interface SourceDetailProps {
  name: string;
  source: Source | undefined;
  actions: SourceActionsState;
  onClose: () => void;
}

export function SourceDetail({
  name,
  source,
  actions,
  onClose,
}: SourceDetailProps) {
  const t = useLibraryT(ROOM_NAMESPACE);
  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-1">
        <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
          {t('detail.kicker')}
        </p>
        <span className="text-muted-foreground ml-auto inline-flex items-center gap-1 pr-1 text-xs max-lg:hidden">
          <Kbd>Esc</Kbd> {t('detail.escClose')}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t('detail.close')}
          className="max-lg:ml-auto"
          onClick={onClose}
        >
          <XIcon aria-hidden="true" />
        </Button>
      </div>
      {source ? (
        <SourceBody key={source.name} source={source} actions={actions} />
      ) : (
        <Empty className="p-6">
          <EmptyHeader>
            <EmptyTitle>{t('detail.missing', { name })}</EmptyTitle>
            <EmptyDescription>{t('detail.missingHint')}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </div>
  );
}

export interface SourceDetailSheetProps {
  name: string | null;
  sources: readonly Source[];
  actions: SourceActionsState;
  onClose: () => void;
  returnFocus: (name: string) => HTMLElement | null;
}

export function SourceDetailSheet({
  name,
  sources,
  actions,
  onClose,
  returnFocus,
}: SourceDetailSheetProps) {
  const [shown, setShown] = useState(name);
  if (name !== null && name !== shown) setShown(name);
  const source = sources.find((s) => s.name === shown);
  const t = useLibraryT(ROOM_NAMESPACE);

  return (
    <Sheet
      side="bottom"
      open={name !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent
        showCloseButton={false}
        className="h-[88dvh] gap-0"
        finalFocus={() =>
          shown === null ? true : (returnFocus(shown) ?? true)
        }
      >
        <SheetTitle className="sr-only" render={<span />}>
          {t('desk.sources.details')}
        </SheetTitle>
        <SheetBody className="px-0">
          {shown !== null && (
            <SourceDetail
              name={shown}
              source={source}
              actions={actions}
              onClose={onClose}
            />
          )}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}

function SourceBody({
  source,
  actions,
}: {
  source: Source;
  actions: SourceActionsState;
}) {
  const t = useLibraryT(ROOM_NAMESPACE);
  const stale = visibleStale(source);
  const copy = stale ? staleCopy(stale.type, t) : null;
  const StaleIcon = stale ? STALE_ICON[stale.type] : null;
  const age = source.proposedDate ? daysAgo(source.proposedDate, t) : null;

  return (
    <>
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold leading-snug">{source.name}</h2>
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge status={source.status} />
          {stale && <StaleBadge stale={stale} />}
          <span className="text-muted-foreground text-sm">
            {categoryLabel(source.category || UNCATEGORISED, t)}
          </span>
        </div>
      </div>

      {stale && copy && StaleIcon && (
        <Alert variant="warning">
          <StaleIcon aria-hidden="true" />
          <AlertTitle>{copy.label}</AlertTitle>
          <AlertDescription className="[&_p:not(:last-child)]:mb-0">
            <p>{stale.note || copy.hint}</p>
            {copy.fix && <p className="text-foreground mt-1">{copy.fix}</p>}
          </AlertDescription>
        </Alert>
      )}

      <dl className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
        <Row label={t('detail.feed')}>
          <span className="flex min-w-0 items-center gap-1">
            <span className="truncate font-mono text-xs" title={source.url}>
              {source.url}
            </span>
            <CopyButton url={source.url} />
          </span>
        </Row>
        {source.siteUrl && (
          <Row label={t('detail.site')}>
            <a
              href={source.siteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary inline-flex max-w-full items-center gap-1 hover:underline"
            >
              <span className="truncate">{source.siteUrl}</span>
              <ExternalLinkIcon aria-hidden="true" className="size-3.5" />
            </a>
          </Row>
        )}
        <Row label={t('detail.tags')}>
          {source.tags.length > 0 ? (
            <span className="flex flex-wrap gap-1">
              {source.tags.map((tag) => (
                <Badge key={tag} variant="muted">
                  {tag}
                </Badge>
              ))}
            </span>
          ) : (
            <span className="text-muted-foreground">{t('detail.none')}</span>
          )}
        </Row>
        {source.status === 'proposed' && source.proposedDate && (
          <Row label={t('detail.proposed')}>
            {source.proposedDate}
            {age && <span className="text-muted-foreground"> · {age}</span>}
          </Row>
        )}
      </dl>

      <Separator />

      <section aria-labelledby="feed-check" className="flex flex-col gap-2">
        <h3 id="feed-check" className="text-sm font-semibold">
          {t('detail.feedCheck')}
        </h3>
        {source.status === 'no-rss' ? (
          <NoRssCheck url={source.url} />
        ) : (
          <FeedCheck url={source.url} />
        )}
      </section>

      <Separator />

      <div className="flex flex-col gap-2">
        <SourceActions source={source} actions={actions} layout="pane" />
        {canResubscribe(source) && (
          <p className="text-muted-foreground text-xs">
            {t('detail.noRetire')}
          </p>
        )}
        {actions.resubscribed.has(source.name) && (
          <p className="text-sm">
            <span className="inline-flex items-center gap-1.5 font-medium">
              <CheckIcon aria-hidden="true" className="text-success size-4" />
              {t('detail.resubscribed')}
            </span>
            <span className="text-muted-foreground block text-xs">
              {t('detail.resubscribedHint')}
            </span>
          </p>
        )}
      </div>
    </>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </>
  );
}

function CopyButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const t = useLibraryT(ROOM_NAMESPACE);
  return (
    <Button
      variant="ghost"
      size="icon-xs"
      aria-label={copied ? t('detail.copied') : t('detail.copy')}
      onClick={() => {
        void navigator.clipboard.writeText(url).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        });
      }}
    >
      {copied ? (
        <CheckIcon aria-hidden="true" />
      ) : (
        <CopyIcon aria-hidden="true" />
      )}
    </Button>
  );
}

function FeedCheck({ url }: { url: string }) {
  const t = useLibraryT(ROOM_NAMESPACE);
  const validation = useFeedValidation(url);
  const { pending, result, validate } = validation;
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="self-start"
        disabled={pending}
        onClick={() => void validate()}
      >
        {pending && <Spinner data-icon="inline-start" />}
        {t('detail.validate')}
      </Button>
      {pending && (
        <p className="text-muted-foreground text-sm">
          {t('desk.validate.fetching')}
        </p>
      )}
      {!pending && result && <ValidateResult result={result} />}
    </>
  );
}

function NoRssCheck({ url }: { url: string }) {
  const t = useLibraryT(ROOM_NAMESPACE);
  const validation = useFeedValidation(url);
  return (
    <>
      <p className="text-muted-foreground text-sm">{t('detail.noRss')}</p>
      <ValidateForm validation={validation} />
    </>
  );
}
