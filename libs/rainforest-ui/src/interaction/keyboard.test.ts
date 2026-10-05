import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  hasModifier,
  isComposing,
  isInOverlay,
  isTypingTarget,
  listenForShortcuts,
} from './keyboard.js';

const html = (markup: string) => {
  const host = document.createElement('div');
  host.innerHTML = markup;
  document.body.append(host);
  return host;
};

const pick = (host: HTMLElement, selector: string) =>
  host.querySelector(selector);

afterEach(() => {
  document.body.innerHTML = '';
});

describe('isTypingTarget', () => {
  it('covers the fields and editable regions both apps treat as typing', () => {
    const host = html(`
      <input id="input" />
      <textarea id="textarea"></textarea>
      <select id="select"></select>
      <div id="empty" contenteditable=""></div>
      <div id="true" contenteditable="true"><span id="inner"></span></div>
      <div id="plain" contenteditable="plaintext-only"></div>
    `);
    for (const id of [
      'input',
      'textarea',
      'select',
      'empty',
      'true',
      'inner',
      'plain',
    ])
      expect(isTypingTarget(pick(host, `#${id}`)), id).toBe(true);
  });

  it('ignores buttons, non-editable regions and non-elements', () => {
    const host = html(`
      <button id="button"></button>
      <div id="off" contenteditable="false"></div>
    `);
    expect(isTypingTarget(pick(host, '#button'))).toBe(false);
    expect(isTypingTarget(window)).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
    expect(isTypingTarget(pick(host, '#off'))).toBe(false);
  });
});

describe('isInOverlay', () => {
  it('detects dialogs, menus and Base UI popups', () => {
    const host = html(`
      <div role="dialog"><button id="dialog"></button></div>
      <div role="alertdialog"><button id="alert"></button></div>
      <div role="menu"><button id="menu"></button></div>
      <div data-slot="select-content"><button id="select"></button></div>
      <div data-slot="popover-content"><button id="popover"></button></div>
      <button id="outside"></button>
    `);
    for (const id of ['dialog', 'alert', 'menu', 'select', 'popover'])
      expect(isInOverlay(pick(host, `#${id}`)), id).toBe(true);
    expect(isInOverlay(pick(host, '#outside'))).toBe(false);
    expect(isInOverlay(null)).toBe(false);
  });
});

describe('isComposing', () => {
  it('flags IME composition by the flag or by keyCode 229', () => {
    expect(
      isComposing(new KeyboardEvent('keydown', { isComposing: true })),
    ).toBe(true);
    expect(isComposing(new KeyboardEvent('keydown', { keyCode: 229 }))).toBe(
      true,
    );
    expect(isComposing(new KeyboardEvent('keydown', { key: 'a' }))).toBe(false);
  });
});

describe('hasModifier', () => {
  const key = (init: KeyboardEventInit) => new KeyboardEvent('keydown', init);

  it('counts Ctrl, Meta and Alt by default', () => {
    expect(hasModifier(key({ ctrlKey: true }))).toBe(true);
    expect(hasModifier(key({ metaKey: true }))).toBe(true);
    expect(hasModifier(key({ altKey: true }))).toBe(true);
    expect(hasModifier(key({ shiftKey: true }))).toBe(false);
  });

  it('lets Alt through when alt is false', () => {
    expect(hasModifier(key({ altKey: true }), { alt: false })).toBe(false);
    expect(hasModifier(key({ ctrlKey: true }), { alt: false })).toBe(true);
  });
});

describe('listenForShortcuts', () => {
  const press = (target: EventTarget, init: KeyboardEventInit) =>
    target.dispatchEvent(
      new KeyboardEvent('keydown', { bubbles: true, ...init }),
    );

  it('passes keydowns to the handler and drops composing ones', () => {
    const handler = vi.fn();
    const stop = listenForShortcuts(handler);
    press(document.body, { key: 'j' });
    press(document.body, { key: 'k', isComposing: true });
    press(document.body, { key: 'Enter', keyCode: 229 });
    expect(handler.mock.calls.map(([event]) => event.key)).toEqual(['j']);
    stop();
  });

  it('runs in the capture phase before a target listener stops propagation', () => {
    const handler = vi.fn();
    const stop = listenForShortcuts(handler);
    const button = html('<button></button>').querySelector(
      'button',
    ) as HTMLButtonElement;
    button.addEventListener('keydown', (event) => event.stopPropagation());
    press(button, { key: 'Escape' });
    expect(handler).toHaveBeenCalledTimes(1);
    stop();
  });

  it('listens on a given target and stops after unsubscribe', () => {
    const handler = vi.fn();
    const stop = listenForShortcuts(handler, {
      target: document,
      capture: false,
    });
    press(document.body, { key: 'a' });
    stop();
    press(document.body, { key: 'b' });
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
