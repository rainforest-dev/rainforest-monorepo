// Diagnostic-only, temporary: a maximally minimal Vercel Function with zero
// imports from our own code or any dependency, to isolate whether the
// "SyntaxError: Unexpected token 'const'" runtime crash is caused by
// something in our source/dependencies, or is a more fundamental issue with
// this project/runtime that affects any function at all. Remove once diagnosed.
export default {
  fetch() {
    return new Response('pong');
  },
};
