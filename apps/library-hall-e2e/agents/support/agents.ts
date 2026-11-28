import { anthropic } from '@ai-sdk/anthropic';
import { claudeCode } from '@e2e-dev/acp';
import type { E2EConfig } from 'e2e';

/**
 * Model calls go straight to Anthropic with `ANTHROPIC_API_KEY`. With `E2E_EXECUTOR=claude-code`
 * the steps run on the local Claude Code login instead, and `waitFor` and `extract` are
 * unavailable because they need a model.
 */
const model = anthropic(process.env['E2E_MODEL'] ?? 'claude-sonnet-5-5');
const viaClaudeCode = process.env['E2E_EXECUTOR'] === 'claude-code';
const runner = (system?: string) =>
  viaClaudeCode
    ? { executor: claudeCode({ model: 'sonnet', ...(system && { system }) }) }
    : { model, ...(system && { system }) };

/** Words every model call reads, judges included. */
const context = `
The app is "Rainforest 圖書館", a personal library at library.rainforest.tools. Its pages read in
Traditional Chinese unless the reader switches to English with the language button.
- 大廳 (hall) is a 3D room at "/" with one wing per collection: 書 (books), 筆記本 (notebooks),
  報架 (rack, saved web articles) and 知識庫 (knowledge base). Each wing has a sign and bookcases.
- 分櫃方式 is the control that regroups bookcases: 依主題 (by topic), 依館藏 (by collection),
  依系列, 依作者／來源 (by author, or the site an article came from), 依時間 (by the month it entered the library). Regrouping animates bookcases rising and sinking.
- 視角向左轉 / 視角向右轉 / 回到預設視角 turn or reset the camera. Dragging the 3D view turns it too.
- 以清單瀏覽 shows the same bookcases as a plain list. On a phone the hall starts as that list and
  進入 3D 大廳 loads the 3D room.
- Every app shares one top bar: the library name, the collection switcher, a library-wide search
  and the language switch. On a phone the collection switcher moves to a bottom tab bar.
`;

export const agents: E2EConfig['agents'] = {
  default: { ...runner(), context },
  // A bug-bash persona: `e2e explore --agent newcomer '<goal>'`.
  newcomer: {
    ...runner(
      'You are opening this library for the first time. Report anything confusing, broken or ' +
        'inconsistent between pages, with the steps that show it.',
    ),
    context,
  },
};
