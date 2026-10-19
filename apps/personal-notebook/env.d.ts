declare namespace NodeJS {
  interface ProcessEnv {
    NOTEBOOK_DATA_DIR?: string;
    NOTEBOOK_IMPORT_FROM?: string;
    NOTEBOOK_INBOX_SECRET?: string;
    NOTEBOOK_MCP_SECRET?: string;
  }
}
