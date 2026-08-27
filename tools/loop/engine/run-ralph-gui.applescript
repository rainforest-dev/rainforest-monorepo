-- Run ralph through the logged-in GUI session.
--
-- On Air, a launchd-spawned process cannot read ~/Library/Mobile Documents:
-- probed 2026-08-25 with a throwaway LaunchAgent, `ls` on the vault's task
-- folder returned DENIED while the same command through `osascript` returned 42
-- files. mini has the grant and needs no shim; Air does not, and its two
-- enrolled projects read notion-tasks.json out of the vault.
--
-- This is the same mechanism the retired icloud-mirror used, applied to the
-- process that needs the access rather than to a copy of the files. Nothing is
-- duplicated: ralph reads the vault in place.
--
-- `do shell script` runs under a login shell with no job-control TTY, so ralph's
-- stdin is closed explicitly -- an executor that reads stdin would otherwise park
-- the whole run on a pipe that never delivers.
on run
	set vaultPath to "/Users/rainforest/Library/Mobile Documents/iCloud~md~obsidian/Documents/rainforest-obsidian"
	set agentConfig to vaultPath & "/_system/usage/loop-agents.json"
	do shell script "LOOP_MACHINE=Angibles-MacBook-Air " & ¬
		"LOOP_EXECUTORS=claude,codex,agy " & ¬
		"LOOP_VAULT_PATH=" & quoted form of vaultPath & " " & ¬
		"LOOP_AGENT_CONFIG=" & quoted form of agentConfig & " " & ¬
		"PATH=/Users/rainforest/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin " & ¬
		"/bin/bash /Users/rainforest/.claude/loop/ralph.sh 1 10 </dev/null " & ¬
		">>/Users/rainforest/.claude/loop/ralph.log " & ¬
		"2>>/Users/rainforest/.claude/loop/ralph.err.log"
end run
