import { adoptStyles, LitElement, unsafeCSS } from 'lit';

import style from './index.css?inline';

declare global {
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  export type LitMixin<T = unknown> = new (...args: any[]) => T & LitElement;
}

const stylesheet = unsafeCSS(style);

export const TW = <T extends LitMixin>(superClass: T): T =>
  class extends superClass {
    override connectedCallback() {
      super.connectedCallback();
      this.shadowRoot && adoptStyles(this.shadowRoot, [stylesheet]);
    }
  };

export const TwLitElement = TW(LitElement);
