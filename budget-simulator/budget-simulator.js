/* ─────────────────────────────────────────────────────────────
   BUDGET SIMULATOR (/budget-simulator), figures for TAX YEAR 2026.

   Everything runs in the browser. Nothing typed on the page is sent
   anywhere or saved: no fetch, no storage, no analytics.

   Sources, all read October 14, 2026, and re-checked against the same
   primary documents October 25, 2026 (tests/math.test.js pins each figure):
   - Social Security 6.2% and Medicare 1.45% (employee share), 2026 wage
     base $184,500: IRS Tax Topic 751; SSA Contribution and Benefit Base.
   - Federal 2026 single brackets, $16,100 standard deduction, and the
     dependent standard deduction (greater of $1,350 or earned income
     plus $450, capped at $16,100): IRS Rev. Proc. 2025-32, sections
     4.01 (Table 3) and 4.14. Same numbers as nil-tax-engine.js.
   - New York State and New York City 2026 rate schedules (single) and
     NY standard deduction ($8,000; $3,100 if claimable as a dependent):
     NYS Dept. of Taxation and Finance, Form IT-2105-I (2026), pages 2
     and 10.
   - Minimum wage from January 1, 2026: $17.00 NYC, Long Island and
     Westchester; $16.00 rest of state: NYS DOL minimum wage page and
     ny.gov minimum wage page. (DOL says both stay the same on 1/1/2027.)

   Simplifications (labeled on the page as estimates): wages are the only
   income; single filer; no credits (NY household credit, earned income
   credits, NYC school tax credit); NY's high-income recapture is ignored
   (the wage and hours limits keep yearly pay under $84,000, far below
   where it starts); the 2025-2028 federal tips and overtime deductions
   are not modeled.

   YEAR ROLL (every January): update every constant in TAX below from the
   new IRS revenue procedure, IRS Topic 751, NY's new IT-2105-I and the NY
   DOL minimum wage page, then the "2026" stamps and the Sources list on
   budget-simulator.html. Do not guess the numbers.
   ───────────────────────────────────────────────────────────── */
(function (root) {
    'use strict';

    var TAX = {
        year: 2026,
        ssRate: 0.062,
        ssWageBase: 184500,
        medicareRate: 0.0145,
        fedStd: 16100,
        fedDepFloor: 1350,
        fedDepAdd: 450,
        // tax = base + rate x (taxable - over)
        fed: [
            { over: 0,      base: 0,     rate: 0.10 },
            { over: 12400,  base: 1240,  rate: 0.12 },
            { over: 50400,  base: 5800,  rate: 0.22 },
            { over: 105700, base: 17966, rate: 0.24 }
        ],
        nyStd: 8000,
        nyStdDependent: 3100,
        ny: [
            { over: 0,      base: 0,    rate: 0.039 },
            { over: 8500,   base: 332,  rate: 0.044 },
            { over: 11700,  base: 473,  rate: 0.0515 },
            { over: 13900,  base: 586,  rate: 0.054 },
            { over: 80650,  base: 4191, rate: 0.059 }
        ],
        nyc: [
            { over: 0,      base: 0,    rate: 0.03078 },
            { over: 12000,  base: 369,  rate: 0.03762 },
            { over: 25000,  base: 858,  rate: 0.03819 },
            { over: 50000,  base: 1813, rate: 0.03876 }
        ]
    };

    var MIN_WAGE = { nyc: 17.00, li: 17.00, upstate: 16.00 };

    function schedule(table, taxable) {
        if (taxable <= 0) return 0;
        var row = table[0];
        for (var i = 0; i < table.length; i++) if (taxable > table[i].over) row = table[i];
        return row.base + row.rate * (taxable - row.over);
    }

    // One paycheck (a week of work), with the year's income tax spread evenly
    // over the weeks worked.
    function paycheck(o) {
        var weekly = o.wage * o.hours;
        var weeks = Math.max(1, Math.min(52, o.weeks));
        var yearly = weekly * weeks;
        var fedStd = o.dependent
            ? Math.min(TAX.fedStd, Math.max(TAX.fedDepFloor, yearly + TAX.fedDepAdd))
            : TAX.fedStd;
        var fedYear = schedule(TAX.fed, yearly - fedStd);
        var nyTaxable = yearly - (o.dependent ? TAX.nyStdDependent : TAX.nyStd);
        var nyYear = schedule(TAX.ny, nyTaxable);
        var nycYear = o.nyc ? schedule(TAX.nyc, nyTaxable) : 0;
        var ss = Math.min(weekly, TAX.ssWageBase / weeks) * TAX.ssRate;
        var medicare = weekly * TAX.medicareRate;
        var fed = fedYear / weeks, ny = nyYear / weeks, nyc = nycYear / weeks;
        return {
            gross: weekly, yearly: yearly, ss: ss, medicare: medicare,
            fed: fed, ny: ny, nyc: nyc,
            fedYear: fedYear, nyYear: nyYear, nycYear: nycYear,
            fedStd: fedStd, nyStd: o.dependent ? TAX.nyStdDependent : TAX.nyStd,
            net: weekly - ss - medicare - fed - ny - nyc
        };
    }

    // Credit card: interest added monthly at APR/12, then the payment.
    // payment = the larger of pct x balance and the floor, or a fixed amount.
    function payoff(balance, apr, pct, floor, fixed) {
        var r = apr / 100 / 12, bal = balance, months = 0, interest = 0;
        while (bal > 0.005 && months < 1200) {
            var i = bal * r;
            var pay = fixed ? fixed : Math.max(bal * pct / 100, floor);
            if (pay <= i) return { months: Infinity, interest: Infinity };
            pay = Math.min(pay, bal + i);
            interest += i;
            bal = bal + i - pay;
            months++;
        }
        return { months: months, interest: interest, firstPayment: fixed ? fixed : Math.max(balance * pct / 100, floor) };
    }

    // Saving each month from startAge to endAge, growing at an assumed yearly
    // rate compounded monthly. Returns the balance at each birthday.
    function growth(monthly, ratePct, startAge, endAge) {
        var r = ratePct / 100 / 12, bal = 0, put = 0, points = [];
        for (var age = 0; age <= endAge; age++) {
            points.push({ age: age, balance: bal, put: put });
            if (age >= startAge && age < endAge) {
                for (var m = 0; m < 12; m++) { bal = bal * (1 + r) + monthly; put += monthly; }
            }
        }
        return points;
    }

    function monthsToGoal(goal, start, monthly) {
        if (start >= goal) return 0;
        if (monthly <= 0) return Infinity;
        return Math.ceil((goal - start) / monthly);
    }

    var api = { TAX: TAX, MIN_WAGE: MIN_WAGE, paycheck: paycheck, payoff: payoff, growth: growth, monthsToGoal: monthsToGoal, schedule: schedule };
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.BudgetSim = api;
})(typeof window !== 'undefined' ? window : this);
