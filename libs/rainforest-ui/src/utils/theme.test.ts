import { expect, test } from 'vitest';

import {
  getColorRoles,
  getSchemeProperties,
  themeFromSourceColor,
} from './theme.js';

test('get color roles json', () => {
  const roles = getColorRoles();
  expect(Object.keys(roles)).toHaveLength(45);
});

test('get scheme json', () => {
  const roles = getColorRoles();
  const theme = themeFromSourceColor(0xff0000);
  const scheme = getSchemeProperties(theme.schemes.light);
  expect(Object.keys(scheme)).toEqual(
    expect.arrayContaining(Object.keys(roles))
  );
  expect(Object.values(scheme)).not.toContain(undefined);
});
