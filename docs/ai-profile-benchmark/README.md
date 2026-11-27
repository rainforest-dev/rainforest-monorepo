# AI profile benchmark

Dated snapshots of how AI assistants answer "Who is Rainforest Cheng?", next to what
rainforest.tools serves in `llms.txt` and over `/mcp` on the same day.

```bash
pnpm nx run personal-website:ai-profile-benchmark
```

The script lives in `apps/personal-website/scripts/run-ai-profile-benchmark.ts`. It writes
`docs/ai-profile-benchmark/<Taipei date>/`:

- `site/`: `llms.txt` and the raw JSON-RPC responses from `/mcp` (`tools/list` and the profile
  tools). Requests carry `?src=self` so they stay out of the site's discovery numbers.
- `answers/<assistant>.json` and `.md`: the question, the answer, the model, the tools, and
  the time it was asked.
- `MANUAL.md`: the assistants that cannot run headless, as a checklist.

Every run starts in an empty directory with no personal context loaded. Before anything is
saved, each record's free-text fields have real-name variants replaced with `[redacted-name]`
and personal profile links (GitHub, LinkedIn, CakeResume and similar) replaced with
`[redacted-link]`. A record that still matches a private-data pattern (an email address, a phone
number, a local file path, or a configured marker) is saved as `withheld` with its text removed,
and a failed run stores a fixed message instead of the tool's error output.

The name variants and markers never live in the repo. Pass them as comma-separated
`AI_BENCH_PRIVATE_NAMES` and `AI_BENCH_PRIVATE_MARKERS`, or in the gitignored
`docs/ai-profile-benchmark/.private-markers.json` (`{"names": [], "markers": []}`). The script
refuses to run without at least one name variant.

The Antigravity CLI run (`gemini-agy-web`) is opt-in with `--only gemini-agy-web`. agy has no
flag to drop its user-level instructions or limit its tools to web search, so a page it reads
could steer it into local tools, and it may answer from local context. It runs from an empty
temp directory with `--sandbox`; read its redacted answer before committing it. The
2026-11-27 answer comes from such an opt-in run.

Options: `--only claude-web,gemma-local` picks assistants (the default is every assistant except `gemini-agy-web`), `--no-site` skips the site
snapshot, `--out <dir>` writes elsewhere. `OLLAMA_URL`, `OLLAMA_MODEL` and `AGY_MODEL`
override the defaults.
