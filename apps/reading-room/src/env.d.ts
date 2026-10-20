/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    /** The page's locale, set by the middleware. */
    locale: import('@rainforest-dev/library-contract').LibraryLocale;
  }
}
