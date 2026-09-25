export type ShortcutRow = { keys: string[]; label: string };
export type ShortcutGroup = { title?: string; rows: ShortcutRow[] };

export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    rows: [
      { keys: ['/'], label: '跳至日期' },
      { keys: ['?'], label: '鍵盤快速鍵' },
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
      { keys: ['j'], label: '後一天' },
      { keys: ['k'], label: '前一天' },
      { keys: ['n'], label: '這一天的回憶' },
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
