declare namespace NodeJS {
  interface ProcessEnv {
    CALIBRE_LIBRARY_PATH: string;
    CALIBRE_E2E?: string;
    CALIBRE_APP_DB_PATH?: string;
    CALIBRE_NOTEBOOKS_DIR?: string;
    CALIBRE_INBOX_SECRET?: string;
  }
}
