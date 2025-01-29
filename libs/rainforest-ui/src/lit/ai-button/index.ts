import { css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';

import { RfTwLit } from '../tw-lit';

declare global {
  interface HTMLElementTagNameMap {
    'rf-ai-button': AiButton;
  }
}

@customElement('rf-ai-button')
export class AiButton extends RfTwLit {
  static override styles = [
    ...super.styles,
    css`
      .button {
        background-color: var(--md-sys-color-primary);
        color: var(--md-sys-color-on-primary);
        padding: 8px 16px;
        border-radius: 4px;
      }
    `,
  ];

  @property()
  name = 'Rainforest';

  override render() {
    return html`
      <button class="button">Hey ${this.name}!</button>
      <button class="appearence-none bg-blue-500">Hello <slot></slot> !</button>
    `;
  }
}
