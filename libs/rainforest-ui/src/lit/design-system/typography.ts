import { html } from 'lit';
import { customElement } from 'lit/decorators.js';

import { RfMd3Lit } from '../md3-lit';

@customElement('rf-design-system-typography')
export class RfDesignSystemTypography extends RfMd3Lit {
  override render() {
    return html`
      <div class="prose">
        <h1>Heading 1</h1>
        <h2>Heading 2</h2>
        <h3>Heading 3</h3>
        <h4>Heading 4</h4>
        <p>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
          eiusmod tempor incididunt ut labore et dolore magna aliqua.
        </p>
        <a href="#"> Link to somewhere </a>
        <blockquote>Blockquote example</blockquote>
        <code> function helloWorld() { console.log("Hello, world!"); } </code>
        <pre>
        <code>
          function helloWorld() {
            console.log("Hello, world!");
          }
        </code>
      </pre>
        <ul>
          <li>List item one</li>
          <li>List item two</li>
        </ul>
        <ol>
          <li>Ordered list item one</li>
          <li>Ordered list item two</li>
        </ol>
        <hr />
        <table>
          <thead>
            <tr>
              <th>Header 1</th>
              <th>Header 2</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Data 1</td>
              <td>Data 2</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  }
}
