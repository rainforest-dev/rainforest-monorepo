import type { CaseStudyTranslation } from '../../content/types';

// 繁體中文草稿 —— 供潤稿使用。程式碼片段、符號名稱與產品名稱維持英文；缺漏欄位 fallback 回英文。
export const hashgreenDexZh: CaseStudyTranslation = {
  tagline:
    '以 Next.js 打造的掛單簿交易所，用於交易 Chia CAT 代幣，具備各市場獨立路由與即時掛單簿。',
  role: '前端工程師 · Hashgreen Labs',
  period: '2022 – 至今',
  sections: {
    '500-cats-one-searchable-list': {
      title: '500+ 個 CAT，一份可搜尋的清單',
      feature:
        '分頁、可模糊搜尋的市場清單，能捲動五百多個資產，卻只掛載螢幕上看得到的列。',
      contribution:
        '前端由我主導，這份清單也由我負責。我拒絕在渲染速度和可搜尋性之間二選一，所以疊了三個彼此獨立的機制 —— 視窗化、延遲抓取、模糊評分 —— 各自解決一個面向。Fuse 的 threshold 刻意設為 0.1：代號很短、容易碰撞。',
      tech: '`TableVirtuoso` 只掛載視野內的列；`MarketStore` 用 `onBecomeObserved`/`onBecomeUnobserved`，讓某個市場在有人觀察前先不抓資料；`Fuse` 以 `threshold: 0.1` 對貨幣代號與名稱評分。',
    },
    'reading-the-book-without-acting-on-a-ghost': {
      title: '讀盤，但不對已消失的價位下手',
      feature:
        '即時的買/賣掛單簿，點某個價位會開出摘要面板，而當該價位移出盤面時會立刻關閉。',
      contribution:
        '我守住一條不變式：交易者絕不能對一個已經移動的價位下手。錨定在某列的 tooltip，當那列被取代時，是一個一級事件、會關掉 popover —— 而不是渲染時的事後補救。',
      tech: "一個對帳的 `useEffect` 以 `key(market, price, amount, total)` 為每個價位編鍵，一旦這個 key 不再對應到當前盤面中的任何項目，就立刻清掉選取 —— 這正是正式介面裡那個分辨買賣方向的 `react-popper` tooltip 所依賴的同一條不變式，以免錨定到一列早已不存在的資料。",
    },
    'fetch-once-then-stream': {
      title: '先抓一次，然後串流',
      feature:
        '統計數據與成交流水先用 REST 載入一次，再透過單一訂閱轉為即時 —— 還有一個會反映 socket 狀態的小圓點。',
      contribution:
        '我把串流做成一份可重用的契約。每個即時畫面都以同樣方式 hydrate —— 一次 REST、再一個 hook —— 每個訂閱在 unmount 時拆除，頻道改變時再乾淨地重新訂閱。',
      tech: '一個 `useAbly({ channelName, events, callback })` hook 掌管整個訂閱生命週期；`ablyIndicator` 讀取 Ably 的連線狀態來驅動那個小圓點。',
    },
    'one-state-machine-three-wallets': {
      title: '一個狀態機，三個錢包',
      feature:
        '透過 WalletConnect 連接 Goby、Hoogii 或 Chia —— 全都收斂成同一個縮短的地址與同一個已連線狀態。',
      contribution:
        '我以單一事實來源 —— WalletStageEnum —— 來架構這一切，而不是一堆散落的布林值。WalletConnect 的配對是它自己明確的一個階段，因為配對可能被拒絕或逾時，而這些必須是一級狀態，不是事後補上的錯誤處理。',
      tech: '一個小小的階段機 —— `Unspecified → Initial → Pairing → Connected` —— 疊在各錢包的 `Wallet` 類別之上；已連線的帳戶對外提供 `shortenAddress` 與 `iconUrl`。',
    },
    'patch-one-row-or-refetch-the-page': {
      title: '修補一列，還是重抓整頁？',
      feature:
        '即時的委託歷史 —— 可分頁、可篩選 —— 會逐一事件決定要重抓整頁還是修補一列。',
      contribution:
        '同步策略由我負責。真正的問題是：一筆即時更新，是否還屬於你正在看的這一頁。只有當事件改變了頁面歸屬時才重抓；否則就原地修補那一列，其餘一概不動。',
      tech: '一個以頁為鍵的快取，由一個 scope 在 `auth.id` 的 Ably 頻道餵資料。每個事件會跑 `needRefetch()` = `checkMarket && checkStatus && checkDateRange`；當它為 false 時，`checkUserOrderCached()` 只把那一列原地替換掉。',
    },
  },
};
