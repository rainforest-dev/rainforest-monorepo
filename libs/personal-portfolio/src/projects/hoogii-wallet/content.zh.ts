import type { CaseStudyTranslation } from '../../content/types';

// 繁體中文草稿 —— 供潤稿使用。程式碼片段（反引號）、符號名稱與產品名稱（Hoogii、
// Chia、XCH、CAT、BIP39、Ably…）維持英文。缺漏的欄位會自動 fallback 回英文。
export const hoogiiWalletZh: CaseStudyTranslation = {
  tagline:
    'Chia 區塊鏈的瀏覽器擴充套件錢包 —— 收發與管理 XCH 和 CAT 資產，並檢視交易紀錄。',
  role: '前端工程師 · Hashgreen Labs',
  period: '2022 – 至今',
  sections: {
    'typing-a-wallet-into-existence': {
      title: '把錢包一個字一個字打出來',
      feature:
        '12 格的助記詞輸入區，一邊輸入一邊逐字驗證，也能一次貼上整組助記詞。',
      contribution:
        '我打造了這個自訂的助記詞輸入元件，並決定讓「建立」與「匯入」流程開在完整的瀏覽器分頁，而不是 360 像素的彈出視窗 —— 攸關資產安全的關鍵資訊，值得更寬裕的空間。',
      tech: '這個格狀輸入是一個 `react-hook-form` 的 `useFieldArray`。只有當某一格「非空、且不在 BIP39 的 `wordlist_en.json` 字集裡」時才會變紅 —— 這是一次集合比對，絕不打網路請求。貼上時會以空白切分，並自動分配到剩餘的格子。',
    },
    'finding-a-token-before-you-finish-typing-it': {
      title: '還沒打完就先找到代幣',
      feature:
        '針對 CAT 清單的容錯模糊搜尋，刻意調得嚴格，讓它像在「挑資產」而不是「網路搜尋」。',
      contribution:
        '搜尋介面與調校策略由我負責：threshold 刻意設為 0.1，再加上多詞的 `$and` 查詢，讓「usd coin」是收斂而不是發散。',
      tech: '搜尋使用 `fuse.js`，設定在 `utils/fuse.ts`，`threshold: 0.1` 並開啟 `includeScore`。查詢會重組成多個詞的 `$and`，每個詞再對各欄位做 OR，最後依分數排序。它跑在一個已在記憶體裡的即時陣列上 —— 絕不會每按一鍵就 fetch 一次。',
    },
    'the-ledger-that-updates-itself': {
      title: '會自己更新的帳本',
      feature:
        '交易紀錄與餘額會自己更新 —— 一筆入帳的 coin 會自動出現，不需輪詢。',
      contribution:
        '這是我打造的即時層 —— 每個錢包一個頻道、收到訊息就重抓，並做足防禦，讓不穩的連線安靜地降級，而不是把整個畫面拖垮。',
      tech: "頻道名稱就是 `'0x' + puzzleHash`，所以每個錢包只監聽自己的 hash。`Ably.tsx` 是包在 `useChannel` 外的 try/catch，回傳空片段 —— 連線斷掉時會記錄下來，但畫面照常運作。",
    },
    'what-locking-actually-does': {
      title: '「鎖定」實際上做了什麼',
      feature:
        '靜態時加密助記詞、解鎖需要密碼、機器閒置時自動上鎖。',
      contribution:
        '鎖定的生命週期由我負責：種子在靜態時從不解密、密碼只存在於短暫的 session 記憶體、自動上鎖依靠瀏覽器本身的閒置訊號，而不是我得自己盯著的計時器。',
      tech: '`encryption.ts` 以 `PBKDF2` · SHA-512 · 100,000 次迭代 · 32-byte salt 推導出 `AES-GCM` 金鑰。自動上鎖掛在 `chrome.idle.setDetectionInterval` 上，而不是 `setInterval` —— 真實的輸入會重置倒數。',
    },
    'when-a-website-asks-the-wallet-to-sign': {
      title: '當網站請錢包簽名時',
      feature:
        '網站請錢包簽名；這個請求會跨越三個 script 環境，再帶著一個簽名回來。',
      contribution:
        '這是我負責的核心 —— 與另一位工程師一起打造：注入 provider、讓每個請求在 page、content、background 之間轉送、依「上鎖」與「連線」狀態把關，最後把簽名內容以人看得懂的方式呈現。',
      tech: '一個請求會跨越三個環境。注入的 script 對外提供 `window.chia.hoogii`；background 在轉送前會強制固定的把關順序 —— `IS_VALID_WALLET` → `IS_LOCK` → `IS_CONNECTED`。`signCoinSpends` 會叫出彈窗，並用 react-json-view-lite 把 spend bundle 呈現成可展開的樹狀結構。',
    },
  },
};
