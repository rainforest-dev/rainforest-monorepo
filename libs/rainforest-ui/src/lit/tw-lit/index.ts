import { html, LitElement, unsafeCSS } from 'lit';
import { customElement } from 'lit/decorators.js';

import style from './theme.css?inline';

declare global {
  interface HTMLElementTagNameMap {
    'rf-tw-lit': RfTwLit;
  }
}

@customElement('rf-tw-lit')
export class RfTwLit extends LitElement {
  static override styles = [unsafeCSS(style.replaceAll(':root', ':host'))];
  override render() {
    return html`<slot class="text-red-500"></slot>`;
  }
}
