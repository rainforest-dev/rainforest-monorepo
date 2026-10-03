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
  Spinner,
} from '@rainforest-dev/rainforest-react';
import { CheckIcon, CopyIcon, ExternalLinkIcon, XIcon } from 'lucide-react';
import { type ReactNode, useState } from 'react';

import type { Source } from '@/lib';
import {
  canResubscribe,
  daysAgo,
  STALE_COPY,
  UNCATEGORISED,
  visibleStale,
} from '@/lib/desk';

import { SourceActions } from './SourceActions';
import { STALE_ICON, StaleBadge, StatusBadge } from './StatusBadges';
import { useFeedValidation } from './useFeedValidation';
import type { SourceActionsState } from './useSourceActions';
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
  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-1">
        <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
          Source
        </p>
        <span className="text-muted-foreground ml-auto inline-flex items-center gap-1 pr-1 text-xs max-lg:hidden">
          <Kbd>Esc</Kbd> close
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Close details"
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
            <EmptyTitle>No source named “{name}”</EmptyTitle>
            <EmptyDescription>
              It may have been renamed or removed in the vault.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </div>
  );
}

function SourceBody({
  source,
  actions,
}: {
  source: Source;
  actions: SourceActionsState;
}) {
  const stale = visibleStale(source);
  const copy = stale ? STALE_COPY[stale.type] : null;
  const StaleIcon = stale ? STALE_ICON[stale.type] : null;
  const age = source.proposedDate ? daysAgo(source.proposedDate) : null;

  return (
    <>
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold leading-snug">{source.name}</h2>
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge status={source.status} />
          {stale && <StaleBadge stale={stale} />}
          <span className="text-muted-foreground text-sm">
            {source.category || UNCATEGORISED}
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
        <Row label="Feed">
          <span className="flex min-w-0 items-center gap-1">
            <span className="truncate font-mono text-xs" title={source.url}>
              {source.url}
            </span>
            <CopyButton url={source.url} />
          </span>
        </Row>
        {source.siteUrl && (
          <Row label="Site">
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
        <Row label="Tags">
          {source.tags.length > 0 ? (
            <span className="flex flex-wrap gap-1">
              {source.tags.map((tag) => (
                <Badge key={tag} variant="muted">
                  {tag}
                </Badge>
              ))}
            </span>
          ) : (
            <span className="text-muted-foreground">None</span>
          )}
        </Row>
        {source.status === 'proposed' && source.proposedDate && (
          <Row label="Proposed">
            {source.proposedDate}
            {age && <span className="text-muted-foreground"> · {age}</span>}
          </Row>
        )}
      </dl>

      <Separator />

      <section aria-labelledby="feed-check" className="flex flex-col gap-2">
        <h3 id="feed-check" className="text-sm font-semibold">
          Feed check
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
            Not offered for retirement: the feed still publishes, and Readwise
            is the part that stopped.
          </p>
        )}
        {actions.error && (
          <p role="alert" className="text-destructive text-sm">
            {actions.error}
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
  return (
    <Button
      variant="ghost"
      size="icon-xs"
      aria-label={copied ? 'Feed URL copied' : 'Copy feed URL'}
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
        Validate feed
      </Button>
      {pending && (
        <p className="text-muted-foreground text-sm">Fetching the feed…</p>
      )}
      {!pending && result && <ValidateResult result={result} />}
    </>
  );
}

function NoRssCheck({ url }: { url: string }) {
  const validation = useFeedValidation(url);
  return (
    <>
      <p className="text-muted-foreground text-sm">
        No feed was found for this site. Check a feed URL for it:
      </p>
      <ValidateForm validation={validation} />
    </>
  );
}
