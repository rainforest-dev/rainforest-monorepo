import {
  Button,
  ButtonGroup,
  Field,
  FieldLabel,
  Input,
  Spinner,
} from '@rainforest-dev/rainforest-react';
import { type Ref, useId } from 'react';

import type { FeedValidation } from './useFeedValidation';
import { ValidateResult } from './ValidateResult';

export interface ValidateFormProps {
  validation: FeedValidation;
  inputRef?: Ref<HTMLInputElement>;
}

export function ValidateForm({ validation, inputRef }: ValidateFormProps) {
  const inputId = useId();
  const { url, setUrl, pending, result, validate } = validation;

  return (
    <div className="flex flex-col gap-3">
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void validate();
        }}
      >
        <Field>
          <FieldLabel htmlFor={inputId}>Feed URL</FieldLabel>
          <ButtonGroup className="w-full">
            <Input
              ref={inputRef}
              id={inputId}
              type="text"
              inputMode="url"
              autoComplete="url"
              spellCheck={false}
              placeholder="https://example.com/rss.xml"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <Button type="submit" disabled={!url.trim() || pending}>
              {pending && <Spinner data-icon="inline-start" />}
              Validate
            </Button>
          </ButtonGroup>
        </Field>
      </form>
      {pending && (
        <p role="status" className="text-muted-foreground text-sm">
          Fetching the feed…
        </p>
      )}
      {!pending && result && <ValidateResult result={result} />}
    </div>
  );
}
