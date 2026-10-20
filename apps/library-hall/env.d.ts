declare namespace NodeJS {
  interface ProcessEnv {
    /** Base URL of each collection app, including its basePath; `/api/hall-items` is appended. */
    LIBRARY_BOOKS_URL?: string;
    LIBRARY_NOTEBOOKS_URL?: string;
    LIBRARY_RACK_URL?: string;
    LIBRARY_KB_URL?: string;
  }
}
