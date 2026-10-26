/* Checks the money math behind the app and the Budget Simulator against the 2026 primary sources
   and against the numbers the lessons print. No dependencies: run with `node --test tests/`.

   Sources (read October 25, 2026):
   - IRS Rev. Proc. 2025-32, sec. 4.01 Table 2 (heads of household) and Table 3 (single),
     sec. 4.14(1) standard deductions, sec. 4.14(2) dependent standard deduction.
     https://www.irs.gov/pub/irs-drop/rp-25-32.pdf
   - IRS Topic 751: Social Security 6.2% + Medicare 1.45% employee share, 2026 wage base $184,500.
     https://www.irs.gov/taxtopics/tc751
   - IRS Instructions for Forms 1099-MISC and 1099-NEC: $2,000 reporting threshold for tax years
     beginning after 2025. https://www.irs.gov/instructions/i1099mec
   - NYS Dept. of Taxation and Finance, Form IT-2105-I (2026): NYS and NYC single rate schedules and
     the NY standard deduction table. https://www.tax.ny.gov/pdf/current_forms/it/it2105i.pdf
   - NYS Dept. of Labor minimum wage page: $17.00 NYC/Long Island/Westchester, $16.00 rest of state
     from Jan 1, 2026. https://dol.ny.gov/minimum-wage-0 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

require(path.join(__dirname, '..', 'nil-tax-engine.js'));
const E = globalThis.NIL_ENGINE;
const S = require(path.join(__dirname, '..', 'budget-simulator', 'budget-simulator.js'));
const near = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} is not within ${tol} of ${b}`);

test('federal 2026 single table matches Rev. Proc. 2025-32 Table 3', () => {
  const t = E.BRACKETS.single.map((r) => [r.over, r.base, r.rate]);
  assert.deepEqual(t, [[0, 0, 0.10], [12400, 1240, 0.12], [50400, 5800, 0.22], [105700, 17966, 0.24],
    [201775, 41024, 0.32], [256225, 58448, 0.35], [640600, 192979.25, 0.37]]);
});

test('federal 2026 head-of-household table matches Rev. Proc. 2025-32 Table 2', () => {
  const t = E.BRACKETS.hoh.map((r) => [r.over, r.base, r.rate]);
  assert.deepEqual(t, [[0, 0, 0.10], [17700, 1770, 0.12], [67450, 7740, 0.22], [105700, 16155, 0.24],
    [201750, 39207, 0.32], [256200, 56631, 0.35], [640600, 191171, 0.37]]);
});

test('each bracket base equals the tax on everything below it (no typos in the tables)', () => {
  for (const table of [E.BRACKETS.single, E.BRACKETS.hoh, S.TAX.fed, S.TAX.ny, S.TAX.nyc]) {
    for (let i = 1; i < table.length; i++) {
      const prev = table[i - 1];
      const expected = prev.base + prev.rate * (table[i].over - prev.over);
      near(table[i].base, expected, 0.6); // NY's printed schedule rounds bases to whole dollars
    }
  }
});

test('standard deductions and dependent rule match Rev. Proc. 2025-32 sec. 4.14', () => {
  assert.equal(E.STD_DEDUCTION.single, 16100);
  assert.equal(E.STD_DEDUCTION.hoh, 24150);
  assert.equal(E.standardDeduction('single', 0, true), 1350);
  assert.equal(E.standardDeduction('single', 5000, true), 5450);
  assert.equal(E.standardDeduction('single', 50000, true), 16100);
  assert.equal(S.TAX.fedStd, 16100);
  assert.equal(S.TAX.fedDepFloor, 1350);
  assert.equal(S.TAX.fedDepAdd, 450);
});

test('Social Security, Medicare and 1099 figures match IRS Topic 751 and the 1099 instructions', () => {
  assert.equal(E.SS_WAGE_BASE, 184500);
  assert.equal(S.TAX.ssWageBase, 184500);
  assert.equal(S.TAX.ssRate, 0.062);
  assert.equal(S.TAX.medicareRate, 0.0145);
  assert.equal(E.SS_RATE, 0.124);
  assert.equal(E.MEDICARE_RATE, 0.029);
  assert.equal(E.FORM_1099_THRESHOLD, 2000);
});

test('Tax set-aside tool: the course examples', () => {
  // Module 01 and the teacher kit: a $500 deal -> about $71 set aside, $429 left.
  const r500 = E.setAside(500, 'single', true);
  assert.equal(Math.round(r500.total), 71);
  assert.equal(Math.round(r500.federalTax), 0);
  // No self-employment tax under $400 of net earnings (about $433 of profit).
  assert.equal(E.SE_GROSS_THRESHOLD, 433);
  assert.equal(E.setAside(433, 'single', true).seTax, 0);
  assert.ok(E.setAside(434, 'single', true).seTax > 0);
  // Module 05 / teacher kit: $3,000 of NIL profit -> about $2,788 counts toward a Roth IRA
  // (profit minus the deductible half of self-employment tax).
  const r3000 = E.setAside(3000, 'single', true);
  assert.equal(Math.round(3000 - r3000.seTax / 2), 2788);
  // A dependent is always figured as single, whatever status is passed.
  assert.deepEqual(E.setAside(10000, 'hoh', true), E.setAside(10000, 'single', true));
  // Bad input never produces a negative or NaN set-aside.
  for (const bad of [-5, 'abc', null, undefined, NaN]) assert.equal(E.setAside(bad, 'single', true).total, 0);
});

test('NY 2026 single schedules and standard deduction match IT-2105-I (2026)', () => {
  assert.deepEqual(S.TAX.ny.map((r) => [r.over, r.base, r.rate]),
    [[0, 0, 0.039], [8500, 332, 0.044], [11700, 473, 0.0515], [13900, 586, 0.054], [80650, 4191, 0.059]]);
  assert.deepEqual(S.TAX.nyc.map((r) => [r.over, r.base, r.rate]),
    [[0, 0, 0.03078], [12000, 369, 0.03762], [25000, 858, 0.03819], [50000, 1813, 0.03876]]);
  assert.equal(S.TAX.nyStd, 8000);
  assert.equal(S.TAX.nyStdDependent, 3100);
  assert.deepEqual(S.MIN_WAGE, { nyc: 17, li: 17, upstate: 16 });
});

test('the simulator can never reach a bracket it does not model', () => {
  // Wage max $40, 40 hours, 52 weeks = $83,200: under federal 24% ($105,700 taxable) and under
  // NY 6.85% ($215,400), so the shortened tables are enough.
  const top = S.paycheck({ wage: 40, hours: 40, weeks: 52, dependent: false, nyc: true });
  assert.ok(top.yearly - S.TAX.fedStd < 105700);
  assert.ok(top.yearly - S.TAX.nyStd < 215400);
});

test('Budget Simulator step 1: 15 hours at $17 in NYC, claimed as a dependent, all year', () => {
  const p = S.paycheck({ wage: 17, hours: 15, weeks: 52, dependent: true, nyc: true });
  near(p.gross, 255);
  near(p.yearly, 13260);
  assert.equal(p.fedStd, 13710);     // earned income + $450, under the $16,100 cap
  near(p.fedYear, 0);                // the dependent deduction covers all of it
  near(p.nyYear, 332 + 0.044 * (13260 - 3100 - 8500)); // $405.04
  near(p.nycYear, 0.03078 * (13260 - 3100));           // $312.72
  near(p.ss, 15.81);
  near(p.medicare, 3.70);
  near(p.net, 255 - 15.81 - 3.6975 - 405.04 / 52 - 312.7248 / 52);
});

test('Budget Simulator step 1: not a dependent, 40 hours at $25, upstate (no NYC tax)', () => {
  const p = S.paycheck({ wage: 25, hours: 40, weeks: 52, dependent: false, nyc: false });
  const yearly = 52000;
  near(p.fedYear, 1240 + 0.12 * (yearly - 16100 - 12400));
  near(p.nyYear, 586 + 0.054 * (yearly - 8000 - 13900));
  assert.equal(p.nycYear, 0);
});

test('Budget Simulator step 3 and 4: emergency fund and credit card', () => {
  assert.equal(S.monthsToGoal(1000, 0, 100), 10);
  assert.equal(S.monthsToGoal(1000, 1000, 0), 0);
  assert.equal(S.monthsToGoal(1000, 400, 0), Infinity);
  // $1,000 at 24% APR paid at a fixed $100: 12 months (standard amortization: 11.27, rounded up).
  const fixed = S.payoff(1000, 24, 2, 25, 100);
  assert.equal(fixed.months, 12);
  assert.ok(isFinite(fixed.interest) && fixed.interest > 100 && fixed.interest < 140);
  // The minimum (2% or $25) takes far longer and costs far more.
  const min = S.payoff(1000, 24, 2, 25, 0);
  assert.ok(min.months > 40 && min.interest > fixed.interest * 2);
  // A minimum that does not cover the interest never pays off.
  assert.equal(S.payoff(10000, 36, 1, 25, 0).months, Infinity);
});

test('Budget Simulator step 5: $50 a month at an example 7%, monthly, from 16 and from 25', () => {
  // The page says: deposit at the end of each month, return applied monthly (7%/12).
  const r = 0.07 / 12, fv = (n) => 50 * (Math.pow(1 + r, n) - 1) / r;
  near(S.growth(50, 7, 16, 65)[65].balance, fv(49 * 12), 0.01);
  near(S.growth(50, 7, 25, 65)[65].balance, fv(40 * 12), 0.01);
  assert.equal(S.growth(50, 7, 16, 65)[65].put, 29400);
  // Known gap, not a bug in either: Module 04 and the teacher kit print about $243,317 (from 16) and
  // $119,181 (from 26). Those are $600 a year added at the START of each year with 7% once a year.
  // The simulator's monthly method gives about $253,461 from 16. Both are labeled examples.
  const yearlyStart = (years) => 600 * (Math.pow(1.07, years) - 1) / 0.07 * 1.07;
  near(yearlyStart(49), 243317, 1);
  near(yearlyStart(39), 119181, 1);
});
