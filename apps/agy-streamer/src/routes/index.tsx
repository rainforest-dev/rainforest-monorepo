import { useMutation,useQuery } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Cable, CheckCircle2, FolderOpen, Play, PlusSquare, Radio, ShieldCheck, TerminalSquare } from 'lucide-react';
import { useState } from 'react';

// UI components from shadcn/ui
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

export const Route = createFileRoute('/')({
  component: DashboardComponent,
});

function DashboardComponent() {
  const navigate = useNavigate();
  const [newProjectDir, setNewProjectDir] = useState('');
  const [agentType, setAgentType] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.localStorage.getItem('last_agent_type') || 'agy';
    }
    return 'agy';
  });

  // Folder Browser state
  const [isBrowseOpen, setIsBrowseOpen] = useState(false);
  const [browsePath, setBrowsePath] = useState('');
  const [browseData, setBrowseData] = useState<any>(null);
  const [newFolderName, setNewFolderName] = useState('');

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

  // Fetch all sessions
  const { data: sessionList, isLoading } = useQuery({
    queryKey: ['sessions'],
    queryFn: async () => {
      const res = await fetch('/api/sessions');
      return res.json();
    }
  });

  // Fetch local project configurations
  const { data: projectList } = useQuery<{ id: string; name: string; path: string }[]>({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await fetch('/api/projects');
      return res.json();
    }
  });

  const handleStartSession = () => {
    if (!newProjectDir.trim()) return;
    const newSessionId = Math.random().toString(36).substring(2, 15);
    
    // Save last used dir
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('last_project_dir', newProjectDir);
      window.localStorage.setItem('last_agent_type', agentType);
      window.localStorage.setItem(`agent_type_${newSessionId}`, agentType);
    }
    
    navigate({
      to: '/sessions/$sessionId',
      params: { sessionId: newSessionId }
    });
  };
  return (
    <main className="flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-10 max-w-7xl mx-auto w-full space-y-8 pb-24">
      {/* Connection Health Section */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Card 1: Daemon Connection */}
        <div className="glass-card p-5 rounded-xl transition-all hover:-translate-y-0.5">
          <div className="flex justify-between items-start mb-4">
            <span className="text-muted-foreground text-xs font-bold uppercase tracking-wider">Daemon Connection</span>
            <Radio className="size-4 text-emerald-400" strokeWidth={2.5} />
          </div>
          <div className="flex items-end gap-3 mb-4">
            <span className="text-3xl font-bold text-foreground font-sans tracking-tight">12ms</span>
            <span className="text-emerald-400 text-xs font-semibold mb-1">99.8% Uptime</span>
          </div>
          <div className="h-10 flex items-end gap-1 px-1">
            <div className="w-full bg-emerald-500/10 h-6 rounded-t-sm"></div>
            <div className="w-full bg-emerald-500/20 h-8 rounded-t-sm"></div>
            <div className="w-full bg-emerald-500/30 h-5 rounded-t-sm"></div>
            <div className="w-full bg-emerald-500/40 h-7 rounded-t-sm"></div>
            <div className="w-full bg-emerald-500/60 h-9 rounded-t-sm"></div>
            <div className="w-full bg-emerald-500 h-10 rounded-t-sm"></div>
          </div>
        </div>

        {/* Card 2: Docker Proxy */}
        <div className="glass-card p-5 rounded-xl transition-all hover:-translate-y-0.5">
          <div className="flex justify-between items-start mb-4">
            <span className="text-muted-foreground text-xs font-bold uppercase tracking-wider">Docker Proxy</span>
            <Cable className="size-4 text-primary" strokeWidth={2.5} />
          </div>
          <div className="space-y-1">
            <div className="text-foreground text-sm font-semibold">Tunnel Established</div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-mono font-bold text-foreground">4.2</span>
              <span className="text-muted-foreground text-xs font-semibold">MB/s Sync Rate</span>
            </div>
          </div>
          <div className="mt-4 w-full bg-muted h-1.5 rounded-full overflow-hidden">
            <div className="bg-primary h-full w-[64%]"></div>
          </div>
        </div>

        {/* Card 3: Zero-Trust Auth */}
        <div className="glass-card p-5 rounded-xl transition-all hover:-translate-y-0.5 sm:col-span-2 lg:col-span-1">
          <div className="flex justify-between items-start mb-4">
            <span className="text-muted-foreground text-xs font-bold uppercase tracking-wider">Session Watcher</span>
            <ShieldCheck className="size-4 text-amber-400" strokeWidth={2.5} />
          </div>
          <div className="space-y-1">
            <div className="text-emerald-400 text-sm font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="size-3.5" /> Node Authorized
            </div>
            <div className="text-2xl font-mono font-bold text-foreground">Automatic Sync</div>
            <div className="text-muted-foreground text-xs">monitoring local workspace actions</div>
          </div>
        </div>
      </section>

      {/* Main Grid: Control Panel vs Session List */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Side: Create / Connect Panel */}
        <div className="lg:col-span-5 space-y-6">
          <div className="glass-card p-6 rounded-2xl relative overflow-hidden">
            <div className="absolute -right-20 -top-20 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none"></div>
            <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
              <PlusSquare className="size-4 text-primary" />
              New Stream Session
            </h2>

            <div className="space-y-5">
              {/* Agent Selector */}
              <div className="flex flex-col gap-2">
                <label className="text-xs text-muted-foreground font-medium">Target Agent Engine</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAgentType('agy')}
                    className={`flex-1 text-xs py-2.5 rounded-lg border font-semibold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      agentType === 'agy'
                        ? 'bg-indigo-600/20 border-indigo-500/60 text-indigo-200'
                        : 'bg-background border-border text-muted-foreground hover:border-border'
                    }`}
                  >
                    🪐 Antigravity CLI
                  </button>
                  <button
                    type="button"
                    onClick={() => setAgentType('claude')}
                    className={`flex-1 text-xs py-2.5 rounded-lg border font-semibold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      agentType === 'claude'
                        ? 'bg-amber-600/20 border-amber-500/60 text-amber-200'
                        : 'bg-background border-border text-muted-foreground hover:border-border'
                    }`}
                  >
                    🤖 Claude Code
                  </button>
                </div>
              </div>

              {/* Path Selector */}
              <div className="flex flex-col gap-2">
                <label className="text-xs text-muted-foreground font-medium">Workspace Path Directory</label>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <FolderOpen className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={newProjectDir}
                      onChange={(e) => setNewProjectDir(e.target.value)}
                      placeholder="e.g. /Users/rainforest/Repositories/rainforest-homelab"
                      className="w-full bg-background/80 border-border pl-9 text-foreground text-xs font-mono h-10"
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      handleBrowse(newProjectDir || '/Users/rainforest');
                      setIsBrowseOpen(true);
                    }}
                    className="h-10 text-xs cursor-pointer gap-1"
                  >
                    Browse...
                  </Button>
                </div>
              </div>

              {/* Start Button */}
              <Button
                onClick={handleStartSession}
                disabled={!newProjectDir.trim()}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold h-10 cursor-pointer shadow-lg shadow-primary/20 active:scale-95 transition-all"
              >
                Provision Stream Node
              </Button>
            </div>
          </div>

          {/* Quick Connect Shortcuts */}
          {projectList && projectList.length > 0 && (
            <div className="glass-card p-6 rounded-2xl">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Quick Connect Workspaces</h3>
              <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1">
                {projectList.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setNewProjectDir(p.path)}
                    className={`p-3 text-left border rounded-xl transition-all cursor-pointer truncate ${
                      newProjectDir === p.path
                        ? 'bg-primary/10 border-primary text-primary'
                        : 'bg-background/40 border-border hover:border-border text-muted-foreground'
                    }`}
                  >
                    <div className="font-semibold text-xs text-foreground">{p.name}</div>
                    <div className="text-[10px] text-muted-foreground font-mono truncate mt-0.5">{p.path}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Active / Historical Sessions */}
        <div className="lg:col-span-7 space-y-4">
          <h2 className="text-md font-bold text-foreground flex items-center gap-2">
            <TerminalSquare className="size-4 text-primary" />
            Active Coding Sessions
          </h2>

          {isLoading ? (
            <div className="text-xs text-muted-foreground font-mono py-6 text-center">Loading sessions list...</div>
          ) : !sessionList?.sessions || sessionList.sessions.length === 0 ? (
            <div className="text-xs text-muted-foreground font-mono py-8 border border-dashed border-border rounded-xl text-center">
              No active session nodes found. Initialize a new stream above!
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 max-h-[40rem] overflow-y-auto pr-1">
              {sessionList.sessions.map((s: any) => {
                const isClaude = s.agentType === 'claude';
                return (
                  <div
                    key={s.sessionId}
                    className={`glass-card p-5 rounded-xl border-l-4 transition-all hover:-translate-y-0.5 cursor-pointer flex flex-col justify-between h-44 ${
                      isClaude ? 'border-l-amber-500' : 'border-l-indigo-500'
                    }`}
                    onClick={() => navigate({ to: '/sessions/$sessionId', params: { sessionId: s.sessionId } })}
                  >
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className={`font-mono text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                          isClaude
                            ? 'bg-amber-950/40 border border-amber-800/40 text-amber-400'
                            : 'bg-indigo-950/40 border border-indigo-800/40 text-indigo-400'
                        }`}>
                          {isClaude ? 'Claude Code' : 'Antigravity'}
                        </span>
                        {s.directory && (
                          <span className="font-mono text-[10px] text-muted-foreground truncate max-w-[120px]">
                            📁 {s.directory.split('/').pop()}
                          </span>
                        )}
                      </div>
                      <h4 className="text-sm font-semibold text-foreground line-clamp-2 leading-snug">{s.title || 'Untitled Session'}</h4>
                      <p className="font-mono text-[9px] text-muted-foreground truncate opacity-70">{s.sessionId}</p>
                    </div>

                    <div className="flex justify-between items-center border-t border-border/60 pt-3 mt-3">
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {new Date(s.lastModified).toLocaleDateString()} {new Date(s.lastModified).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <button className="text-xs bg-primary/25 hover:bg-primary/40 text-primary px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1 active:scale-95 transition-all">
                        <Play className="size-3.5" /> Resume
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Directory Browser Modal */}
      <Dialog open={isBrowseOpen} onOpenChange={setIsBrowseOpen}>
        <DialogContent className="bg-popover border-border text-popover-foreground max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-foreground">
              Select Workspace Folder
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
                      setNewProjectDir('/Users/rainforest/.claude/sessions');
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
                      setNewProjectDir('/Users/rainforest/.gemini/antigravity-cli/conversations');
                      setIsBrowseOpen(false);
                    }}
                  >
                    Connect
                  </Button>
                </div>
              </div>
            </div>

            {/* Recent projects shortcuts */}
            {projectList && projectList.length > 0 && (
              <div className="space-y-2">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold block">
                  Recent Workspaces
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-32 overflow-y-auto pr-1">
                  {projectList.map((p: any) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setNewProjectDir(p.path);
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
                <div className="border border-border rounded-lg bg-muted/10 overflow-hidden">
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
                    setNewProjectDir(browseData.currentPath);
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
    </main>
  );
}
