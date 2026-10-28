import { getCollection } from '@rainforest-dev/library-contract';

/**
 * Where the reading room answers on the library hostname. It owns two mounts, `/rack` and
 * `/kb`, so it uses no Astro `base`: every page and API route lives under one of them.
 */
export const RACK_PATH = getCollection('rack').basePath;
export const KB_PATH = getCollection('kb').basePath;

/** The registry desk: sources, topics and the reading-queue table. */
export const SOURCES_PATH = `${RACK_PATH}/sources`;

export const rackApi = (name: string): string => `${RACK_PATH}/api/${name}`;

/** The magazine rack: exhibitions and markets, a collection of its own under the rack. */
export const EVENTS_PAGE_PATH = getCollection('magazines').basePath;
