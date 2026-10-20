declare namespace NodeJS {
  interface ProcessEnv {
    CALIBRE_LIBRARY_PATH: string;
    CALIBRE_E2E?: string;
    CALIBRE_APP_DB_PATH?: string;
    /** personal-notebook's public URL, base path included; `/notebooks` redirects there. */
    NOTEBOOK_URL?: string;
    /** personal-notebook as this container reaches it, base path included. */
    NOTEBOOK_INTERNAL_URL?: string;
    NOTEBOOK_MCP_SECRET?: string;
  }
}
