import { html } from 'lit';
import { customElement } from 'lit/decorators.js';

import { RfMd3Lit } from '../md3-lit';

@customElement('rf-design-system-colors')
export class RfDesignSystemColors extends RfMd3Lit {
  override render() {
    return html`
      <div class="grid grid-cols-4 gap-8 capitalize text-xs">
        <div class="flex flex-col gap-4">
          <ul class="flex flex-col *:odd:h-16 *:even:h-8 *:p-1">
            <li class="bg-primary text-on-primary">primary</li>
            <li class="bg-on-primary text-primary">on primary</li>
            <li class="bg-primary-container text-on-primary-container">
              primary container
            </li>
            <li class="bg-on-primary-container text-primary-container">
              on primary container
            </li>
          </ul>
          <ul
            class="flex flex-col *:first:h-16 *:first:*:p-1 *:not-first:h-8 *:not-first:p-1"
          >
            <li class="flex *:flex-1">
              <div class="bg-primary-fixed text-on-primary-fixed">
                primary fixed
              </div>
              <div class="bg-primary-fixed-dim text-on-primary-fixed-dim">
                primary fixed dim
              </div>
            </li>
            <li class="bg-on-primary-fixed text-primary-fixed">
              on primary fixed
            </li>
            <li class="bg-on-primary-fixed-variant text-primary-fixed">
              on primary fixed variant
            </li>
          </ul>
        </div>
        <div class="flex flex-col gap-4">
          <ul class="flex flex-col *:odd:h-16 *:even:h-8 *:p-1">
            <li class="bg-secondary text-on-secondary">secondary</li>
            <li class="bg-on-secondary text-secondary">on secondary</li>
            <li class="bg-secondary-container text-on-secondary-container">
              secondary container
            </li>
            <li class="bg-on-secondary-container text-secondary-container">
              on secondary container
            </li>
          </ul>
          <ul
            class="flex flex-col *:first:h-16 *:first:*:p-1 *:not-first:h-8 *:not-first:p-1"
          >
            <li class="flex *:flex-1">
              <div class="bg-secondary-fixed text-on-secondary-fixed">
                secondary fixed
              </div>
              <div class="bg-secondary-fixed-dim text-on-secondary-fixed-dim">
                secondary fixed dim
              </div>
            </li>
            <li class="bg-on-secondary-fixed text-secondary-fixed">
              on secondary fixed
            </li>
            <li class="bg-on-secondary-fixed-variant text-secondary-fixed">
              on secondary fixed variant
            </li>
          </ul>
        </div>
        <div class="flex flex-col gap-4">
          <ul class="flex flex-col *:odd:h-16 *:even:h-8 *:p-1">
            <li class="bg-tertiary text-on-tertiary">tertiary</li>
            <li class="bg-on-tertiary text-tertiary">on tertiary</li>
            <li class="bg-tertiary-container text-on-tertiary-container">
              tertiary container
            </li>
            <li class="bg-on-tertiary-container text-tertiary-container">
              on tertiary container
            </li>
          </ul>
          <ul
            class="flex flex-col *:first:h-16 *:first:*:p-1 *:not-first:h-8 *:not-first:p-1"
          >
            <li class="flex *:flex-1">
              <div class="bg-tertiary-fixed text-on-tertiary-fixed">
                tertiary fixed
              </div>
              <div class="bg-tertiary-fixed-dim text-on-tertiary-fixed-dim">
                tertiary fixed dim
              </div>
            </li>
            <li class="bg-on-tertiary-fixed text-tertiary-fixed">
              on tertiary fixed
            </li>
            <li class="bg-on-tertiary-fixed-variant text-tertiary-fixed">
              on tertiary fixed variant
            </li>
          </ul>
        </div>
        <ul class="flex flex-col *:odd:h-16 *:even:h-8 *:p-1">
          <li class="bg-error text-on-error">Error</li>
          <li class="bg-on-error text-error">On Error</li>
          <li class="bg-error-container text-on-error-container">
            Error Container
          </li>
          <li class="bg-on-error-container text-error-container">
            On Error Container
          </li>
        </ul>
        <div class="flex flex-col col-span-3 **:p-1">
          <ul class="flex *:flex-1 h-16">
            <li class="bg-surface-dim text-on-surface">surface dim</li>
            <li class="bg-surface text-on-surface">surface</li>
            <li class="bg-surface-bright text-on-surface">surface bright</li>
          </ul>
          <ul class="flex *:flex-1 h-16">
            <li class="bg-surface-container-lowest text-on-surface">
              surface container lowest
            </li>
            <li class="bg-surface-container-low text-on-surface">
              surface container low
            </li>
            <li class="bg-surface-container text-on-surface">
              surface container
            </li>
            <li class="bg-surface-container-high text-on-surface">
              surface container high
            </li>
            <li class="bg-surface-container-highest text-on-surface">
              surface container highest
            </li>
          </ul>
          <ul class="flex *:flex-1 h-16">
            <li class="bg-on-surface text-surface">on surface</li>
            <li class="bg-on-surface-variant text-surface">
              on surface variant
            </li>
            <li class="bg-outline text-surface">outline</li>
            <li class="bg-outline-variant text-surface">outline variant</li>
          </ul>
        </div>
        <ul class="flex flex-col h-full *:flex-1 *:p-1 *:last:p-0 *:last:*:p-1">
          <li class="bg-inverse-surface text-inverse-on-surface">
            inverse surface
          </li>
          <li class="bg-inverse-on-surface text-inverse-surface">
            inverse on surface
          </li>
          <li class="bg-inverse-primary text-primary">inverse primary</li>

          <li class="flex gap-4 *:flex-1 mt-4">
            <div class="bg-scrim text-inverse-on-surface">scrim</div>
            <div class="bg-shadow text-inverse-on-surface">shadow</div>
          </li>
        </ul>
      </div>
    `;
  }
}
