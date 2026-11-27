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

Every run starts in an empty directory with no personal context loaded. An answer that
matches a private-data pattern (an email address, a phone number, a local file path, or a
marker passed in `AI_BENCH_PRIVATE_MARKERS`) is saved as `withheld` with its text removed.

Options: `--only claude-web,gemma-local` picks assistants, `--no-site` skips the site
snapshot, `--out <dir>` writes elsewhere. `OLLAMA_URL`, `OLLAMA_MODEL` and `AGY_MODEL`
override the defaults.
