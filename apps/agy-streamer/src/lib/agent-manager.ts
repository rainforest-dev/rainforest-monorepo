import { spawn } from 'child_process';
import fs from 'fs/promises';
import * as pty from 'node-pty';
import os from 'os';
import path from 'path';
import stripAnsi from 'strip-ansi';

import { isIdlePrompt, type MenuPrompt,parseMenuPrompt, selectionKeystrokes } from './agy-pty-parser';

interface PendingPermissionRequest {
  message: string;
  options: string[];
}

interface AgentSession {
  process: any;
  controllers: Set<ReadableStreamDefaultController>;
  pendingResolve: ((optionIndex: number) => void) | null;
  // Mirrors the last `permission_request` broadcast while it's still
  // unresolved. `broadcast()` only reaches controllers connected at the
  // moment it fires - a client that connects (or reconnects) after a
  // prompt has already been shown would otherwise see the raw PTY output
  // log, but never get the interactive approval card, since that state
  // is normally only ever pushed once, live. Replayed to newly-connecting
  // clients in `addSSEClient` so reconnecting mid-approval re-syncs the
  // actual current state instead of only waiting on future events.
  pendingPermissionRequest: PendingPermissionRequest | null;
}

const activeSessions = new Map<string, AgentSession>();
const BRAIN_DIR = path.join(os.homedir(), '.gemini/antigravity-cli/brain');

export function getOrCreateSession(sessionId: string): AgentSession {
  if (!activeSessions.has(sessionId)) {
    activeSessions.set(sessionId, {
      process: null,
      controllers: new Set(),
      pendingResolve: null,
      pendingPermissionRequest: null
    });
  }
  return activeSessions.get(sessionId)!;
}

export function addSSEClient(sessionId: string, controller: ReadableStreamDefaultController) {
  const session = getOrCreateSession(sessionId);
  session.controllers.add(controller);

  // Re-sync a newly-connecting client to a currently-pending approval
  // request it would otherwise never see, since the original broadcast
  // already fired before this connection existed.
  if (session.pendingPermissionRequest) {
    try {
      const payload = `data: ${JSON.stringify({
        type: 'permission_request',
        message: session.pendingPermissionRequest.message,
        options: session.pendingPermissionRequest.options,
      })}\n\n`;
      controller.enqueue(new TextEncoder().encode(payload));
    } catch (e) {
      // Controller not ready to receive yet - the client will still get
      // the live broadcast if the prompt is still pending when it fires.
    }
  }

  // Clean up on disconnect
  return () => {
    session.controllers.delete(controller);
    if (session.controllers.size === 0 && !session.process) {
      activeSessions.delete(sessionId);
    }
  };
}

export function broadcast(sessionId: string, data: any) {
  const session = activeSessions.get(sessionId);
  if (!session) return;
  
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const controller of session.controllers) {
    try {
      controller.enqueue(new TextEncoder().encode(payload));
    } catch (e) {
      session.controllers.delete(controller);
    }
  }
}

export async function appendLogEntry(sessionId: string, entry: any) {
  const logDir = path.join(BRAIN_DIR, sessionId, '.system_generated/logs');
  await fs.mkdir(logDir, { recursive: true });
  const logPath = path.join(logDir, 'transcript.jsonl');
  
  // Add timestamp
  const logWithTime = {
    ...entry,
    ts: new Date().toISOString()
  };
  
  await fs.appendFile(logPath, JSON.stringify(logWithTime) + '\n', 'utf8');
}

export async function startAgentSession(sessionId: string, directory: string, prompt: string, agentType = 'agy', options: { model?: string } = {}) {
  const session = getOrCreateSession(sessionId);
  if (session.process) {
    throw new Error('An agent session is already running for this ID');
  }

  // Save session metadata
  const metaPath = path.join(BRAIN_DIR, sessionId, 'metadata.json');
  try {
    await fs.mkdir(path.dirname(metaPath), { recursive: true });
    await fs.writeFile(metaPath, JSON.stringify({ agentType, directory, created_at: new Date().toISOString() }), 'utf8');
  } catch (e) {
    console.error('Error writing session metadata:', e);
  }

  // Append user input to log first
  try {
    await appendLogEntry(sessionId, {
      type: 'USER_INPUT',
      content: prompt,
      ts: new Date().toISOString()
    });
  } catch (e) {
    console.error('Error appending user input log:', e);
  }

  let child;
  if (agentType === 'claude') {
    const claudeBinary = path.join(os.homedir(), '.local/bin/claude');
    child = spawn(claudeBinary, [
      '--session-id', sessionId,
      '-p', prompt,
      '--output-format', 'stream-json',
      '--verbose',
      '--dangerously-skip-permissions'
    ], {
      cwd: directory,
      env: { ...process.env }
    });

    let stdoutBuffer = '';
    child.stdout.on('data', async (chunk) => {
      stdoutBuffer += chunk.toString('utf8');
      const lines = stdoutBuffer.split('\n');
      stdoutBuffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line);
          if (event.type === 'assistant' && event.message && event.message.content) {
            const textChunks = event.message.content
              .filter((c: any) => c.type === 'text')
              .map((c: any) => c.text)
              .join('');
            if (textChunks) {
              await appendLogEntry(sessionId, {
                type: 'PLANNER_RESPONSE',
                content: textChunks,
                ts: new Date().toISOString()
              });
            }
          } else if (event.type === 'tool_use') {
            await appendLogEntry(sessionId, {
              type: 'TOOL_CALL',
              content: `Calling tool: ${event.name}\nInput: ${JSON.stringify(event.input, null, 2)}`,
              ts: new Date().toISOString()
            });
          } else if (event.type === 'tool_result') {
            await appendLogEntry(sessionId, {
              type: 'TOOL_RESULT',
              content: `Tool result for: ${event.name}\nSuccess: ${!event.is_error}\nOutput: ${event.result || ''}`,
              ts: new Date().toISOString()
            });
          } else if (event.error) {
            await appendLogEntry(sessionId, {
              type: 'error',
              error: event.error,
              ts: new Date().toISOString()
            });
          }
        } catch (e) {
          if (!line.startsWith('Warning:')) {
            await appendLogEntry(sessionId, {
              type: 'PLANNER_RESPONSE',
              content: line,
              ts: new Date().toISOString()
            });
          }
        }
      }
    });
  } else {
    const agyBinary = path.join(os.homedir(), '.local/bin/agy');
    const ptyProcess = pty.spawn(agyBinary, [
      '-i', prompt,
      '--add-dir', directory,
      '--conversation', sessionId,
      ...(options.model ? ['--model', options.model] : []),
    ], {
      name: 'xterm-256color',
      cols: 200,
      rows: 50,
      cwd: directory,
      env: { ...process.env } as { [key: string]: string },
    });
    child = ptyProcess as any;
    session.process = child;

    let outputBuffer = '';
    let debounceTimer: NodeJS.Timeout | null = null;
    let lastOptionWasDenial = false;
    // `agy -i` briefly renders its normal "ready for input" chrome as part
    // of its own startup, before it has actually begun working on the
    // prompt passed via `-i`. That screen is indistinguishable from a real
    // idle/turn-complete screen by `isIdlePrompt` alone, so we don't trust
    // an idle reading until we've observed at least one settled screen that
    // shows the agent actively doing something (generating, running a
    // tool, or showing a menu prompt).
    let turnStarted = false;

    const isLikelyDenial = (label: string) => /^No\b|deny|Deny/.test(label);

    ptyProcess.onData((chunk: string) => {
      outputBuffer += chunk;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        // Each settle point (400ms of no new PTY output) represents one
        // fully-rendered terminal screen. The buffer must be cleared here
        // unconditionally rather than only on a successful match: `agy -i`
        // redraws its whole screen repeatedly while "Generating...", so an
        // unresolved buffer keeps accumulating multiple stale screens back
        // to back, each with their own leftover ">"-prefixed lines (e.g.
        // the echoed prompt). Left unbounded, `parseMenuPrompt` would latch
        // onto the first (stale) cursor-like line instead of the real,
        // current one — confirmed via live testing against `agy -i`.
        const settledBuffer = outputBuffer;
        outputBuffer = '';
        // `agy -i` writes CRLF line endings; strip-ansi only removes ANSI
        // escape codes, not the trailing "\r" on every line. Left in place,
        // that trailing "\r" makes `agy-pty-parser`'s `(.+)$` line-content
        // regexes fail to match at all (JS treats \r as a line terminator,
        // so `.` never consumes it), silently breaking option-label
        // stripping and numbered-choice detection — confirmed via live
        // testing against `agy -i`. Normalizing "\r\n" -> "\n" here (not
        // touching bare mid-line "\r", which agy also uses for in-place
        // spinner redraws) keeps the parser's plain-text contract intact.
        const stripped = stripAnsi(settledBuffer).replace(/\r\n/g, '\n');
        await appendLogEntry(sessionId, { type: 'RAW_PTY_OUTPUT', content: stripped });

        // Check idle *before* menu: after a decision is made, `agy`
        // sometimes emits one last redraw of the now-closed menu (cursor
        // still parked on whatever was last selected) immediately before
        // settling on the idle ready-screen, both within the same settled
        // buffer. A truly pending menu never coexists with the idle screen
        // in the same buffer, so idle wins when both appear to match —
        // otherwise that stale closed-menu redraw gets mistaken for a
        // brand-new prompt and the turn hangs forever waiting on an
        // approval nothing will ever answer — confirmed via live testing.
        if (isIdlePrompt(stripped)) {
          if (!turnStarted) {
            // Startup ready-screen, not a real turn completion. Ignore.
            return;
          }
          if (lastOptionWasDenial) {
            broadcast(sessionId, { type: 'turn_stopped_after_denial' });
          } else {
            broadcast(sessionId, { type: 'turn_complete', code: 0 });
          }
          lastOptionWasDenial = false;
          turnStarted = false;
          return;
        }

        const menuPrompt: MenuPrompt | null = parseMenuPrompt(stripped);
        if (menuPrompt) {
          turnStarted = true;
          const permissionRequest: PendingPermissionRequest = {
            message: menuPrompt.message,
            options: menuPrompt.options.map((o) => o.label),
          };
          session.pendingPermissionRequest = permissionRequest;
          broadcast(sessionId, { type: 'permission_request', ...permissionRequest });
          const chosenIndex = await waitForApproval(sessionId);
          session.pendingPermissionRequest = null;
          lastOptionWasDenial = isLikelyDenial(menuPrompt.options[chosenIndex]?.label ?? '');
          ptyProcess.write(selectionKeystrokes(menuPrompt, chosenIndex));
          return;
        }

        // Neither idle nor a menu prompt: the agent is actively working.
        turnStarted = true;
      }, 400);
    });

    ptyProcess.onExit(({ exitCode }) => {
      session.pendingResolve = null;
      session.pendingPermissionRequest = null;
      broadcast(sessionId, { type: 'turn_complete', code: exitCode });
      session.process = null;
      if (session.controllers.size === 0) {
        activeSessions.delete(sessionId);
      }
    });

    return;
  }

  session.process = child;

  child.stderr.on('data', (data) => {
    const errorStr = data.toString();
    console.error(`Subprocess Stderr [${sessionId}]:`, errorStr);
    broadcast(sessionId, { type: 'error', error: errorStr });
  });

  child.on('close', async (code) => {
    broadcast(sessionId, { type: 'turn_complete', code });
    session.process = null;
    if (session.controllers.size === 0) {
      activeSessions.delete(sessionId);
    }
  });

  child.on('error', (err) => {
    console.error(`Subprocess Spawn Error [${sessionId}]:`, err);
    broadcast(sessionId, { type: 'error', error: err.message });
    session.process = null;
    activeSessions.delete(sessionId);
  });
}

/**
 * Resolves once the user picks an option for the currently pending menu
 * prompt (set by `handleToolApproval`). Used by the `agy` PTY branch to
 * block writing the next line of output until a decision comes in over
 * the /approve route.
 */
function waitForApproval(sessionId: string): Promise<number> {
  const session = getOrCreateSession(sessionId);
  return new Promise<number>((resolve) => {
    session.pendingResolve = resolve;
  });
}

export function handleToolApproval(sessionId: string, optionIndex: number): boolean {
  const session = activeSessions.get(sessionId);
  if (session && session.pendingResolve) {
    session.pendingResolve(optionIndex);
    return true;
  }
  return false;
}
