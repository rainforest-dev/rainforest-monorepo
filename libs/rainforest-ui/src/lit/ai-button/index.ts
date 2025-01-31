import { css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';

import { RfMd3Lit } from '../md3-lit';

declare global {
  interface HTMLElementTagNameMap {
    'rf-ai-button': RfAiButton;
  }
}

@customElement('rf-ai-button')
export class RfAiButton extends RfMd3Lit {
  static override styles = [
    ...super.styles,
    css`
      @reference 'tailwindcss';
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
      <button class="bg-blue-500">Hello <slot></slot> !</button>
    `;
  }
}
