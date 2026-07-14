import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import fs from 'fs/promises';
import {
  Bot,
  Brain,
  ChevronDown,
  ChevronUp,
  Copy,
  FolderOpen,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
  User,
} from 'lucide-react';
import os from 'os';
import path from 'path';
import { useEffect, useRef,useState } from 'react';

// UI components from shadcn/ui
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

// Define server-side log reader using TanStack server functions
const fetchSessionHistory = createServerFn({ method: 'GET' })
  .validator((sessionId: string) => sessionId)
  .handler(async ({ data: sessionId }) => {
    const logPath = path.join(
      os.homedir(),
      '.gemini/antigravity-cli/brain',
      sessionId,
      '.system_generated/logs/transcript.jsonl'
    );
    try {
      const data = await fs.readFile(logPath, 'utf8');
      return data
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter(Boolean);
    } catch (e) {
      return [];
    }
  });

export const Route = createFileRoute('/sessions/$sessionId')({
  loader: async ({ params }) => {
    const history = await fetchSessionHistory({ data: params.sessionId });
    return { history };
  },
  component: SessionComponent,
});

function LogMessage({ log }: { log: any }) {
  const [isThinkingExpanded, setIsThinkingExpanded] = useState(false);
  const isUser = log.type === 'USER_INPUT';
  const isAgent = log.type === 'PLANNER_RESPONSE';
  const isError = log.type === 'error';

  const contentText = log.content || log.text || (log.error ? log.error : '');
  const hasContent = !!contentText;
  
  // Decide if content should be collapsible
  const lineCount = contentText.split('\n').length;
  const isLongContent = contentText.length > 500 || lineCount > 10;
  const [isContentExpanded, setIsContentExpanded] = useState(!isLongContent);

  return (
    <div className={`max-w-4xl mx-auto flex gap-4 ${isUser ? 'justify-end' : ''}`}>
      {/* Agent Avatar */}
      {!isUser && (
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
          <Bot className="size-4 text-primary-foreground" />
        </div>
      )}

      <div className={`flex-1 space-y-4 ${isUser ? 'max-w-lg' : ''}`}>
        {/* Thinking Block */}
        {log.thinking && (
          <div className="glass-panel rounded-xl overflow-hidden border border-border">
            <button
              onClick={() => setIsThinkingExpanded(!isThinkingExpanded)}
              className="w-full flex items-center justify-between p-3.5 bg-muted/10 hover:bg-muted/35 text-xs text-muted-foreground font-mono text-left cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2">
                <Brain className="size-4 text-primary" />
                <span className="font-sans font-bold">Thought Process: {log.thinking.split('\n')[0].slice(0, 50)}...</span>
              </div>
              {isThinkingExpanded ? (
                <ChevronUp className="size-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="size-4 text-muted-foreground" />
              )}
            </button>
            {isThinkingExpanded && (
              <div className="p-4 text-xs text-muted-foreground border-t border-border bg-background/40 font-mono italic whitespace-pre-wrap max-h-80 overflow-y-auto leading-relaxed">
                {log.thinking}
              </div>
            )}
          </div>
        )}

        {/* Content Block */}
        {hasContent && (
          <div className={`rounded-xl border ${
            isUser 
              ? 'bg-primary/10 border-primary/25 p-4 text-foreground' 
              : isAgent 
                ? 'glass-panel p-5 rounded-tl-none border-l-2 border-l-primary text-foreground'
                : 'bg-muted border-border font-mono text-sm relative group overflow-hidden'
          }`}>
            {!isUser && !isAgent ? (
              // Code or Tool Execution output template
              <div className="flex flex-col">
                <div className="flex items-center justify-between px-4 py-2 bg-muted border-b border-border">
                  <span className="text-[10px] text-muted-foreground tracking-wider uppercase font-mono">
                    {isError ? '❌ Error Log' : `⚙️ Tool Output // ${log.type}`}
                  </span>
                  <button 
                    onClick={() => navigator.clipboard.writeText(contentText)}
                    className="hover:text-primary transition-colors text-muted-foreground cursor-pointer"
                    title="Copy Output"
                  >
                    <Copy className="size-3.5" />
                  </button>
                </div>
                <div className="relative">
                  <div 
                    className={`p-4 text-xs font-mono whitespace-pre-wrap overflow-hidden leading-relaxed ${
                      isError ? 'text-destructive' : 'text-emerald-400'
                    } ${!isContentExpanded ? 'max-h-[180px]' : ''}`}
                  >
                    {contentText}
                  </div>
                  {!isContentExpanded && (
                    <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-muted to-transparent pointer-events-none" />
                  )}
                </div>
                {isLongContent && (
                  <button
                    onClick={() => setIsContentExpanded(!isContentExpanded)}
                    className="py-2 text-[10px] font-bold text-primary hover:text-primary/80 hover:underline border-t border-border bg-background/20 text-center w-full transition-all"
                  >
                    {isContentExpanded ? 'Collapse Log' : `Reveal Full Log (${lineCount} lines)`}
                  </button>
                )}
              </div>
            ) : (
              // Simple text representation
              <div className="relative">
                <div className={`whitespace-pre-wrap overflow-hidden ${!isContentExpanded ? 'max-h-[220px]' : ''}`}>
                  {contentText}
                </div>
                {!isContentExpanded && (
                  <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background/40 to-transparent pointer-events-none" />
                )}
                {isLongContent && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setIsContentExpanded(!isContentExpanded)}
                    className="h-7 px-3 mt-2 text-xs text-primary hover:text-primary/80 font-semibold cursor-pointer"
                  >
                    {isContentExpanded ? '▲ Collapse Text' : `▼ Expand Text (${lineCount} lines)`}
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* User Avatar */}
      {isUser && (
        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 border border-border">
          <User className="size-4 text-foreground" />
        </div>
      )}
    </div>
  );
}

function SessionComponent() {
  const { sessionId } = Route.useParams();
  const { history: initialHistory } = Route.useLoaderData();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Sidebar and Folder Browser state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isBrowseOpen, setIsBrowseOpen] = useState(false);
  const [browsePath, setBrowsePath] = useState('');
  const [browseData, setBrowseData] = useState<any>(null);
  const [newFolderName, setNewFolderName] = useState('');

  // Fetch projects list
  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await fetch('/api/projects');
      return res.json();
    }
  });

  // Fetch all sessions for sidebar
  const { data: sessionList } = useQuery({
    queryKey: ['sessions'],
    queryFn: async () => {
      const res = await fetch('/api/sessions');
      return res.json();
    }
  });

  const handleBrowse = async (targetPath: string) => {
    try {
      const res = await fetch(`/api/browse?path=${encodeURIComponent(targetPath)}`);
      const data = await res.json();
      setBrowseData(data);
      setBrowsePath(data.currentPath);
    } catch (e) {
      console.error('Error fetching directory listing:', e);
    }
  };

  const joinPath = (base: string, sub: string) => {
    const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
    return `${cleanBase}/${sub}`;
  };

  const createFolderMutation = useMutation({
    mutationFn: async (parentPath: string) => {
      const folderPath = joinPath(parentPath, newFolderName);
      const res = await fetch('/api/browse/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: folderPath })
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success && browseData) {
        handleBrowse(browseData.currentPath);
        setNewFolderName('');
      } else if (data.error) {
        alert('Error creating folder: ' + data.error);
      }
    }
  });

  // Chat message logs state
  const [logs, setLogs] = useState<any[]>(initialHistory);
  const [isRunning, setIsRunning] = useState(false);
  const [inputPrompt, setInputPrompt] = useState('');
  const [projectDir, setProjectDir] = useState('');
  const [agentType, setAgentType] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.localStorage.getItem(`agent_type_${sessionId}`) || 
             window.localStorage.getItem('last_agent_type') || 
             'agy';
    }
    return 'agy';
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(`agent_type_${sessionId}`, agentType);
      window.localStorage.setItem('last_agent_type', agentType);
    }
  }, [agentType, sessionId]);

  useEffect(() => {
    if (sessionList?.sessions) {
      const activeSession = sessionList.sessions.find((s: any) => s.sessionId === sessionId);
      if (activeSession) {
        if (activeSession.agentType) setAgentType(activeSession.agentType);
        if (activeSession.directory) setProjectDir(activeSession.directory);
      }
    }
  }, [sessionList, sessionId]);
  
  // Zero-trust permission request state
  const [pendingPermission, setPendingPermission] = useState<{
    tool: string;
    args: any;
  } | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);


  // Set default workspace directory from environment or prompt
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem('last_project_dir');
      if (stored) setProjectDir(stored);
    }
  }, []);

  // Listen to Server-Sent Events (SSE) from our Node server
  useEffect(() => {
    setLogs(initialHistory);
    setPendingPermission(null);
    setIsRunning(false);

    const eventSource = new EventSource(`/api/sessions/${sessionId}/stream`);

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);

        if (payload.type === 'permission_request') {
          setPendingPermission({
            tool: payload.tool,
            args: payload.args
          });
          setIsRunning(false);
        } else if (payload.type === 'turn_complete') {
          setIsRunning(false);
          setPendingPermission(null);
          queryClient.invalidateQueries({ queryKey: ['sessions'] });
        } else if (payload.type === 'error') {
          setIsRunning(false);
          setPendingPermission(null);
          setLogs(prev => [...prev, {
            type: 'error',
            text: payload.error || 'Subprocess execution encountered an error.',
            ts: new Date().toISOString()
          }]);
        } else if (payload.data) {
          // Append log event
          setLogs(prev => [...prev, payload.data]);
          setIsRunning(true);
        }
      } catch (e) {
        console.error('Error parsing SSE event:', e);
      }
    };

    eventSource.onerror = (err) => {
      console.error('SSE connection error:', err);
      setIsRunning(false);
    };

    return () => {
      eventSource.close();
    };
  }, [sessionId, initialHistory, queryClient]);

  // Auto-scroll logic
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isRunning, pendingPermission]);

  // Submit Prompt Mutation
  const chatMutation = useMutation({
    mutationFn: async ({ prompt, dir }: { prompt: string; dir: string }) => {
      setIsRunning(true);
      setPendingPermission(null);
      const res = await fetch(`/api/sessions/${sessionId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ directory: dir, prompt })
      });
      return res.json();
    },
    onSuccess: () => {
      setInputPrompt('');
    }
  });

  // Submit Tool Permission Approval Mutation
  const approveMutation = useMutation({
    mutationFn: async (approved: boolean) => {
      const res = await fetch(`/api/sessions/${sessionId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: approved })
      });
      return res.json();
    },
    onSuccess: () => {
      setPendingPermission(null);
      setIsRunning(true);
    }
  });

  const handleSend = () => {
    if (!inputPrompt.trim()) return;
    if (!projectDir.trim()) {
      handleBrowse('/Users/rainforest');
      setIsBrowseOpen(true);
      return;
    }
    window.localStorage.setItem('last_project_dir', projectDir);
    chatMutation.mutate({ prompt: inputPrompt, dir: projectDir });
  };

  return (
    <div className="flex flex-1 overflow-hidden bg-background">
      {/* Sessions Sidebar - Desktop Only */}
      <aside 
        className={`hidden md:flex border-r border-border bg-background/40 flex-col gap-4 transition-all duration-300 ${
          isSidebarCollapsed ? 'w-0 p-0 border-r-0 overflow-hidden' : 'w-80 p-4'
        }`}
      >
        <div className="flex justify-between items-center pb-2 border-b border-border/60">
          <span className="text-xs font-bold text-muted-foreground tracking-widest uppercase font-sans">Sessions</span>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => {
              const newId = Math.random().toString(36).substring(2, 15);
              navigate({ to: '/sessions/$sessionId', params: { sessionId: newId } });
            }}
            className="h-8 text-xs cursor-pointer"
          >
            + New Session
          </Button>
        </div>
        
        <ScrollArea className="flex-1 pr-2">
          <div className="space-y-2">
            {sessionList?.sessions?.map((s: any) => {
              const isClaude = s.agentType === 'claude';
              return (
                <Link
                  key={s.sessionId}
                  to="/sessions/$sessionId"
                  params={{ sessionId: s.sessionId }}
                  className={`block p-3.5 rounded-xl border text-left text-xs transition-all ${
                    s.sessionId === sessionId 
                      ? 'bg-primary/10 border-primary/35 text-primary font-semibold' 
                      : 'bg-background/40 border-border hover:border-border text-muted-foreground'
                  }`}
                >
                  <div className="flex justify-between items-center mb-1.5">
                    <span className={`font-mono text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                      isClaude 
                        ? 'bg-amber-950/40 border border-amber-800/40 text-amber-400' 
                        : 'bg-indigo-950/40 border border-indigo-800/40 text-indigo-400'
                    }`}>
                      {isClaude ? 'Claude' : 'Antigravity'}
                    </span>
                    {s.directory && (
                      <span className="font-mono text-[9px] text-muted-foreground truncate max-w-[100px]">
                        📁 {s.directory.split('/').pop()}
                      </span>
                    )}
                  </div>
                  <div className="font-semibold text-xs text-foreground truncate">{s.title || 'Untitled Session'}</div>
                  <div className="font-mono text-[9px] text-muted-foreground truncate mt-0.5">{s.sessionId}</div>
                  <div className="text-[9px] text-muted-foreground mt-1.5 flex items-center justify-between">
                    <span>📅 {new Date(s.lastModified).toLocaleDateString()}</span>
                    <span>{new Date(s.lastModified).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </ScrollArea>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col overflow-hidden bg-background/10">
        {/* Mobile Navigation Header */}
        <div className="flex md:hidden items-center justify-between px-4 py-3 border-b border-border bg-background/60">
          <Dialog>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="text-xs cursor-pointer">
                📁 Sessions
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-popover border-border text-popover-foreground max-w-xs">
              <DialogHeader>
                <DialogTitle className="text-sm font-bold text-foreground">Active Sessions</DialogTitle>
              </DialogHeader>
              <div className="space-y-2 mt-4 max-h-[60vh] overflow-y-auto">
                {sessionList?.sessions?.map((s: any) => {
                  const isClaude = s.agentType === 'claude';
                  return (
                    <Link
                      key={s.sessionId}
                      to="/sessions/$sessionId"
                      params={{ sessionId: s.sessionId }}
                      className={`block p-3 rounded-lg border text-left text-sm transition-all ${
                        s.sessionId === sessionId 
                          ? 'bg-primary/10 border-primary/50 text-primary font-semibold' 
                          : 'bg-muted/30 border-border hover:border-border text-foreground'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className={`font-mono text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${
                          isClaude 
                            ? 'bg-amber-950/40 border-amber-800/40 text-amber-400' 
                            : 'bg-indigo-950/40 border-indigo-800/40 text-indigo-400'
                        }`}>
                          {isClaude ? 'Claude Code' : 'Antigravity'}
                        </span>
                      </div>
                      <div className="font-semibold text-xs text-foreground truncate">{s.title || 'Untitled Session'}</div>
                      <div className="font-mono text-[9px] text-muted-foreground truncate mt-0.5">{s.sessionId}</div>
                    </Link>
                  );
                })}
              </div>
            </DialogContent>
          </Dialog>

          <Button 
            size="sm" 
            variant="outline" 
            className="text-xs cursor-pointer"
            onClick={() => {
              const newId = Math.random().toString(36).substring(2, 15);
              navigate({ to: '/sessions/$sessionId', params: { sessionId: newId } });
            }}
          >
            + New
          </Button>
        </div>
        {/* Workspace directory Configuration */}
        <div className="p-3.5 border-b border-border bg-background/20 flex flex-col md:flex-row gap-3 md:items-center justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="h-8 w-8 text-muted-foreground hover:text-foreground hidden md:inline-flex cursor-pointer shrink-0"
              title={isSidebarCollapsed ? "Show Sessions" : "Hide Sessions"}
            >
              {isSidebarCollapsed ? (
                <PanelLeftOpen className="size-4" />
              ) : (
                <PanelLeftClose className="size-4" />
              )}
            </Button>
            <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">Workspace Path:</span>
            <div className="flex-1 relative">
              <FolderOpen className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={projectDir}
                onChange={(e) => {
                  setProjectDir(e.target.value);
                  window.localStorage.setItem('last_project_dir', e.target.value);
                }}
                placeholder="/Users/rainforest/Repositories/rainforest-homelab"
                className="font-mono text-xs h-8 bg-muted/60 border-border text-foreground pl-8"
              />
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                handleBrowse(projectDir || '/Users/rainforest');
                setIsBrowseOpen(true);
              }}
              className="h-8 text-xs cursor-pointer select-none whitespace-nowrap shrink-0 flex items-center gap-1.5"
            >
              📂 Browse...
            </Button>
          </div>
          
          <div className="flex items-center gap-2 self-end md:self-auto">
            <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">Agent:</span>
            <select
              value={agentType}
              onChange={(e) => setAgentType(e.target.value)}
              className="bg-muted border border-border text-foreground rounded px-2.5 py-1 text-xs h-8 outline-none font-sans cursor-pointer focus:border-primary shrink-0"
            >
              <option value="agy">🪐 Antigravity CLI</option>
              <option value="claude">🤖 Claude Code</option>
            </select>
          </div>
        </div>

        {/* Dynamic Chat view */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {logs.map((log: any, idx: number) => (
            <LogMessage key={idx} log={log} />
          ))}

          {/* Pending Permission Interceptor Overlay/Box */}
          {pendingPermission && (
            <div className="max-w-4xl mx-auto glass-panel p-5 rounded-2xl border-2 border-primary/50 shadow-[0_0_30px_color-mix(in_oklab,var(--primary)_15%,transparent)] animate-pulse space-y-4">
              <h3 className="text-sm font-bold text-primary flex items-center gap-2">
                <ShieldCheck className="size-4 text-primary" strokeWidth={2.5} />
                Action Required: Tool Execution Intercepted
              </h3>
              <div className="text-xs text-foreground space-y-2">
                <span>The agent is requesting permission to execute:</span>
                <div className="font-mono bg-background p-4 rounded-xl border border-border text-foreground whitespace-pre-wrap text-[11px] leading-relaxed">
                  <span className="text-muted-foreground font-bold uppercase block mb-1">
                    {pendingPermission.tool} — execution args
                  </span>
                  {JSON.stringify(pendingPermission.args, null, 2)}
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <Button 
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs h-10 px-5 cursor-pointer shadow-lg shadow-primary/10"
                  onClick={() => approveMutation.mutate(true)}
                >
                  Approve & Execute
                </Button>
                <Button 
                  variant="destructive"
                  className="font-bold text-xs h-10 px-5 cursor-pointer"
                  onClick={() => approveMutation.mutate(false)}
                >
                  Deny & Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Running progress indicator */}
          {isRunning && (
            <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono p-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
              Agent is active and processing workspace commands...
            </div>
          )}

          <div ref={scrollRef} />
        </div>

        {/* Input Bar */}
        <div className="p-4 border-t border-border bg-background/30 flex gap-4">
          <Input
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={isRunning ? "Agent is working..." : "Type instructions (Enter browser path if empty)..."}
            disabled={isRunning}
            className="flex-1 bg-muted/60 border-border text-foreground"
          />
          <Button 
            onClick={handleSend} 
            disabled={isRunning || !inputPrompt.trim()}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
          >
            Send
          </Button>
        </div>
      </main>

      {/* Directory Browser Modal */}
      <Dialog open={isBrowseOpen} onOpenChange={setIsBrowseOpen}>
        <DialogContent className="bg-popover border-border text-popover-foreground max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-foreground">
              Select Workspace / Connect Agent
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {/* Detected Agent Logs Paths */}
            <div className="space-y-2">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold block">
                Detected Agent Log Paths
              </span>
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center p-2 rounded-lg bg-muted/30 border border-border border-dashed text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-amber-500 text-[10px] font-bold">🤖 CLAUDE</span>
                    <span className="font-mono text-[10px] text-muted-foreground">~/.claude/sessions</span>
                  </div>
                  <Button
                    size="sm"
                    variant="link"
                    className="h-auto p-0 text-xs text-primary hover:text-primary/80"
                    onClick={() => {
                      setProjectDir('/Users/rainforest/.claude/sessions');
                      setIsBrowseOpen(false);
                    }}
                  >
                    Connect
                  </Button>
                </div>
                <div className="flex justify-between items-center p-2 rounded-lg bg-muted/30 border border-border border-dashed text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-indigo-500 text-[10px] font-bold">🪐 ANTIGRAVITY</span>
                    <span className="font-mono text-[10px] text-muted-foreground">~/.gemini/antigravity-cli/conversations</span>
                  </div>
                  <Button
                    size="sm"
                    variant="link"
                    className="h-auto p-0 text-xs text-primary hover:text-primary/80"
                    onClick={() => {
                      setProjectDir('/Users/rainforest/.gemini/antigravity-cli/conversations');
                      setIsBrowseOpen(false);
                    }}
                  >
                    Connect
                  </Button>
                </div>
              </div>
            </div>

            {/* Recent projects shortcuts */}
            {projects && projects.length > 0 && (
              <div className="space-y-2">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold block">
                  Recent Workspaces
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-32 overflow-y-auto pr-1">
                  {projects.map((p: any) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setProjectDir(p.path);
                        setIsBrowseOpen(false);
                      }}
                      className="p-2 text-left text-xs bg-muted/40 border border-border hover:border-border rounded transition-all truncate cursor-pointer text-foreground"
                    >
                      <div className="font-semibold text-foreground">{p.name}</div>
                      <div className="text-[10px] text-muted-foreground font-mono truncate mt-0.5">{p.path}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Folder Browser tree */}
            <div className="space-y-2">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold block">
                Browse Filesystem
              </span>
              <div className="flex gap-2">
                <Input
                  value={browsePath}
                  onChange={(e) => setBrowsePath(e.target.value)}
                  className="h-8 text-xs bg-muted/40 border-border text-foreground"
                />
                <Button
                  size="sm"
                  onClick={() => handleBrowse(browsePath)}
                  className="h-8 text-xs cursor-pointer"
                >
                  Go
                </Button>
              </div>

              {browseData && (
                <div className="border border-border rounded bg-muted/10 overflow-hidden">
                  {/* Parent path navigation */}
                  <div className="p-2 border-b border-border bg-background/40 flex items-center justify-between">
                    <span className="text-[10px] font-mono text-muted-foreground truncate max-w-[70%]">
                      📁 {browseData.currentPath}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleBrowse(browseData.parentPath)}
                      disabled={browseData.currentPath === browseData.parentPath}
                      className="h-6 text-[10px] px-2 cursor-pointer gap-1"
                    >
                      ⬆️ Up
                    </Button>
                  </div>
                  {/* Subdirectories */}
                  <div className="max-h-48 overflow-y-auto p-2 grid grid-cols-1 sm:grid-cols-2 gap-1 bg-background/20">
                    {browseData.directories.length === 0 ? (
                      <div className="text-xs text-muted-foreground p-2 col-span-2 text-center">No subdirectories found</div>
                    ) : (
                      browseData.directories.map((dir: string) => (
                        <button
                          key={dir}
                          onClick={() => handleBrowse(joinPath(browseData.currentPath, dir))}
                          className="p-1.5 text-left text-xs text-foreground hover:bg-muted/60 rounded transition-colors truncate cursor-pointer flex items-center gap-1.5"
                        >
                          <span>📁</span>
                          <span className="truncate">{dir}</span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Create new folder inside browser */}
            {browseData && (
              <div className="space-y-2 border-t border-border pt-3">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold block">
                  Create New Folder in Current Path
                </span>
                <div className="flex gap-2">
                  <Input
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="New folder name..."
                    className="h-8 text-xs bg-muted/40 border-border text-foreground"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => createFolderMutation.mutate(browseData.currentPath)}
                    disabled={!newFolderName.trim() || createFolderMutation.isPending}
                    className="h-8 text-xs cursor-pointer"
                  >
                    ➕ Create
                  </Button>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsBrowseOpen(false)}
                className="text-xs cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  if (browseData) {
                    setProjectDir(browseData.currentPath);
                    window.localStorage.setItem('last_project_dir', browseData.currentPath);
                  }
                  setIsBrowseOpen(false);
                }}
                className="text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold cursor-pointer"
              >
                Select Folder
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
