// The story gallery Playwright's `mount` fixture drives: it calls `window.mount({ story, props })`
// and gets a locator for `#root`. Contract: playwright-core's playwright-component-testing skill,
// references/gallery-spec.md.
import './gallery.css';

import { type ComponentType, StrictMode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';

const stories = import.meta.glob<Record<string, ComponentType>>(
  '../../src/**/*.story.tsx',
);

// `src/sidebar.story.tsx` export `WithColumn` → `sidebar/WithColumn`.
const id = (file: string) =>
  file.replace(/^(\.\.\/)+src\//, '').replace(/\.story\.tsx$/, '');

async function resolve(storyId: string) {
  const sep = storyId.lastIndexOf('/');
  const [path, name] = [storyId.slice(0, sep), storyId.slice(sep + 1)];
  const file = Object.keys(stories).find(
    (f) => id(f) === path || id(f).endsWith(`/${path}`),
  );
  const load = file ? stories[file] : undefined;
  return load ? (await load())[name] : undefined;
}

const rootEl = document.getElementById('root') as HTMLElement;
let root: Root | undefined;

declare global {
  interface Window {
    mount(params: {
      story: string;
      props?: Record<string, unknown>;
    }): Promise<void>;
    unmount(): Promise<void>;
  }
}

window.mount = async ({ story, props }) => {
  const Story = await resolve(story);
  if (!Story) throw new Error(`Unknown story: ${story}`);
  // One root for every call, so `update()` re-renders in place and keeps state.
  root ??= createRoot(rootEl);
  // flushSync, so a render error rejects the promise instead of being swallowed.
  flushSync(() =>
    root?.render(
      <StrictMode>
        <Story {...props} />
      </StrictMode>,
    ),
  );
};

window.unmount = async () => {
  root?.unmount();
  root = undefined;
};
