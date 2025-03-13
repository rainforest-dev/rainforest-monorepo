import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

declare global {
  interface HTMLElementTagNameMap {
    'ai-button': AiButton;
  }
}

@customElement('md-ai-button')
export class AiButton extends LitElement {
  static override styles = css``;

  @property()
  name = 'Rainforest';

  override render() {
    return html`<button>Hey ${this.name}!</button>`;
  }
}
