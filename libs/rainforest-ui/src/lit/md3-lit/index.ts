import { argbFromHex, hexFromArgb } from '@material/material-color-utilities';
import { isServer, unsafeCSS } from 'lit';
import { customElement } from 'lit/decorators.js';

import { getSchemeProperties, themeFromSourceColor } from '../../utils/theme';
import { RfTwLit } from '../tw-lit';

declare global {
  interface HTMLElementTagNameMap {
    'rf-md3-lit': RfMd3Lit;
  }
}

const defaultTheme = themeFromSourceColor(argbFromHex('#66b2b2'));

@customElement('md3-lit')
export class RfMd3Lit extends RfTwLit {
  static {
    if (!isServer) {
      const styleSheets = Object.entries(
        getSchemeProperties(defaultTheme.schemes.light)
      ).map(
        ([key, color]) =>
          unsafeCSS(`
      @property ${key} {
        syntax: "<color>";
        inherits: false;
        initial-value: ${hexFromArgb(color)};
      }
    `).styleSheet as CSSStyleSheet
      );
      document.adoptedStyleSheets.push(...styleSheets);
    }
  }
}
