import { html, LitElement, unsafeCSS } from 'lit';
import { customElement } from 'lit/decorators.js';

import style from './theme.css?inline';

@customElement('rf-tw-lit')
export class RfTwLit extends LitElement {
  static override styles = [unsafeCSS(style)];
  override render() {
    return html`<slot></slot>`;
  }
}
