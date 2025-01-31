import { html } from 'lit';
import { customElement } from 'lit/decorators.js';

import { RfMd3Lit } from '../md3-lit';

const primary = [
  [
    'primary',
    'bg-primary text-on-primary',
    'bg-on-primary text-primary',
    'bg-primary-container text-on-primary-container',
    'bg-on-primary-container text-primary-container',
  ],
  [
    'secondary',
    'bg-secondary text-on-secondary',
    'bg-on-secondary text-secondary',
    'bg-secondary-container text-on-secondary-container',
    'bg-on-secondary-container text-secondary-container',
  ],
  [
    'tertiary',
    'bg-tertiary text-on-tertiary',
    'bg-on-tertiary text-tertiary',
    'bg-tertiary-container text-on-tertiary-container',
    'bg-on-tertiary-container text-tertiary-container',
  ],
  [
    'error',
    'bg-error text-on-error',
    'bg-on-error text-error',
    'bg-error-container text-on-error-container',
    'bg-on-error-container text-error-container',
  ],
];

const primaryFixed = [
  [
    'primary',
    'bg-primary-fixed text-on-primary-fixed',
    'bg-primary-fixed-dim text-on-primary-fixed-dim',
    'bg-on-primary-fixed text-primary-fixed',
    'bg-on-primary-fixed-variant text-primary-fixed',
  ],
  [
    'secondary',
    'bg-secondary-fixed text-on-secondary-fixed',
    'bg-secondary-fixed-dim text-on-secondary-fixed-dim',
    'bg-on-secondary-fixed text-secondary-fixed',
    'bg-on-secondary-fixed-variant text-secondary-fixed',
  ],
  [
    'tertiary',
    'bg-tertiary-fixed text-on-tertiary-fixed',
    'bg-tertiary-fixed-dim text-on-tertiary-fixed-dim',
    'bg-on-tertiary-fixed text-tertiary-fixed',
    'bg-on-tertiary-fixed-variant text-tertiary-fixed',
  ],
];

@customElement('rf-design-system-colors')
export class RfDesignSystemColors extends RfMd3Lit {
  override render() {
    return html`
      <div class="grid grid-cols-4 gap-8 capitalize text-xs">
        ${primary.map(
          ([name, ...items]) => html`
            <div class="flex flex-col gap-4">
              <ul class="flex flex-col *:odd:h-16 *:even:h-8 *:p-1">
                ${items.map((classes, index) => {
                  const titles = [
                    name,
                    `on ${name}`,
                    `${name} container`,
                    `on ${name} container`,
                  ];
                  return html`
                    <li class="${classes} ${index % 2 ? 'h-8' : 'h-16'} p-1">
                      ${titles[index]}
                    </li>
                  `;
                })}
              </ul>
              <ul class="grid grid-cols-2">
                ${primaryFixed
                  .find((item) => item[0] === name)
                  ?.slice(1)
                  .map((classes, index) => {
                    const titles = [
                      `${name} fixed`,
                      `${name} fixed dim`,
                      `on ${name} fixed`,
                      `on ${name} fixed variant`,
                    ];
                    return html`
                      <li
                        class="${classes} first:h-16 nth-2:h-16 first:col-span-1 nth-2:col-span-1 col-span-2 h-8 p-1"
                      >
                        ${titles[index]}
                      </li>
                    `;
                  })}
              </ul>
            </div>
          `
        )}
        <div class="flex flex-col col-span-3">
          ${[
            [
              ['surface dim', 'bg-surface-dim text-on-surface'],
              ['surface', 'bg-surface text-on-surface'],
              ['surface bright', 'bg-surface-bright text-on-surface'],
            ],
            [
              [
                'surface container lowest',
                'bg-surface-container-lowest text-on-surface',
              ],
              [
                'surface container low',
                'bg-surface-container-low text-on-surface',
              ],
              ['surface container', 'bg-surface-container text-on-surface'],
              [
                'surface container high',
                'bg-surface-container-high text-on-surface',
              ],
              [
                'surface container highest',
                'bg-surface-container-highest text-on-surface',
              ],
            ],
            [
              ['on surface', 'bg-on-surface text-surface'],
              ['on surface variant', 'bg-on-surface-variant text-surface'],
              ['outline', 'bg-outline text-surface'],
              ['outline variant', 'bg-outline-variant text-surface'],
            ],
          ].map(
            (row) => html`
              <ul class="flex h-16">
                ${row.map(
                  ([title, classes]) => html`
                    <li class="${classes} p-1 flex-1">${title}</li>
                  `
                )}
              </ul>
            `
          )}
        </div>
        <ul class="grid grid-cols-2 h-full">
          ${[
            ['inverse surface', 'bg-inverse-surface text-inverse-on-surface'],
            [
              'inverse on surface',
              'bg-inverse-on-surface text-inverse-surface',
            ],
            ['inverse primary', 'bg-inverse-primary text-primary'],
            ['scrim', 'bg-scrim text-inverse-on-surface'],
            ['shadow', 'bg-shadow text-inverse-on-surface'],
          ].map(
            ([name, classes]) =>
              html`
                <li
                  class="${classes} flex-1 p-1 col-span-2 last:col-span-1 nth-last-2:col-span-1"
                >
                  ${name}
                </li>
              `
          )}
        </ul>
      </div>
    `;
  }
}
