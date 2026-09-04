/**
 * The Producer's readiness vocabulary. The distinction that matters is warn
 * against fail: a warn is a named consequence the system runs without, a fail
 * is a Cycle that cannot do its job.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { CheckReport, ok, warn, fail, OK, WARN, FAIL } from '../src/producer/checks.js';
import { noNetwork } from './helpers.js';

noNetwork();

test('a report with nothing wrong is green', () => {
  const report = new CheckReport('SMOKE');
  report.group('Secrets')(ok('GH_TOKEN', 'present'));
  assert.equal(report.blocked, false);
  assert.equal(report.verdict, 'SMOKE GREEN');
});

test('a warn degrades a report without blocking it', () => {
  const report = new CheckReport('SMOKE');
  report.group('Secrets')(warn('GA4_SA_KEY', 'missing', 'the Analyst cannot count Players'));
  assert.equal(report.blocked, false);
  assert.match(report.verdict, /GREEN, degraded/);
  assert.match(report.render(), /the Analyst cannot count Players/);
});

test('a fail blocks the report and carries its remedy', () => {
  const report = new CheckReport('SMOKE');
  const add = report.group('State');
  add(ok('gh auth status', 'logged in'));
  add(fail('origin/marketing-state', 'the branch does not exist yet', 'run `node cli.js state init`'));
  assert.equal(report.blocked, true);
  assert.equal(report.count(FAIL), 1);
  assert.equal(report.count(OK), 1);
  assert.match(report.verdict, /FAILED — 1 blocking, 0 degraded/);
  assert.match(report.render(), /run `node cli\.js state init`/);
});

test('groups and checks render in the order they were added', () => {
  const report = new CheckReport('SMOKE', 'a subtitle');
  report.group('First', 'about first')(ok('a', '1'));
  report.group('Second')(ok('b', '2'));
  const lines = report.render().split('\n').filter(Boolean);
  assert.ok(lines.indexOf('First — about first') < lines.indexOf('Second'));
  assert.equal(report.checks.length, 2);
});

test('an empty group says so rather than rendering nothing', () => {
  const report = new CheckReport('SMOKE');
  report.group('Reachability', 'every host a Cycle calls');
  assert.match(report.render(), /nothing to check/);
});

test('the three outcomes are distinct', () => {
  assert.deepEqual([OK, WARN, FAIL], ['ok', 'warn', 'fail']);
  assert.equal(ok('a', 'b').note, null, 'an ok needs no explanation');
  assert.equal(warn('a', 'b', 'c').note, 'c');
  assert.equal(fail('a', 'b', 'c').note, 'c');
});
