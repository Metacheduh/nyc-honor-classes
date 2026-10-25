/* ─────────────────────────────────────────────────────────────
   NIL TAX ENGINE — figures current for TAX YEAR 2026.

   One engine, loaded by /honor-system (the NIL Tax Calculator) and by
   the NIL course pages (/nil-taxes). Any number a lesson quotes about
   what to set aside comes from here, and scripts/check_examples.py
   refuses to deploy if a page's data-worked="nil-..." figure drifts
   from what this file computes.

   Federal rate tables: IRS Rev. Proc. 2025-32, Section 4.01,
     Table 2 (heads of household) and Table 3 (single filers).
   Standard deductions: same revenue procedure.
   Dependent limitation: IRC 63(c)(5), 2026 floor $1,350.
   Self-employment tax: IRC 1401 / 1402. Applies to 92.35% of
     gross. Social Security 12.4% up to the wage base, Medicare
     2.9% uncapped, plus 0.9% Additional Medicare above
     $200,000. No SE tax below $400 of net earnings.
     2026 wage base $184,500 (IRS Topic 751).
   Form 1099-NEC threshold: $2,000 for payments made after
     December 31, 2025. The threshold decides who mails a form,
     not whether the income is taxable.

   WHEN THE YEAR ROLLS OVER (every January): update TAX_YEAR,
   BRACKETS, STD_DEDUCTION, DEPENDENT_FLOOR, DEPENDENT_EARNED_ADD,
   SS_WAGE_BASE and FORM_1099_THRESHOLD (inflation-indexed after
   2026) from the new revenue procedure and IRS Topic 751, update
   the on-screen "Figures current for" lines on /honor-system and
   /nil-taxes, then run python3 scripts/check_examples.py --fix and
   reread every sentence around a changed number.
   Do not guess the numbers.

   State tax is deliberately NOT modeled.
   ───────────────────────────────────────────────────────────── */
(function (root) {
    'use strict';

    const TAX_YEAR = 2026;

    // Each row: tax = base + rate x (taxable income - over)
    const BRACKETS = {
        single: [
            { over: 0,      base: 0,         rate: 0.10 },
            { over: 12400,  base: 1240,      rate: 0.12 },
            { over: 50400,  base: 5800,      rate: 0.22 },
            { over: 105700, base: 17966,     rate: 0.24 },
            { over: 201775, base: 41024,     rate: 0.32 },
            { over: 256225, base: 58448,     rate: 0.35 },
            { over: 640600, base: 192979.25, rate: 0.37 }
        ],
        hoh: [
            { over: 0,      base: 0,      rate: 0.10 },
            { over: 17700,  base: 1770,   rate: 0.12 },
            { over: 67450,  base: 7740,   rate: 0.22 },
            { over: 105700, base: 16155,  rate: 0.24 },
            { over: 201750, base: 39207,  rate: 0.32 },
            { over: 256200, base: 56631,  rate: 0.35 },
            { over: 640600, base: 191171, rate: 0.37 }
        ]
    };

    const STD_DEDUCTION        = { single: 16100, hoh: 24150 };
    const DEPENDENT_FLOOR      = 1350;
    const DEPENDENT_EARNED_ADD = 450;
    const SE_NET_EARNINGS_PCT  = 0.9235;
    const SE_THRESHOLD         = 400;
    const SS_WAGE_BASE         = 184500;   // 2026
    const SS_RATE              = 0.124;
    const MEDICARE_RATE        = 0.029;
    const ADDL_MEDICARE_RATE   = 0.009;
    const ADDL_MEDICARE_FLOOR  = 200000;
    const FORM_1099_THRESHOLD  = 2000;     // payments made after Dec 31, 2025

    // Gross NIL profit at which net earnings reach the $400 SE-tax line:
    // $400 / 0.9235 = $433.13 (Schedule SE lines 4a and 4c). Display only, rounded to
    // the nearest dollar so the lessons say "about $433"; the tax math above tests the
    // exact $400 line on net earnings and never uses this constant.
    const SE_GROSS_THRESHOLD = Math.round(SE_THRESHOLD / SE_NET_EARNINGS_PCT);

    // Social Security stops at the wage base. Medicare never does,
    // and picks up another 0.9% past $200,000.
    function selfEmploymentTax(netEarnings) {
        if (netEarnings < SE_THRESHOLD) return 0;
        const socialSecurity = Math.min(netEarnings, SS_WAGE_BASE) * SS_RATE;
        const medicare       = netEarnings * MEDICARE_RATE;
        const addlMedicare   = Math.max(0, netEarnings - ADDL_MEDICARE_FLOOR) * ADDL_MEDICARE_RATE;
        return socialSecurity + medicare + addlMedicare;
    }

    function federalTax(taxable, status) {
        const table = BRACKETS[status] || BRACKETS.single;
        let row = table[0];
        for (const r of table) {
            if (taxable > r.over) row = r; else break;
        }
        return row.base + (taxable - row.over) * row.rate;
    }

    // A dependent's standard deduction is capped at earned income
    // plus $450, with a $1,350 floor, never above the normal amount.
    function standardDeduction(status, earned, isDependent) {
        const full = STD_DEDUCTION[status] || STD_DEDUCTION.single;
        if (!isDependent) return full;
        return Math.min(full, Math.max(DEPENDENT_FLOOR, earned + DEPENDENT_EARNED_ADD));
    }

    /* The whole calculation in one place. income = gross NIL pay,
       cash plus the fair value of anything received in kind. Business
       expenses and the QBI deduction are ignored on purpose, so the
       estimate errs toward setting aside too much. */
    function setAside(income, status, isDependent) {
        const gross       = Math.max(0, Number(income) || 0);
        // Someone a parent claims as a dependent can't file as head of household,
        // so a dependent is always figured as single.
        const st          = isDependent ? 'single' : (BRACKETS[status] ? status : 'single');
        const netEarnings = gross * SE_NET_EARNINGS_PCT;
        const seTax       = selfEmploymentTax(netEarnings);
        // Half of SE tax is deductible against income tax.
        const taxable     = Math.max(0, gross - (seTax / 2) - standardDeduction(st, gross, !!isDependent));
        const fedTax      = federalTax(taxable, st);
        const total       = seTax + fedTax;
        return {
            gross: gross,
            netEarnings: netEarnings,
            seTax: seTax,
            taxable: taxable,
            federalTax: fedTax,
            total: total,
            keep: gross - total,
            pct: gross > 0 ? total / gross : 0
        };
    }

    const money = (n) => '$' + Math.round(n).toLocaleString('en-US');

    root.NIL_ENGINE = Object.freeze({
        TAX_YEAR, BRACKETS, STD_DEDUCTION, DEPENDENT_FLOOR, DEPENDENT_EARNED_ADD,
        SE_NET_EARNINGS_PCT, SE_THRESHOLD, SE_GROSS_THRESHOLD, SS_WAGE_BASE,
        SS_RATE, MEDICARE_RATE, ADDL_MEDICARE_RATE, ADDL_MEDICARE_FLOOR,
        FORM_1099_THRESHOLD,
        selfEmploymentTax, federalTax, standardDeduction, setAside, money
    });
})(typeof window !== 'undefined' ? window : globalThis);
