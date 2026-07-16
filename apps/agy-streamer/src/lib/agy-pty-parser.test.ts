import { describe, expect, it } from 'vitest';

import { isIdlePrompt, parseMenuPrompt, selectionKeystrokes } from './agy-pty-parser';

// Captured verbatim (already ANSI-stripped by tmux capture-pane -p) from live
// testing against real agy -i sessions - see docs/superpowers/specs/
// 2026-07-13-agy-streamer-migration-design.md for context.

const WORKSPACE_TRUST_FIXTURE = `Accessing workspace:

/tmp/agy-interactive-test

Do you trust the contents of this project?

Antigravity CLI requires permission to read, edit, and execute files here.

> Yes, I trust this folder
  No, exit

  ↑/↓ Navigate · enter Confirm`;

const COMMAND_APPROVAL_FIXTURE = `Command
────────────────────────────────────────────────────────────────────────────

Requesting permission for:
   pwd

Do you want to proceed?
> 1. Yes
  2. Yes, and always allow in this conversation for commands that start with 'pwd'
  3. Yes, and always allow for commands that start with 'pwd' (Persist to settings.json)
  4. No

  ↑/↓ Navigate · tab Amend · ctrl+g edit/expand command
esc to cancel`;

const FILE_ACCESS_FIXTURE = `Create file
────────────────────────────────────────────────────────────────────────────

/private/tmp/agy-interactive-test/test.txt  +1
   1 +  hello
Reason: outside workspace

Allow creation of this file?
> 1. Yes, allow creation
  2. Yes, and always allow non-workspace access
  3. No, deny creation

  ↑/↓ Navigate · tab Amend · f full diff
esc to cancel`;

const IDLE_FIXTURE = `  I have created the file test.txt in the workspace with the content  hello .

────────────────────────────────────────────────────────────────────────────
>
────────────────────────────────────────────────────────────────────────────
? for shortcuts                                                     Gemini 3.5 Flash (Medium)`;

const NON_PROMPT_FIXTURE = `▸ Thought for 1s, 736 tokens
  Initiating File Creation
  I will read the schema for the obsidian_append_content tool.

● Read(/Users/rainforest/.gemini/antigravity-cli/mcp/docker-mcp/obsidian_append_content.json)`;

// A caller that debounces on PTY output settling can still capture more
// than one full-screen redraw in a single buffer (agy repaints its whole
// screen on every spinner tick while "Generating..."). This fixture
// concatenates a stale echoed-prompt screen (which also has a
// ">"-prefixed line, but no menu below it) followed by the real file-access
// menu, to make sure the parser keys off the latest screen, not the first
// ">" line it finds.
const MULTI_REDRAW_BUFFER_FIXTURE = `> Create a file called test.txt with the exact content: hello
⣽  Generating...
└ Tip: When rejecting an edit, press tab to amend with feedback explaining why.

${FILE_ACCESS_FIXTURE}`;

describe('parseMenuPrompt', () => {
  it('parses the unnumbered workspace-trust prompt', () => {
    const result = parseMenuPrompt(WORKSPACE_TRUST_FIXTURE);
    expect(result).not.toBeNull();
    expect(result!.message).toBe('Antigravity CLI requires permission to read, edit, and execute files here.');
    expect(result!.options).toHaveLength(2);
    expect(result!.options[0].label).toBe('Yes, I trust this folder');
    expect(result!.options[0].numberedChoice).toBeNull();
    expect(result!.options[1].label).toBe('No, exit');
  });

  it('parses the numbered command-approval prompt', () => {
    const result = parseMenuPrompt(COMMAND_APPROVAL_FIXTURE);
    expect(result).not.toBeNull();
    expect(result!.message).toBe('Do you want to proceed?');
    expect(result!.options).toHaveLength(4);
    expect(result!.options[0]).toMatchObject({ label: 'Yes', numberedChoice: 1 });
    expect(result!.options[3]).toMatchObject({ label: 'No', numberedChoice: 4 });
  });

  it('parses the numbered file-access prompt', () => {
    const result = parseMenuPrompt(FILE_ACCESS_FIXTURE);
    expect(result).not.toBeNull();
    expect(result!.message).toBe('Allow creation of this file?');
    expect(result!.options).toHaveLength(3);
    expect(result!.options[2]).toMatchObject({ label: 'No, deny creation', numberedChoice: 3 });
  });

  it('returns null for non-prompt activity output', () => {
    expect(parseMenuPrompt(NON_PROMPT_FIXTURE)).toBeNull();
  });

  it('returns null for the idle prompt (no menu present)', () => {
    expect(parseMenuPrompt(IDLE_FIXTURE)).toBeNull();
  });

  it('finds the current menu even when the buffer also contains an earlier, stale ">" line from a prior redraw', () => {
    const result = parseMenuPrompt(MULTI_REDRAW_BUFFER_FIXTURE);
    expect(result).not.toBeNull();
    expect(result!.message).toBe('Allow creation of this file?');
    expect(result!.options).toHaveLength(3);
    expect(result!.options[0]).toMatchObject({ label: 'Yes, allow creation', numberedChoice: 1 });
  });
});

describe('selectionKeystrokes', () => {
  it('sends the number for a numbered option', () => {
    const prompt = parseMenuPrompt(FILE_ACCESS_FIXTURE)!;
    expect(selectionKeystrokes(prompt, 0)).toBe('1\r');
    expect(selectionKeystrokes(prompt, 2)).toBe('3\r');
  });

  it('sends arrow-down presses + enter for unnumbered options', () => {
    const prompt = parseMenuPrompt(WORKSPACE_TRUST_FIXTURE)!;
    expect(selectionKeystrokes(prompt, 0)).toBe('\r');
    expect(selectionKeystrokes(prompt, 1)).toBe('\x1b[B\r');
  });
});

describe('isIdlePrompt', () => {
  it('detects the idle state', () => {
    expect(isIdlePrompt(IDLE_FIXTURE)).toBe(true);
  });

  it('does not mistake a menu prompt for idle', () => {
    expect(isIdlePrompt(FILE_ACCESS_FIXTURE)).toBe(false);
  });

  it('does not mistake mid-activity output for idle', () => {
    expect(isIdlePrompt(NON_PROMPT_FIXTURE)).toBe(false);
  });
});
