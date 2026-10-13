export const LABELLED_TERMS: Record<string, string[]> = {
  資料庫: ['experience/5', 'skill/fastapi', 'skill/express'],
  backend: ['skill/express', 'skill/fastapi', 'skill/nodejs', 'skill/python'],
  後端: ['skill/express', 'skill/fastapi', 'skill/nodejs', 'skill/python'],
  區塊鏈: [
    'project/hashgreen-dex',
    'project/hashgreen-swap',
    'project/hoogii-wallet',
  ],
  錢包: ['project/hoogii-wallet'],
  容器化: ['skill/docker'],
  持續整合: ['skill/github-actions'],
  'infrastructure as code': ['skill/terraform'],
  自動化測試: ['project/opencgt', 'experience/6'],
  前端框架: ['skill/vue', 'skill/nextjs'],
  機器學習: ['skill/python'],
  天氣: ['post/quick-posts/weather-forecast'],
  可訪問性: ['post/quick-posts/keyboard-enter'],
  'css framework': [
    'post/quick-posts/skeleton',
    'post/quick-posts/tailwindcss-lit',
    'post/deconstruct-personal-website/theming',
  ],
  靜態類型: ['skill/ts'],
  monorepo: ['skill/nx', 'post/deconstruct-personal-website/project-init'],
  構建工具: ['skill/vite'],
  跨平台: ['skill/flutter'],
  'web components': ['post/quick-posts/tailwindcss-lit'],
  實習生: ['experience/4', 'experience/5'],
};

export const OUT_OF_VOCABULARY = [
  'database',
  'kubernetes',
  '加密貨幣',
  'dark mode',
  '深色模式',
  '端對端測試',
  'e2e',
  'cryptocurrency',
  'rust',
  '伺服器端',
];

export const EVAL_QUERIES = [
  ...Object.keys(LABELLED_TERMS),
  ...OUT_OF_VOCABULARY,
];
