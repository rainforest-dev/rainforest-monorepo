'use client';

import { Button, Input, toast } from '@rainforest-dev/rainforest-react';
import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';

import { readError } from './api';

export function CreateNotebookForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      const response = await fetch('/api/notebooks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!response.ok) {
        toast.error(await readError(response, 'Could not create notebook'));
        return;
      }
      const { notebook } = (await response.json()) as {
        notebook: { id: number };
      };
      router.push(`/notebooks/${notebook.id}`);
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
        Notebook name
      </label>
      <Input
        id="notebook-name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="New notebook, e.g. 2026 A5 Dotted"
        maxLength={120}
        autoComplete="off"
      />
      <Button type="submit" disabled={busy || !name.trim()}>
        <Plus aria-hidden />
        Create
      </Button>
    </form>
  );
}
