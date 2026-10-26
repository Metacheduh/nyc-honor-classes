/* Money Tools: three small tools for the "Money Tools" class. All math runs on the phone.
   Nothing typed here is sent anywhere. Values are saved in localStorage only (key nyh_app_v1, via ctx).

   ── TAX SET-ASIDE: SOURCE OF THE METHOD ──────────────────────────────────────────────────────
   This tool does not have its own tax math. It calls the course's own engine, ../nil-tax-engine.js
   (window.NIL_ENGINE.setAside), with the same inputs the course's "Try it" uses:
       NIL_ENGINE.setAside(cash + gear, 'single', true)
   i.e. a parent claims the player (so they file as single with the dependent standard deduction),
   gear counts at what it normally sells for, no business costs, federal tax only, no state tax.
   That is exactly how the course states it:
     - nil-taxes.html, the "Try it" box (id="try-it") and the "How much should I set aside?" table;
     - course-try.js, function taxes(box): setAside(gross, 'single', true);
     - nil-budget.html line ~247: "October's $500 deal: about $71 goes to the tax set-aside first.
       The other $429 goes to savings."
   The $500 -> about $71 example: self-employment tax is 15.3% on 92.35% of profit
       $500 x 0.9235 = $461.75;  x 0.153 = $70.65 -> $71.   Federal income tax is $0 because a
       dependent's standard deduction ($1,350 floor, or earned income + $450) covers it.
   Federal sources named in nil-tax-engine.js: IRS Rev. Proc. 2025-32 sec. 4.01 (Table 3) and 4.14;
   IRC 63(c)(5); IRC 1401 and 1402; IRS Topic 751 (2026 wage base $184,500). Figures are for TAX YEAR 2026.
   scripts/check_examples.py in the site repo already checks the course's printed $71 against the engine.
   ──────────────────────────────────────────────────────────────────────────────────────────── */
(function (root) {
    'use strict';

    var E = function () { return root.NIL_ENGINE; };
    var CAP = 1000000;
    function num(v) { var n = Number(String(v).replace(/[^0-9.]/g, '')); return isFinite(n) && n > 0 ? Math.min(n, CAP) : 0; }
    function money(n) { var r = Math.round(n); return (r < 0 ? '-$' : '$') + Math.abs(r).toLocaleString('en-US'); }
    function moneyField(id, label, value, hint, extra) {
        return '<div class="field"><label for="' + id + '">' + label + '</label><div class="money"><span aria-hidden="true">$</span>' +
            '<input id="' + id + '" type="text" inputmode="decimal" autocomplete="off" value="' + value + '"' + (hint ? ' aria-describedby="' + id + '-h"' : '') + (extra || '') + '></div>' +
            (hint ? '<p class="hint" id="' + id + '-h">' + hint + '</p>' : '') + '</div>';
    }
    function $(root_, sel) { return root_.querySelector(sel); }
    function setBar(node, p) { node.style.width = Math.max(0, Math.min(100, p)) + '%'; }

    /* ---------- 1. Tax set-aside ---------- */
    function tax(host, ctx) {
        var s = ctx.load(); var saved = s.tax || { cash: 500, gear: 0 };
        host.innerHTML = '<section class="tool" aria-labelledby="t1"><h2 id="t1">What do you set aside from a deal?</h2>' +
            '<p>Type what a deal pays. This uses the same ' + E().TAX_YEAR + ' math as Module 03: a parent claims you, you file single, no business costs, federal tax only.</p>' +
            moneyField('cash', 'Cash from the deal', saved.cash, 'Whole dollars. Nothing you type leaves your phone.') +
            moneyField('gear', 'Free gear, at what it normally sells for', saved.gear, 'Free shoes or clothes count the same as cash.') +
            '<div class="chips" role="group" aria-label="Examples from the course">' +
            '<button type="button" class="pchip" data-p="500,0">$500 (Module 01)</button><button type="button" class="pchip" data-p="1000,0">$1,000</button>' +
            '<button type="button" class="pchip" data-p="3000,500">$3,000 + $500 gear</button><button type="button" class="pchip" data-p="10000,0">$10,000</button></div>' +
            '<div class="out" aria-live="polite"><div class="k">Set aside for federal tax</div><div class="v" id="o-total">$0</div>' +
            '<dl><dt>You keep, before state tax</dt><dd id="o-keep">$0</dd><dt>Cash left after the set-aside</dt><dd id="o-left">$0</dd>' +
            '<dt>Share of the deal</dt><dd id="o-pct">0%</dd><dt>Self-employment tax</dt><dd id="o-se">$0</dd><dt>Federal income tax</dt><dd id="o-fed">$0</dd></dl>' +
            '<div class="bars" aria-hidden="true"><div class="bar2"><span>Set aside</span><div class="track"><i class="red" id="b-tax"></i></div></div>' +
            '<div class="bar2"><span>Yours</span><div class="track"><i id="b-keep"></i></div></div></div></div>' +
            '<ul class="notes" id="o-notes"></ul>' +
            '<p class="fine">Federal only. New York and New York City tax come on top, so set aside a little more. Educational estimate, not tax advice. Method and sources: Module 03, NIL and Taxes.</p></section>';
        var cash = $(host, '#cash'), gear = $(host, '#gear');
        function render() {
            var c = num(cash.value), g = num(gear.value), gross = c + g, en = E();
            var r = en.setAside(gross, 'single', true);
            $(host, '#o-total').textContent = money(r.total);
            $(host, '#o-keep').textContent = money(r.keep);
            $(host, '#o-left').textContent = money(c - r.total);
            $(host, '#o-pct').textContent = gross > 0 ? (Math.round(r.pct * 1000) / 10).toFixed(1) + '%' : '0%';
            $(host, '#o-se').textContent = money(r.seTax);
            $(host, '#o-fed').textContent = money(r.federalTax);
            setBar($(host, '#b-tax'), gross > 0 ? r.pct * 100 : 0);
            setBar($(host, '#b-keep'), gross > 0 ? 100 - r.pct * 100 : 0);
            var notes = [];
            if (gross > 0 && r.seTax === 0) notes.push('Under about ' + money(en.SE_GROSS_THRESHOLD) + ' of profit there is no self-employment tax yet, but it is still income you report.');
            if (r.seTax > 0) notes.push('At ' + money(en.SE_GROSS_THRESHOLD) + ' of profit or more, you file your own return, even if a parent claims you.');
            if (r.federalTax > 0) notes.push('Your profit is now past the standard deduction, so federal income tax starts on top of self-employment tax.');
            if (r.total >= 1000) notes.push('You expect to owe $1,000 or more, so the IRS may want payments during the year.');
            if (g > 0) notes.push('The gear adds tax but no cash, so the set-aside comes out of your cash.');
            if (c > 0 && c - r.total < 0) notes.push('The set-aside is more than the cash you got. You would pay the difference from savings.');
            if (gross >= en.FORM_1099_THRESHOLD) notes.push('At ' + money(en.FORM_1099_THRESHOLD) + ' or more from one business, it has to send you a Form 1099-NEC.');
            else if (gross > 0) notes.push('Under ' + money(en.FORM_1099_THRESHOLD) + ', the business may send no tax form. You still report it.');
            $(host, '#o-notes').innerHTML = notes.map(function (n) { return '<li>' + ctx.esc(n) + '</li>'; }).join('');
            var st = ctx.load(); st.tax = { cash: c, gear: g }; ctx.save();
        }
        [cash, gear].forEach(function (i) { i.addEventListener('input', render); });
        Array.prototype.forEach.call(host.querySelectorAll('[data-p]'), function (b) {
            b.addEventListener('click', function () { var p = b.getAttribute('data-p').split(','); cash.value = p[0]; gear.value = p[1]; render(); });
        });
        render();
    }

    /* ---------- 2. Monthly budget splitter (the course's four lines: saving first, needs, giving, wants) ---------- */
    var LINES = [['saving', 'Saving, first'], ['needs', 'Needs'], ['giving', 'Giving'], ['wants', 'Wants']];
    function budget(host, ctx) {
        var s = ctx.load(); var b = s.budget || { income: 200, saving: 0, needs: 0, giving: 0, wants: 0, deal: 0 };
        host.innerHTML = '<section class="tool" aria-labelledby="t2"><h2 id="t2">Give every dollar a job</h2>' +
            '<p>Build the month on what comes in when there is no deal. Slide each line until nothing is left over. The lines are the ones in Module 01: saving first, needs, giving, wants.</p>' +
            moneyField('income', 'Money that comes in most months', b.income, 'Allowance, job pay. Leave deal money out for now.') +
            LINES.map(function (l) { return '<div class="slider"><label for="r-' + l[0] + '"><span>' + l[1] + '</span><output id="v-' + l[0] + '" for="r-' + l[0] + '">$0</output></label>' +
                '<input id="r-' + l[0] + '" type="range" min="0" max="' + Math.max(1, Math.round(b.income || 200)) + '" step="1" value="' + (b[l[0]] || 0) + '"></div>'; }).join('') +
            '<div class="light bars" aria-hidden="true">' + LINES.map(function (l) { return '<div class="bar2"><span>' + l[1].replace(', first', '') + '</span><div class="track"><i id="bb-' + l[0] + '"></i></div></div>'; }).join('') + '</div>' +
            '<p class="status" id="left" aria-live="polite"></p>' +
            '<div class="chips"><button type="button" class="pchip" id="ex">Show the lesson\'s plan</button><button type="button" class="pchip" id="clr">Start over</button></div>' +
            '<h3>When a deal lands</h3>' +
            moneyField('deal', 'A deal pays', b.deal || 0, 'The tax set-aside comes off first (same math as the Tax tool). The rest is extra.') +
            '<p id="dealout" aria-live="polite"></p>' +
            '<p class="fine">The lesson\'s example ($200 a month: $40 saving, $90 needs, $10 giving, $60 wants) is made up to show the idea. It is not a rule or a recommended split. Your lines will be different.</p></section>';
        var income = $(host, '#income'), ranges = {};
        LINES.forEach(function (l) { ranges[l[0]] = $(host, '#r-' + l[0]); });
        function render() {
            // Whole-dollar steps, so any whole-dollar income can be split to exactly $0 left.
            var inc = Math.max(1, Math.round(num(income.value))), used = 0;
            LINES.forEach(function (l) {
                var r = ranges[l[0]]; r.max = String(inc);
                if (Number(r.value) > inc) r.value = String(inc);
                var v = Number(r.value) || 0; used += v;
                $(host, '#v-' + l[0]).textContent = money(v);
                r.setAttribute('aria-valuetext', money(v));
                setBar($(host, '#bb-' + l[0]), inc ? v / inc * 100 : 0);
            });
            var left = Math.round(num(income.value)) - used, st = $(host, '#left');
            st.className = 'status ' + (left === 0 && num(income.value) > 0 ? 'good' : left < 0 ? 'bad' : '');
            st.textContent = num(income.value) <= 0 ? 'Type what comes in to start.' : left === 0 ? 'Every dollar has a job. Nothing left over, nothing short.' : left > 0 ? money(left) + ' still needs a job.' : 'You planned ' + money(-left) + ' more than comes in.';
            var d = num($(host, '#deal').value), out = $(host, '#dealout');
            if (d > 0) { var r2 = E().setAside(d, 'single', true); out.innerHTML = '<b>' + money(r2.total) + '</b> goes to the tax set-aside first. The other <b>' + money(d - r2.total) + '</b> is extra: save it for the slow months or reach a goal sooner, and leave the wants line alone.'; }
            else out.textContent = 'Type a deal amount to see the set-aside.';
            var st2 = ctx.load(); st2.budget = { income: num(income.value), deal: d }; LINES.forEach(function (l) { st2.budget[l[0]] = Number(ranges[l[0]].value) || 0; }); ctx.save();
        }
        income.addEventListener('input', render); $(host, '#deal').addEventListener('input', render);
        LINES.forEach(function (l) { ranges[l[0]].addEventListener('input', render); });
        $(host, '#ex').addEventListener('click', function () { income.value = 200; var p = [40, 90, 10, 60]; LINES.forEach(function (l, i) { ranges[l[0]].max = '200'; ranges[l[0]].value = p[i]; }); $(host, '#deal').value = 500; render(); });
        $(host, '#clr').addEventListener('click', function () { LINES.forEach(function (l) { ranges[l[0]].value = 0; }); $(host, '#deal').value = 0; render(); });
        render();
    }

    /* ---------- 3. Savings goal tracker ---------- */
    function goalTool(host, ctx) {
        host.innerHTML = '<section class="tool" aria-labelledby="t3"><h2 id="t3">Savings goals</h2>' +
            '<p>Name something you are saving for, set the price, and log what you put in. It stays on this phone.</p>' +
            '<form id="gform" novalidate><div class="field"><label for="gname">What are you saving for?</label><input class="plain" id="gname" type="text" maxlength="40" autocomplete="off" placeholder="Shoes, laptop, first car"></div>' +
            moneyField('gtarget', 'It costs', '', '') + '<button class="btn" type="submit">Add goal</button><p class="hint small" id="gmsg" aria-live="polite"></p></form>' +
            '<div id="glist"></div>' +
            '<p class="fine">Simple math, not advice. Where to keep the money (insured savings or something else) is covered in Modules 04 and 05.</p></section>';
        var list = $(host, '#glist');
        function drawList() {
            var goals = ctx.load().goals || [];
            if (!goals.length) { list.innerHTML = '<p class="small" style="margin-top:14px">No goals yet. Add one above.</p>'; return; }
            list.innerHTML = '';
            goals.forEach(function (g) {
                var p = g.target ? Math.min(100, g.saved / g.target * 100) : 0, left = Math.max(0, g.target - g.saved), done = left === 0;
                var d = ctx.el('div', { 'class': 'goal' });
                d.innerHTML = '<h3>' + ctx.esc(g.name) + '</h3><div class="gstat">' + money(g.saved) + ' of ' + money(g.target) + (done ? '. Goal reached.' : ' &middot; ' + money(left) + ' to go') + '</div>' +
                    '<div class="meterbar" role="img" aria-label="' + Math.round(p) + ' percent saved"><i style="width:' + p + '%"></i></div>' +
                    '<div class="row"><div class="field" style="margin:0;flex:1 1 130px"><label for="a-' + g.id + '" class="small">Add to it</label><div class="money"><span aria-hidden="true">$</span><input id="a-' + g.id + '" type="text" inputmode="decimal" autocomplete="off"></div></div>' +
                    '<button type="button" class="btn small" data-add="' + g.id + '">Add</button></div>' +
                    '<div class="row" style="margin-top:10px"><div class="field" style="margin:0;flex:1 1 130px"><label for="m-' + g.id + '" class="small">If you put in this much a month</label><div class="money"><span aria-hidden="true">$</span><input id="m-' + g.id + '" type="text" inputmode="decimal" autocomplete="off" value="' + (g.monthly || '') + '"></div></div></div>' +
                    '<p class="small" id="mo-' + g.id + '" aria-live="polite"></p>' +
                    '<button type="button" class="linkbtn" data-del="' + g.id + '">Delete this goal</button>';
                list.appendChild(d);
                var m = d.querySelector('#m-' + g.id), out = d.querySelector('#mo-' + g.id);
                function months() { var mv = num(m.value); var gg = byId(g.id); if (gg) { gg.monthly = mv; ctx.save(); }
                    out.textContent = done ? '' : mv > 0 ? 'About ' + Math.ceil(left / mv) + (Math.ceil(left / mv) === 1 ? ' month' : ' months') + ' to get there.' : ''; }
                m.addEventListener('input', months); months();
            });
        }
        function byId(id) { return (ctx.load().goals || []).filter(function (g) { return g.id === id; })[0]; }
        $(host, '#gform').addEventListener('submit', function (e) {
            e.preventDefault();
            var name = $(host, '#gname').value.trim(), t = num($(host, '#gtarget').value), msg = $(host, '#gmsg');
            if (!name || t <= 0) { msg.textContent = 'Add a name and what it costs.'; return; }
            var s = ctx.load(); s.goals = s.goals || [];
            if (s.goals.length >= 12) { msg.textContent = 'That is plenty of goals for now. Finish one first.'; return; }
            s.goals.push({ id: 'g' + Date.now().toString(36), name: name, target: t, saved: 0, monthly: 0 }); ctx.save();
            $(host, '#gname').value = ''; $(host, '#gtarget').value = ''; msg.textContent = 'Added.'; drawList();
        });
        list.addEventListener('click', function (e) {
            var add = e.target.getAttribute && e.target.getAttribute('data-add'), del = e.target.getAttribute && e.target.getAttribute('data-del');
            if (add) { var g = byId(add), v = num($(host, '#a-' + add).value); if (g && v > 0) { g.saved = Math.min(CAP, g.saved + v); ctx.save(); drawList(); ctx.toast('Added ' + money(v)); var again = $(host, '#a-' + add); if (again) again.focus(); } }
            if (del && window.confirm('Delete this goal?')) { var s = ctx.load(); s.goals = s.goals.filter(function (x) { return x.id !== del; }); ctx.save(); drawList(); $(host, '#gname').focus(); }
        });
        drawList();
    }

    root.HonorMoney = { render: function (host, tool, ctx) { ({ tax: tax, budget: budget, goal: goalTool }[tool] || tax)(host, ctx); } };
})(window);
