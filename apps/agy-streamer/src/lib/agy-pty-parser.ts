/**
 * A single selectable line inside a menu prompt rendered by `agy -i`
 * (e.g. "1. Yes" or "Yes, I trust this folder"). `numberedChoice` is the
 * digit prefix agy expects on stdin for prompts that support typing a
 * number directly (command/file-access approvals); it is `null` for the
 * workspace-trust prompt, which only supports arrow-key navigation.
 */
export interface MenuOption {
  label: string;
  raw: string;
  numberedChoice: number | null;
}

/** A fully parsed interactive prompt: the question being asked plus its options. */
export interface MenuPrompt {
  message: string;
  options: MenuOption[];
}

const NAV_HINT_RE = /Navigate|Confirm|esc to cancel/;
const OPTION_LINE_RE = /^[>\s]\s*(?:(\d+)\.\s*)?(.+)$/;
const CURSOR_LINE_RE = /^>\s+\S/;

/**
 * Parses a chunk of ANSI-stripped terminal output captured from a live
 * `agy -i` pseudo-terminal session and extracts the current menu prompt, if
 * one is present. `agy -i` renders three known prompt shapes: the
 * unnumbered workspace-trust prompt (arrow-key only), and the numbered
 * command-approval / file-access prompts (which also accept typing a
 * digit). Returns `null` when the captured text isn't currently showing a
 * menu prompt (e.g. idle input box, or mid-activity tool output).
 */
export function parseMenuPrompt(strippedText: string): MenuPrompt | null {
  const lines = strippedText.split('\n');

  const cursorIdx = lines.findIndex((l) => CURSOR_LINE_RE.test(l));
  if (cursorIdx === -1) return null;

  const optionLines: string[] = [lines[cursorIdx]];
  let i = cursorIdx + 1;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === '') break;
    if (NAV_HINT_RE.test(line)) break;
    if (!/^\s{2,}\S/.test(line)) break;
    optionLines.push(line);
    i++;
  }

  const lookahead = lines.slice(i, i + 4).join('\n');
  if (!NAV_HINT_RE.test(lookahead)) return null;

  const options: MenuOption[] = optionLines.map((line) => {
    const match = line.match(OPTION_LINE_RE);
    const numberedChoice = match && match[1] ? parseInt(match[1], 10) : null;
    const label = match ? match[2].trim() : line.trim();
    return { label, raw: line, numberedChoice };
  });

  let messageIdx = cursorIdx - 1;
  while (messageIdx >= 0 && lines[messageIdx].trim() === '') messageIdx--;
  const message = messageIdx >= 0 ? lines[messageIdx].trim() : '';

  return { message, options };
}

/**
 * Computes the raw keystrokes to write to the PTY's stdin to select a given
 * option of an already-parsed menu prompt. Numbered options (command/file
 * approvals) accept typing the digit directly followed by enter. Unnumbered
 * options (workspace-trust) require navigating down from the default
 * cursor position with arrow-down (`\x1b[B`) before pressing enter.
 */
export function selectionKeystrokes(prompt: MenuPrompt, chosenIndex: number): string {
  const chosen = prompt.options[chosenIndex];
  if (chosen.numberedChoice !== null) {
    return `${chosen.numberedChoice}\r`;
  }
  const downPresses = '\x1b[B'.repeat(chosenIndex);
  return `${downPresses}\r`;
}

/**
 * Detects whether the captured terminal output shows agy's idle input
 * prompt (waiting for the next user message, no approval menu on screen).
 * Used to know when it's safe to write a new user message to the PTY.
 */
export function isIdlePrompt(strippedText: string): boolean {
  const lastLines = strippedText.trim().split('\n').slice(-3);
  const hasShortcutsHint = lastLines.some((line) => /\?\s*for shortcuts/.test(line));
  const hasCursorLine = lastLines.some((line) => CURSOR_LINE_RE.test(line));
  return hasShortcutsHint && !hasCursorLine;
}
