declare namespace NodeJS {
  interface ProcessEnv {
    /** Base URL of each collection app, including its basePath; `/api/hall-items` is appended. */
    LIBRARY_BOOKS_URL?: string;
    LIBRARY_NOTEBOOKS_URL?: string;
    LIBRARY_RACK_URL?: string;
    LIBRARY_KB_URL?: string;
    /** The vault's topic map, a Markdown table; without it every tag stays its own topic. */
    LIBRARY_TOPIC_MAP?: string;
    /** An Open-Meteo-shaped source for the weather over the hall, or `off`; default Open-Meteo. */
    LIBRARY_WEATHER_URL?: string;
  }
}
