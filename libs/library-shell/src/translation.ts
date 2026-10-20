/**
 * The shape another locale's dictionary must have: every key of the source, every leaf a
 * string. Typecheck then fails on a key one locale has and the other lacks.
 */
export type Translation<T> = {
  [K in keyof T]: T[K] extends string ? string : Translation<T[K]>;
};
