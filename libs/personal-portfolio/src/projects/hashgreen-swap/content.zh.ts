import type { CaseStudyTranslation } from '../../content/types';

// 繁體中文草稿 —— 供潤稿使用。程式碼片段、符號名稱與產品名稱維持英文；缺漏欄位 fallback 回英文。
export const hashgreenSwapZh: CaseStudyTranslation = {
  tagline:
    '用於 Chia CAT 代幣的 AMM swap 介面，建構於 Project Pyke 交易所後端之上。',
  role: '前端工程師 · Hashgreen Labs',
  period: '2023 – 至今',
  sections: {
    'swapping-on-a-logarithmic-curve': {
      title: '在對數曲線上做兌換',
      feature:
        '輸入金額就得到即時報價 —— 最低可得、價格衝擊、手續費 —— 兩個方向都行，exact-in 或 exact-out。',
      contribution:
        '兌換引擎由我打造。我把 Pyke 的 AMM 定價從實作論文搬進一個純函式，並串起兩個報價方向 —— exact-out 是把同一條不變式反解，不是另一套近似。',
      tech: 'Pyke 不是常數乘積（`x·y=k`）—— `utils/swap.ts` 裡的 `calcUserSwap` 解的是一條對數空間的不變式，帶有池手續費 `φ` 與安全邊界 `ε = 1e-5`；價格衝擊是 `|1 − actual/spot|`。這個函式每按一鍵都在前端跑一次。',
    },
    'sign-once-settle-on-chain': {
      title: '簽一次，鏈上結算',
      feature:
        '沒有中心化掛單簿也能成交：瀏覽器組出一張已簽名的 Chia offer，由鏈上結算，介面則追蹤它直到確認。',
      contribution:
        '我把三個錢包後端統一在單一的 `IWallet.createOffer` 介面之後 —— Goby、Hoogii，以及透過 WalletConnect 的 Chia —— 讓 app 永遠不需要知道是哪個錢包簽的，我也在其上打造了近期交易的追蹤器。',
      tech: '一次兌換就是一張在錢包裡以 BLS 金鑰簽名的 Chia `offer`；`CLVM` 的 puzzle-reveal bundle 在前端組出，接著這張 offer 會走 `VALID → IN_MEMPOOL → ON_CHAIN` —— `INVALID` 代表它花用的某個 coin 已先被別處用掉。',
    },
    'one-sided-liquidity-pool-share-math': {
      title: '單邊流動性，池佔比的計算',
      feature:
        '新增流動性 —— 包含 Zap，單一資產的存入 —— 一邊輸入，一邊顯示池佔比與鑄出的 LP。',
      contribution:
        '我打造了流動性表單，以及那個把兩筆存入鎖在池比例上的配對輸入 hook，接著是把它們收合成單一輸入、做單邊存入的 Zap 開關。',
      tech: '在平衡模式下，`useAssetInputPair` 會把另一邊釘在儲備比例上；Zap 則在鑄造前先轉換一部分資產 —— 這也是為什麼後端把 `add_liquidity` 與 `add_liquidity_zap` 記成不同的交易類型。',
    },
    'shipping-it-one-image-four-environments': {
      title: '上線：一個 image，四個環境',
      feature:
        '同一個容器 image 在 Kubernetes 上被逐步推送到 sandbox → UAT → staging → prod，每個環境各有自己的設定與自動擴縮。',
      contribution:
        '交付由我負責 —— 那個把 Next standalone 產物打包成非 root 容器的多階段 Dockerfile、帶有各環境 values 的 Helm chart，以及負責 build、push 與 helm-upgrade 的 GitHub Actions。',
      tech: "build 是 `base → deps → builder → runner`，基於 `node:20-alpine`；一個 `ARG` 選擇 `.env.{uat|stg|sandbox|prod}`，`output: 'standalone'` 讓 image 保持精簡，runner 則降權到 uid 1001。",
    },
    'one-library-three-languages': {
      title: '一套元件庫，三種語言',
      feature:
        '每個頁面都重用同一套基礎元件與 token，介面能在執行期切換 英文 / 簡體 / 繁體中文 —— 不需重新載入。',
      contribution:
        '我打造了 app 所使用的共用 `@hashgreen/ui-libraries` 套件，並以 chained backend 串起 `next-i18next`，讓語言能原地切換、不需往返伺服器。',
      tech: '語言走 `i18next-chained-backend` —— 先 localStorage、後 HTTP —— 各命名空間的 JSON 放在 `public/locales/{en,zh-CN,zh-TW}`，而顏色與文字 token 只在共用套件裡定義一次。',
    },
  },
};
