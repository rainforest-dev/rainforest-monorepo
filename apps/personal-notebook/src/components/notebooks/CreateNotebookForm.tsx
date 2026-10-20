'use client';

import { useLibraryT } from '@rainforest-dev/library-shell';
import { Button, Input, toast } from '@rainforest-dev/rainforest-react';
import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';

import { withBase } from '@/lib';
import { NOTEBOOK_NAMESPACE } from '@/locales';

import { readError } from './api';

export function CreateNotebookForm() {
  const router = useRouter();
  const t = useLibraryT(NOTEBOOK_NAMESPACE);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      const response = await fetch(withBase('/api/notebooks'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!response.ok) {
        toast.error(await readError(response, t('create.failed')));
        return;
      }
      const { notebook } = (await response.json()) as {
        notebook: { id: number };
      };
      router.push(`/${notebook.id}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex w-full max-w-md items-center gap-2"
    >
      <label htmlFor="notebook-name" className="sr-only">
        {t('create.name')}
      </label>
      <Input
        id="notebook-name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder={t('create.placeholder')}
        maxLength={120}
        autoComplete="off"
      />
      <Button type="submit" disabled={busy || !name.trim()}>
        <Plus aria-hidden />
        {t('create.submit')}
      </Button>
    </form>
  );
}
