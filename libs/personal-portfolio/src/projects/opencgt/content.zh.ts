import type { CaseStudyTranslation } from '../../content/types';

// 繁體中文草稿 —— 供潤稿使用。程式碼片段、符號名稱與產品名稱維持英文；缺漏欄位 fallback 回英文。
export const opencgtZh: CaseStudyTranslation = {
  tagline:
    '一個把細胞與基因治療從頭到尾串起來的管理平台 —— 病患的 Chain-of-Identity、物料與運送追蹤，以及在彼此之間交接療程的醫院與製造商組織。',
  role: '資深前端工程師 · CodeGreen',
  period: '2024 — 至今',
  sections: {
    'the-front-door-a-token-that-already-knows-your-role': {
      title: '大門：一個已經知道你角色的 token',
      feature:
        '一個「登入」交棒給 Auth0，回來時 app 就已經知道組織角色 —— 不需要另一支權限查詢。',
      contribution:
        'auth 由我負責 —— NextAuth + Auth0 的設定，以及在 jwt/session callback 裡從 access token 讀出角色的決定，讓元件能同步讀到角色、不需額外往返。',
      tech: 'Auth0 的 roles claim 鍵並不穩定，所以 `getRolesFromJwt()` 會 base64url 解出 payload、掃描含有「roles」的鍵，再把比對收斂到 `RoleEnum` —— hospital_admin、manufacturer_admin、root。',
    },
    'one-deployment-two-products': {
      title: '一次部署，兩個產品',
      feature:
        '醫院與製造商人員登入同一套部署，卻看到本質不同的 app —— 而被禁止的路由會回傳真正的 404，不會外洩。',
      contribution:
        '角色感知的外殼由我打造：每個側邊欄項目都包在 Refine 的 <CanAccess> 裡，讓導覽由政策算出，再加上一段 middleware 在伺服器端把不允許的路由改寫到 /not-found。',
      tech: '兩道必須一致的關卡 —— 用戶端的 `<CanAccess>` 與 `middleware.ts` 的伺服器改寫。app 甚至把 `@synopsis/@hospital` 與 `@synopsis/@manufacturer` 拆開，讓每個產品是自己的區段。',
    },
    'the-rule-behind-the-gate-a-casbin-playground': {
      title: '關卡背後的規則：一個 Casbin 沙盒',
      feature:
        '授權就是一個 Casbin model，在用戶端與伺服器端以完全相同的方式評估 —— 所以每個判斷都可解釋、可稽核。',
      contribution:
        '雙重把關的策略由我設計：一個本地的 casbin-core enforcer 立刻回答常見情況，被拒絕的則落到持有完整政策集的遠端授權器。',
      tech: "matcher 是 `g(r.sub, p.sub) && keyMatch(r.obj, p.obj) && (p.act == '*' || regexMatch(r.act, p.act))` —— 物件以路徑前綴比對、動作以 regex 比對，`*` 為萬用字元。",
    },
    'encrypted-before-it-leaves-the-browser': {
      title: '在離開瀏覽器之前就加密',
      feature:
        '在建檔過程中，病患的 PHI 會在瀏覽器裡加密；每個組織被授予「phi」或「non-phi」，而只有正確的私鑰才能讀取。伺服器永遠只存密文。',
      contribution:
        '我實作了 WebCrypto 的端到端加密工具，以及建檔時的存取控制步驟 —— 那個決定「誰能解密什麼」的 useFieldArray 介面。',
      tech: '是混合式，而非純 RSA：紀錄本體以 `AES-CBC` 加密，而 AES 金鑰與 IV 再以各接收者的公鑰 `RSA-OAEP-2048` 包裹 —— 大筆紀錄依然快，而讀取權限則綁定在私鑰上。',
    },
    'build-only-what-changed': {
      title: '只 build 改動到的部分',
      feature:
        '一條 Nx pipeline 只出貨一次改動所觸及的專案 —— PR 上跑 affected 的測試與 build，main 上則是簽章 image 推送與 Helm rollout，並由依角色劃分的 Playwright e2e 與一個 k6 負載測試把關。',
      contribution:
        '我專注在最貼近 app 的部分 —— 把 nx affected 與 tag 排除串起來、容器 build 設定，以及兩套測試：Playwright 以各角色登入，k6 讓真實的 VU 走過實際的 Auth0 登入逐步加壓。',
      tech: '它是由 Nx 的專案圖驅動，而非一張工作清單 —— `nx-set-shas` 算出 base/head，`nx affected` 走訪整張圖。k6 的瀏覽器測試在 100 個逐步加壓的 VU 下驅動真實的 Auth0 表單，並斷言 `1.00` 的 checks 通過率。',
    },
  },
};
