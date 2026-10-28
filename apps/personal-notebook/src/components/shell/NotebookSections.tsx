'use client';

import {
  type RenderShellLink,
  SectionNav,
  useLibraryT,
} from '@rainforest-dev/library-shell';
import { CalendarDays, LayoutGrid, ListTodo } from 'lucide-react';
import { usePathname, useSearchParams } from 'next/navigation';
import { type ReactNode } from 'react';

import { BASE_PATH } from '@/lib';
import { NOTEBOOK_NAMESPACE } from '@/locales';

// Full paths, like every shell href; the shell's link renderer strips the base path.
const VIEWS = [
  { id: 'shelf', href: BASE_PATH, icon: LayoutGrid },
  { id: 'calendar', href: `${BASE_PATH}/?view=calendar`, icon: CalendarDays },
  { id: 'tasks', href: `${BASE_PATH}/?view=tasks`, icon: ListTodo },
] as const;

interface Props {
  renderLink: (props: Parameters<RenderShellLink>[0]) => ReactNode;
}

/**
 * The notebooks' views in the row under the bar, on the front page only. A page search shows
 * none of them as current: its results replace every view.
 */
export function NotebookSections({ renderLink }: Props) {
  const t = useLibraryT(NOTEBOOK_NAMESPACE);
  const pathname = usePathname();
  const params = useSearchParams();
  if (pathname !== '/') return null;
  const asked = params.get('view');
  const view = asked === 'calendar' || asked === 'tasks' ? asked : 'shelf';
  return (
    <SectionNav
      label={t('view.label')}
      current={params.get('q')?.trim() ? undefined : view}
      renderLink={renderLink}
      items={VIEWS.map(({ id, href, icon }) => ({
        id,
        href,
        icon,
        label: t(`view.${id}`),
      }))}
    />
  );
}
