import { css, CSSResult, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

import { RfMd3Lit } from '../md3-lit';

declare global {}

const throttle = (callback: (...args: any[]) => void, limit: number) => {
  let inThrottle: boolean;
  return function throttled(this: any, ...args: any[]) {
    if (!inThrottle) {
      callback.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

@customElement('rf-carousel')
export class RfCarousel extends RfMd3Lit {
  static override styles: CSSResult[] = [
    ...super.styles,
    css`
      .large-item {
        @apply max-w-none;
      }
      .small-item {
        @apply min-w-10;
      }
    `,
  ];

  @property({ type: Array })
  images: string[] = [];

  @state()
  protected _active = 0;
  // update this._active with throttled function to prevent rapid changes
  private _updateActive = throttle((index: number) => {
    this._active = index;
  }, 1000); // limit to once every 100ms

  private _handleWheel(event: WheelEvent) {
    event.preventDefault();
    if (event.deltaX > 0) {
      this._updateActive(Math.min(this._active + 1, this.images.length - 3));
    }
    if (event.deltaX < 0) {
      this._updateActive(Math.max(this._active - 1, 0));
    }
  }

  override render() {
    return html`<div
      @wheel="${this._handleWheel}"
      class="flex px-4 py-2 gap-2 size-full"
    >
      ${this.images.map((image, index) => {
        const classes = [
          'rounded-[28px] object-cover transition-all duration-500 ease-in',
        ];
        if (this._active === index || this._active + 1 === index) {
          classes.push('max-w-auto grow');
        } else if (this._active + 2 === index) {
          classes.push('min-w-10 max-w-14');
        } else {
          classes.push('w-0');
        }
        return html`<img src=${image} class=${classes.join(' ')} />`;
      })}
    </div> `;
  }
}
