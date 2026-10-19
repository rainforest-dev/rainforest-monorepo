/** Element ids the shell renders, for `aria-controls` and skip links in the apps. */
export const SHELL_IDS = {
  main: 'library-main',
  filters: 'library-filters',
} as const;

/**
 * `view-transition-name`s on the shell's chrome. With `view-transitions.css` loaded, a
 * cross-app navigation morphs these in place instead of repainting them.
 */
export const SHELL_TRANSITION_NAMES = {
  header: 'library-shell-header',
  tabBar: 'library-shell-tabs',
} as const;
