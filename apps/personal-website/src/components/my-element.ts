import { html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { TwLitElement } from '@rainforest-tools/design-system/components/lit';
import '@material/web/button/filled-button';
import '@material/web/textfield/outlined-text-field';
import { startRegistration } from '@simplewebauthn/browser';

@customElement('my-element')
export class MyElement extends TwLitElement {
  @property() name;

  constructor() {
    super();
    this.name = 'rainforest';
  }

  render() {
    return html`
      <div class="flex items-center gap-2">
        <md-outlined-text-field
          .label="Hello, ${this.name}!"
          .value=${this.name}
          @input=${this.changeName}
          placeholder="Enter your name"
        ></md-outlined-text-field>
        <md-filled-button @click=${this.register}>Register</md-filled-button>
      </div>
    `;
  }

  changeName(e: Event) {
    console.log(e);
    this.name = (e.target as HTMLInputElement).value;
  }

  async register() {
    console.log('register', this.name);
    const options = await (
      await fetch('http://localhost:3000/passkey/register/options', {
        body: JSON.stringify({ username: this.name }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      })
    ).json();
    console.log(options);
    const registrationResponse = await startRegistration(options);
    console.log(registrationResponse);
    const result = await (
      await fetch('http://localhost:3000/passkey/register', {
        body: JSON.stringify({
          username: this.name,
          data: registrationResponse,
        }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      })
    ).json();
    console.log(result);
  }
}
