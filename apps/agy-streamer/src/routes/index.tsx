import { useMutation,useQuery } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
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
            <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Daemon Connection</span>
            <span className="material-symbols-outlined text-emerald-400 font-bold" style={{ fontVariationSettings: "'FILL' 1" }}>sensors</span>
          </div>
          <div className="flex items-end gap-3 mb-4">
            <span className="text-3xl font-bold text-slate-100 font-sans tracking-tight">12ms</span>
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
            <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Docker Proxy</span>
            <span className="material-symbols-outlined text-indigo-400 font-bold" style={{ fontVariationSettings: "'FILL' 1" }}>settings_input_component</span>
          </div>
          <div className="space-y-1">
            <div className="text-slate-200 text-sm font-semibold">Tunnel Established</div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-mono font-bold text-slate-100">4.2</span>
              <span className="text-slate-400 text-xs font-semibold">MB/s Sync Rate</span>
            </div>
          </div>
          <div className="mt-4 w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
            <div className="bg-indigo-500 h-full w-[64%]"></div>
          </div>
        </div>

        {/* Card 3: Zero-Trust Auth */}
        <div className="glass-card p-5 rounded-xl transition-all hover:-translate-y-0.5 sm:col-span-2 lg:col-span-1">
          <div className="flex justify-between items-start mb-4">
            <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Session Watcher</span>
            <span className="material-symbols-outlined text-amber-400 font-bold" style={{ fontVariationSettings: "'FILL' 1" }}>verified_user</span>
          </div>
          <div className="space-y-1">
            <div className="text-emerald-400 text-sm font-semibold flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm">check_circle</span> Node Authorized
            </div>
            <div className="text-2xl font-mono font-bold text-slate-100">Automatic Sync</div>
            <div className="text-slate-400 text-xs">monitoring local workspace actions</div>
          </div>
        </div>
      </section>

      {/* Main Grid: Control Panel vs Session List */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Side: Create / Connect Panel */}
        <div className="lg:col-span-5 space-y-6">
          <div className="glass-card p-6 rounded-2xl relative overflow-hidden">
            <div className="absolute -right-20 -top-20 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>
            <h2 className="text-lg font-bold text-slate-100 mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-indigo-400">add_box</span>
              New Stream Session
            </h2>

            <div className="space-y-5">
              {/* Agent Selector */}
              <div className="flex flex-col gap-2">
                <label className="text-xs text-slate-400 font-medium">Target Agent Engine</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAgentType('agy')}
                    className={`flex-1 text-xs py-2.5 rounded-lg border font-semibold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      agentType === 'agy'
                        ? 'bg-indigo-600/20 border-indigo-500/60 text-indigo-200'
                        : 'bg-slate-950 border-slate-900 text-slate-500 hover:border-slate-800'
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
                        : 'bg-slate-950 border-slate-900 text-slate-500 hover:border-slate-800'
                    }`}
                  >
                    🤖 Claude Code
                  </button>
                </div>
              </div>

              {/* Path Selector */}
              <div className="flex flex-col gap-2">
                <label className="text-xs text-slate-400 font-medium">Workspace Path Directory</label>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-500 text-sm">folder_open</span>
                    <Input
                      value={newProjectDir}
                      onChange={(e) => setNewProjectDir(e.target.value)}
                      placeholder="e.g. /Users/rainforest/Repositories/rainforest-homelab"
                      className="w-full bg-slate-950/80 border-slate-900 pl-9 text-slate-200 text-xs font-mono h-10"
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
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold h-10 cursor-pointer shadow-lg shadow-indigo-600/20 active:scale-95 transition-all"
              >
                Provision Stream Node
              </Button>
            </div>
          </div>

          {/* Quick Connect Shortcuts */}
          {projectList && projectList.length > 0 && (
            <div className="glass-card p-6 rounded-2xl">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Quick Connect Workspaces</h3>
              <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1">
                {projectList.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setNewProjectDir(p.path)}
                    className={`p-3 text-left border rounded-xl transition-all cursor-pointer truncate ${
                      newProjectDir === p.path
                        ? 'bg-indigo-600/10 border-indigo-500 text-indigo-300'
                        : 'bg-slate-950/40 border-slate-900 hover:border-slate-800 text-slate-400'
                    }`}
                  >
                    <div className="font-semibold text-xs text-slate-200">{p.name}</div>
                    <div className="text-[10px] text-slate-500 font-mono truncate mt-0.5">{p.path}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Active / Historical Sessions */}
        <div className="lg:col-span-7 space-y-4">
          <h2 className="text-md font-bold text-slate-300 flex items-center gap-2">
            <span className="material-symbols-outlined text-indigo-400">terminal</span>
            Active Coding Sessions
          </h2>

          {isLoading ? (
            <div className="text-xs text-slate-500 font-mono py-6 text-center">Loading sessions list...</div>
          ) : !sessionList?.sessions || sessionList.sessions.length === 0 ? (
            <div className="text-xs text-slate-500 font-mono py-8 border border-dashed border-slate-900 rounded-xl text-center">
              No active session nodes found. Initialize a new stream above!
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
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
                          <span className="font-mono text-[10px] text-slate-500 truncate max-w-[120px]">
                            📁 {s.directory.split('/').pop()}
                          </span>
                        )}
                      </div>
                      <h4 className="text-sm font-semibold text-slate-200 line-clamp-2 leading-snug">{s.title || 'Untitled Session'}</h4>
                      <p className="font-mono text-[9px] text-slate-500 truncate opacity-70">{s.sessionId}</p>
                    </div>

                    <div className="flex justify-between items-center border-t border-slate-900/60 pt-3 mt-3">
                      <span className="text-[10px] text-slate-500 font-mono">
                        {new Date(s.lastModified).toLocaleDateString()} {new Date(s.lastModified).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <button className="text-xs bg-indigo-600/25 hover:bg-indigo-600/40 text-indigo-300 px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1 active:scale-95 transition-all">
                        <span className="material-symbols-outlined text-[14px]">play_arrow</span> Resume
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
        <DialogContent className="bg-slate-950 border-slate-900 text-slate-100 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-slate-200">
              Select Workspace Folder
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {/* Detected Agent Logs Paths */}
            <div className="space-y-2">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block">
                Detected Agent Log Paths
              </span>
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center p-2 rounded-lg bg-slate-900/30 border border-slate-900 border-dashed text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-amber-500 text-[10px] font-bold">🤖 CLAUDE</span>
                    <span className="font-mono text-[10px] text-slate-400">~/.claude/sessions</span>
                  </div>
                  <Button
                    size="sm"
                    variant="link"
                    className="h-auto p-0 text-xs text-indigo-400 hover:text-indigo-300"
                    onClick={() => {
                      setNewProjectDir('/Users/rainforest/.claude/sessions');
                      setIsBrowseOpen(false);
                    }}
                  >
                    Connect
                  </Button>
                </div>
                <div className="flex justify-between items-center p-2 rounded-lg bg-slate-900/30 border border-slate-900 border-dashed text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-indigo-500 text-[10px] font-bold">🪐 ANTIGRAVITY</span>
                    <span className="font-mono text-[10px] text-slate-400">~/.gemini/antigravity-cli/conversations</span>
                  </div>
                  <Button
                    size="sm"
                    variant="link"
                    className="h-auto p-0 text-xs text-indigo-400 hover:text-indigo-300"
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
                <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block">
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
                      className="p-2 text-left text-xs bg-slate-900/40 border border-slate-900 hover:border-slate-800 rounded transition-all truncate cursor-pointer text-slate-300"
                    >
                      <div className="font-semibold text-slate-200">{p.name}</div>
                      <div className="text-[10px] text-slate-500 font-mono truncate mt-0.5">{p.path}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Folder Browser tree */}
            <div className="space-y-2">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block">
                Browse Filesystem
              </span>
              <div className="flex gap-2">
                <Input
                  value={browsePath}
                  onChange={(e) => setBrowsePath(e.target.value)}
                  className="h-8 text-xs bg-slate-900/40 border-slate-900 text-slate-200"
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
                <div className="border border-slate-900 rounded-lg bg-slate-900/10 overflow-hidden">
                  {/* Parent path navigation */}
                  <div className="p-2 border-b border-slate-900 bg-slate-950/40 flex items-center justify-between">
                    <span className="text-[10px] font-mono text-slate-400 truncate max-w-[70%]">
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
                  <div className="max-h-48 overflow-y-auto p-2 grid grid-cols-1 sm:grid-cols-2 gap-1 bg-slate-950/20">
                    {browseData.directories.length === 0 ? (
                      <div className="text-xs text-slate-600 p-2 col-span-2 text-center">No subdirectories found</div>
                    ) : (
                      browseData.directories.map((dir: string) => (
                        <button
                          key={dir}
                          onClick={() => handleBrowse(joinPath(browseData.currentPath, dir))}
                          className="p-1.5 text-left text-xs text-slate-300 hover:bg-slate-900/60 rounded transition-colors truncate cursor-pointer flex items-center gap-1.5"
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
              <div className="space-y-2 border-t border-slate-900 pt-3">
                <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block">
                  Create New Folder in Current Path
                </span>
                <div className="flex gap-2">
                  <Input
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="New folder name..."
                    className="h-8 text-xs bg-slate-900/40 border-slate-900 text-slate-200"
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
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-900">
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
                className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-semibold cursor-pointer"
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
