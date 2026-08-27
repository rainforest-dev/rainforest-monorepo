// apps/loop-observatory/src/lib/enroll/plist.test.ts
import { describe, expect, it } from 'vitest';

import { toPlist } from './plist.js';

describe('toPlist', () => {
  it('emits a launchd plist plutil can parse', () => {
    const out = toPlist({
      Label: 'tools.rainforest.loop-ralph',
      ProgramArguments: ['/bin/sh', '-c', 'true'],
      RunAtLoad: true,
      StartInterval: 1800,
      EnvironmentVariables: { PATH: '/usr/bin:/bin' },
    });

    expect(out).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(out).toContain('<key>Label</key>');
    expect(out).toContain('<string>tools.rainforest.loop-ralph</string>');
    expect(out).toContain('<true/>');
    expect(out).toContain('<integer>1800</integer>');
    expect(out.endsWith('\n')).toBe(true);
  });

  it('escapes XML metacharacters in values', () => {
    const out = toPlist({ Label: 'a & b <c>' });
    expect(out).toContain('<string>a &amp; b &lt;c&gt;</string>');
  });

  it('never emits a double hyphen inside a comment', () => {
    // XML forbids `--` in comments. plutil accepts it and expat refuses it, so a
    // generated plist containing one would parse only on Apple's parser — a
    // strictly worse artefact than the hand-written file it replaces. The
    // committed Air plist already has this defect.
    const out = toPlist(
      { Label: 'x' },
      { Label: 'probed 2026-08-25 -- DENIED here' },
    );
    const comments = out.match(/<!--[\s\S]*?-->/g) ?? [];
    expect(comments.length).toBeGreaterThan(0);
    for (const c of comments) {
      expect(c.slice(4, -3)).not.toContain('--');
    }
  });

  it('throws when a number is not an integer', () => {
    // `<integer>` is the only numeric plist tag this serialiser emits. A
    // fractional value (e.g. a mistyped StartInterval) would otherwise come
    // out as `<integer>1800.5</integer>`, which is invalid plist content —
    // integers must be integral, and reals need `<real>`. Refusing the value
    // is preferred over emitting `<real>` here: the only numbers this
    // serialiser carries are launchd intervals, where a fractional value is a
    // caller bug rather than a value worth encoding faithfully.
    expect(() => toPlist({ StartInterval: 1800.5 })).toThrow(/1800\.5/);
  });

  it('still serialises an integer number', () => {
    const out = toPlist({ ThrottleInterval: 30 });
    expect(out).toContain('<integer>30</integer>');
  });
});
