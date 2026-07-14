import { spawn } from 'child_process';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

interface AgentSession {
  process: any;
  controllers: Set<ReadableStreamDefaultController>;
  pendingResolve: ((approved: boolean) => void) | null;
}

const activeSessions = new Map<string, AgentSession>();
const BRAIN_DIR = path.join(os.homedir(), '.gemini/antigravity-cli/brain');

export function getOrCreateSession(sessionId: string): AgentSession {
  if (!activeSessions.has(sessionId)) {
    activeSessions.set(sessionId, {
      process: null,
      controllers: new Set(),
      pendingResolve: null
    });
  }
  return activeSessions.get(sessionId)!;
}

export function addSSEClient(sessionId: string, controller: ReadableStreamDefaultController) {
  const session = getOrCreateSession(sessionId);
  session.controllers.add(controller);
  
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

export async function startAgentSession(sessionId: string, directory: string, prompt: string, agentType = 'agy') {
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
    child = spawn(agyBinary, [
      '--conversation', sessionId,
      '--add-dir', directory,
      '-p', prompt,
      '--dangerously-skip-permissions'
    ], {
      cwd: directory,
      env: { ...process.env }
    });
  }

  session.process = child;

  const logDir = path.join(BRAIN_DIR, sessionId, '.system_generated/logs');
  const logPath = path.join(logDir, 'transcript.jsonl');

  // Start watching from the current file end or 0
  let byteOffset = 0;
  fs.stat(logPath).then((stats) => {
    byteOffset = stats.size;
  }).catch(() => {
    byteOffset = 0;
  });

  const tailInterval = setInterval(async () => {
    try {
      const stats = await fs.stat(logPath);
      if (stats.size > byteOffset) {
        const fileHandle = await fs.open(logPath, 'r');
        const buffer = Buffer.alloc(stats.size - byteOffset);
        await fileHandle.read(buffer, 0, stats.size - byteOffset, byteOffset);
        await fileHandle.close();
        byteOffset = stats.size;

        const text = buffer.toString('utf8');
        const lines = text.split('\n');
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            broadcast(sessionId, { type: event.type, data: event });
          } catch (e) {
            // Skip malformed log line
          }
        }
      }
    } catch (e) {
      // File not created yet
    }
  }, 250);

  child.stderr.on('data', (data) => {
    const errorStr = data.toString();
    console.error(`Subprocess Stderr [${sessionId}]:`, errorStr);
    broadcast(sessionId, { type: 'error', error: errorStr });
  });

  child.on('close', async (code) => {
    clearInterval(tailInterval);

    // Final drain of log file contents
    try {
      const stats = await fs.stat(logPath);
      if (stats.size > byteOffset) {
        const fileHandle = await fs.open(logPath, 'r');
        const buffer = Buffer.alloc(stats.size - byteOffset);
        await fileHandle.read(buffer, 0, stats.size - byteOffset, byteOffset);
        await fileHandle.close();
        byteOffset = stats.size;

        const text = buffer.toString('utf8');
        const lines = text.split('\n');
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            broadcast(sessionId, { type: event.type, data: event });
          } catch (e) {
            // Skip malformed log line
          }
        }
      }
    } catch (e) {
      // File not created yet
    }

    broadcast(sessionId, { type: 'turn_complete', code });
    session.process = null;
    if (session.controllers.size === 0) {
      activeSessions.delete(sessionId);
    }
  });

  child.on('error', (err) => {
    console.error(`Subprocess Spawn Error [${sessionId}]:`, err);
    clearInterval(tailInterval);
    broadcast(sessionId, { type: 'error', error: err.message });
    session.process = null;
    activeSessions.delete(sessionId);
  });
}

export function handleToolApproval(sessionId: string, approved: boolean): boolean {
  const session = activeSessions.get(sessionId);
  if (session && session.pendingResolve) {
    session.pendingResolve(approved);
    return true;
  }
  return false;
}
