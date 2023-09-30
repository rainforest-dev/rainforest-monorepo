import { html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { TwLitElement } from '@rainforest-tools/design-system/components/lit';

@customElement('my-element')
export class MyElement extends TwLitElement {
  @property() name;

  constructor() {
    super();
    this.name = 'World';
  }

  render() {
    return html`
      <p class="text-cyan-500">Hello, ${this.name}!</p>
      <input
        .value=${this.name}
        @input=${this.changeName}
        placeholder="Enter your name"
      />
    `;
  }

  changeName(e: Event) {
    console.log(e);
    this.name = (e.target as HTMLInputElement).value;
  }
}
