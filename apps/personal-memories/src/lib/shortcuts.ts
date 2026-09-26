import { type Place, zoomOutHref } from './nav.ts';

export type ShortcutRow = { keys: string[]; label: string };
export type ShortcutGroup = { title: string; rows: ShortcutRow[] };

export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: '全部畫面',
    rows: [
      { keys: ['/'], label: '跳至日期' },
      { keys: ['?'], label: '看所有快速鍵' },
      { keys: ['Esc'], label: '縮小一層' },
    ],
  },
  {
    title: '年',
    rows: [
      { keys: ['←', '→'], label: '在日子間移動' },
      { keys: ['Enter'], label: '打開那一天' },
    ],
  },
  {
    title: '日',
    rows: [
      { keys: ['k'], label: '前一天' },
      { keys: ['j'], label: '後一天' },
      { keys: ['n'], label: '寫回憶' },
    ],
  },
  {
    title: '照片',
    rows: [
      { keys: ['←'], label: '上一張' },
      { keys: ['→'], label: '下一張' },
    ],
  },
];

export type Shortcut =
  | { type: 'navigate'; href: string }
  | { type: 'step-day'; delta: -1 | 1 }
  | { type: 'step-cell'; delta: -1 | 1 }
  | { type: 'blur' }
  | { type: 'focus-note' }
  | { type: 'open-jump' }
  | { type: 'open-shortcuts' };

export type KeyInput = {
  key: string;
  modified: boolean;
  typing: boolean;
  overlayOpen: boolean;
  onCell: boolean;
  place: Place | undefined;
};

export function resolveShortcut(k: KeyInput): Shortcut | undefined {
  if (k.modified || k.typing || k.overlayOpen || !k.place) return undefined;
  const { level } = k.place;
  switch (k.key) {
    case '?':
      return { type: 'open-shortcuts' };
    case '/':
      return { type: 'open-jump' };
    case 'Escape': {
      if (level === 'year') return k.onCell ? { type: 'blur' } : undefined;
      const href = zoomOutHref(k.place);
      return href ? { type: 'navigate', href } : undefined;
    }
    case 'j':
      return level === 'day' ? { type: 'step-day', delta: 1 } : undefined;
    case 'k':
      return level === 'day' ? { type: 'step-day', delta: -1 } : undefined;
    case 'n':
      return level === 'day' ? { type: 'focus-note' } : undefined;
    case 'ArrowRight':
      return level === 'year' && k.onCell
        ? { type: 'step-cell', delta: 1 }
        : undefined;
    case 'ArrowLeft':
      return level === 'year' && k.onCell
        ? { type: 'step-cell', delta: -1 }
        : undefined;
    default:
      return undefined;
  }
}
