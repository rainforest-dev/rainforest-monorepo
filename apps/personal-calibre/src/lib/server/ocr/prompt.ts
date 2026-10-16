/**
 * The instruction sent with every page image. Tested on 2026-10-15 against qwen3-vl 8B, gemma4,
 * Claude and Gemini; `parseOcr` reads the format it asks for.
 */
export const OCR_PROMPT = `這是一頁手寫的子彈筆記（Bullet Journal），內容是繁體中文夾雜英文。請逐字轉寫，不要翻譯、不要改寫、不要補字，看不清楚的字寫成 [?]。只輸出下面格式：

DATE: 頁面上寫的日期，格式 YYYY-MM-DD；一頁有多個日期就全部列出，用逗號分隔；沒有就寫 none
PAGE: 右下角或左下角的頁碼數字；沒有就寫 none
HEADINGS: 頁面上的標題（例如星期幾、日期列），一行一個

TEXT:
逐行轉寫正文。保留每行開頭的符號：• 任務、x 已完成、> 已轉移、< 已排程、○ 事件、= 或 - 筆記。縮排的子項目前面加兩個空格。只用繁體中文，不要轉成簡體。`;
