import type { CaseStudy } from './types';

export const hoogiiWallet: CaseStudy = {
  slug: 'hoogii-wallet',
  variant: 'hoogii',
  title: 'Hoogii Wallet',
  tagline:
    'A browser-extension wallet for the Chia blockchain — send, receive and manage XCH and CATs, and review transaction history.',
  role: 'Frontend Engineer · Hashgreen Labs',
  period: '2022 – Present',
  stack: ['React', 'Tailwind CSS', 'Mobx', 'react-i18next', 'Ably'],
  sections: [
    {
      id: 'typing-a-wallet-into-existence',
      title: 'Typing a wallet into existence',
      feature:
        'A 12-cell backup-phrase grid that validates each word as you type and accepts a whole pasted phrase.',
      contribution:
        'I built the custom phrase input, and made the call to open create and import in a full browser tab instead of the 360-pixel popup — key material deserves room to breathe.',
      tech: "The grid is a `react-hook-form` `useFieldArray`. A cell turns red only when it is non-empty and missing from the BIP39 `wordlist_en.json` set — a membership test, never a network call. Paste splits on spaces and distributes across the remaining cells.",
      interaction: 'phrase-grid',
      sourceRef: 'src/components/Mnemonic.tsx · src/store/MnemonicStore.ts',
    },
    {
      id: 'finding-a-token-before-you-finish-typing-it',
      title: 'Finding a token before you finish typing it',
      feature:
        'A typo-tolerant fuzzy filter over the CAT list, tuned strict so it behaves like asset selection, not web search.',
      contribution:
        'I owned the search surface and the tuning call: threshold 0.1 on purpose, plus a multi-token $and query so "usd coin" narrows instead of widening.',
      tech: 'Search is `fuse.js` configured in `utils/fuse.ts` with `threshold: 0.1` and `includeScore`. The query is rebuilt as an `$and` of tokens, each an OR across the keys, then results sort by score. It runs over an already-live array — never a fetch per keystroke.',
      interaction: 'fuzzy-search',
      sourceRef: 'src/utils/fuse.ts · src/components/SearchBar.tsx',
    },
    {
      id: 'the-ledger-that-updates-itself',
      title: 'The ledger that updates itself',
      feature:
        'History and balances that update themselves — an incoming coin appears on its own, no polling.',
      contribution:
        'This was the realtime layer I built — a channel per wallet, refetch on message, and enough defensiveness that a flaky socket degrades quietly instead of taking the screen down.',
      tech: "The channel name is literally `'0x' + puzzleHash`, so each wallet listens only on its own hash. `Ably.tsx` is a try/catch around `useChannel` that returns an empty fragment — a dropped socket logs and the UI stays up.",
      interaction: 'live-ledger',
      sourceRef: 'src/components/Ably.tsx',
    },
    {
      id: 'what-locking-actually-does',
      title: 'What locking actually does',
      feature:
        'Encrypt the phrase at rest, require the password to unlock, auto-lock when the machine goes idle.',
      contribution:
        "I owned the lock lifecycle: the seed is never decrypted at rest, the password lives only in ephemeral session memory, and auto-lock leans on the browser's own idle signal rather than a timer I'd have to babysit.",
      tech: '`encryption.ts` derives an `AES-GCM` key with `PBKDF2` · SHA-512 · 100,000 iterations · 32-byte salt. Auto-lock hooks `chrome.idle.setDetectionInterval`, not `setInterval` — real input resets the countdown.',
      interaction: 'idle-lock',
      sourceRef: 'src/utils/encryption.ts',
    },
    {
      id: 'when-a-website-asks-the-wallet-to-sign',
      title: 'When a website asks the wallet to sign',
      feature:
        'A website asks the wallet to sign; the request crosses three script contexts and comes back a signature.',
      contribution:
        'This is the core of what I owned — built with one other engineer: inject the provider, relay every request across page, content and background, gate by lock and connection state, then show a signature a human can actually read.',
      tech: 'A request crosses three contexts. The injected script exposes `window.chia.hoogii`; the background enforces a fixed gate order — `IS_VALID_WALLET` → `IS_LOCK` → `IS_CONNECTED` — before forwarding. `signCoinSpends` raises the popup, which renders the spend bundle as an expandable tree via react-json-view-lite.',
      interaction: 'relay-gate',
      sourceRef:
        'src/injected-scripts/index.ts · src/background/index.ts · src/popup/',
    },
  ],
};
