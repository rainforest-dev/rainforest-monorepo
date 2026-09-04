#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENGINE=${LOOP_TEST_ENGINE:-"$HERE/../engine"}
eval "$(sed -n '/^new_task_pr()/,/^}/p;/^decide_outcome()/,/^}/p' "$ENGINE/ralph.sh")"
old=$'in-progress\x1fhttps://example.test/pr/1\x1f'
no_pr=$'in-progress\x1f\x1f'
new=$'pr-ready\x1fhttps://example.test/pr/1\x1f'
[ -n "$old" ] && [ -n "$no_pr" ] && [ -n "$new" ]
[ -z "$(new_task_pr "$old" "$old")" ]
[ "$(decide_outcome "$(new_task_pr "$old" "$old")" same '' ok)" = no_progress ]
[ "$(decide_outcome "$(new_task_pr "$old" "$old")" changed '' ok)" = advanced ]
[ "$(new_task_pr "$no_pr" "$new")" = https://example.test/pr/1 ]
[ "$(decide_outcome "$(new_task_pr "$no_pr" "$new")" same "$new" ok)" = reached_stop_at ]
[ -z "$(new_task_pr "$no_pr" "$no_pr")" ]
[ -z "$(new_task_pr '' "$new")" ]
[ -z "$(new_task_pr "$old" "$no_pr")" ]
[ -z "$(new_task_pr "$old" $'in-progress\x1fhttps://example.test/pr/2\x1f')" ]
decision=$(sed -n '/^  task_state_after=/,/^  run_outcome=/p' "$ENGINE/ralph.sh")
[ -n "$decision" ]
task_overlay_state() { printf '%s' "$fixture_after"; }
repo_commits_since() { printf '0'; }
slug=test; task_item_id=T-1; project_path=/unused; iter_started_ts=1
probe_before=0; task_state_before="$old"; fixture_after="$old"
run_pr=https://example.test/pr/old; run_fields=()
eval "$decision"
[ "$run_outcome" = no_progress ] && [ -z "$run_pr" ] && [ "${#run_fields[@]}" -eq 0 ]
task_state_before="$no_pr"; fixture_after="$new"; run_fields=()
eval "$decision"
[ "$run_outcome" = reached_stop_at ] && [ "${run_fields[1]}" = https://example.test/pr/1 ]
probe_before=1; run_fields=()
eval "$decision"
[ "$run_outcome" = unmeasured ] && [ -z "$run_pr" ]
printf 'PASS existing PR is not progress; new overlay PR is; unreadable before does not claim creation\n'
