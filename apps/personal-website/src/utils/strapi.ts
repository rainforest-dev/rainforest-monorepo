import { STRAPI_TOKEN, STRAPI_URL } from 'astro:env/server';

interface IProps {
  endpoint: string;
  query?: Record<string, string>;
  wrappedByKey?: string;
  wrappedByList?: boolean;
}

/**
 * Fetches data from the Strapi API
 * @param endpoint - The endpoint to fetch from
 * @param query - The query parameters to add to the url
 * @param wrappedByKey - The key to unwrap the response from
 * @param wrappedByList - If the response is a list, unwrap it
 * @returns
 */
export const fetchApi = async <T>({
  endpoint,
  query,
  wrappedByKey,
  wrappedByList,
}: IProps): Promise<T> => {
  if (endpoint.startsWith('/')) {
    endpoint = endpoint.slice(1);
  }
  const url = new URL(`${STRAPI_URL}/api/${endpoint}`);
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
  }
  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${STRAPI_TOKEN}`,
    },
  });
  let data = await res.json();

  if (wrappedByKey) {
    data = data[wrappedByKey];
  }

  if (wrappedByList) {
    data = data[0];
  }

  return data as T;
};
