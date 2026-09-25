export const dayInUrl = () =>
  /^\/day\/(\d{4}-\d{2}-\d{2})\/?$/.exec(location.pathname)?.[1];
