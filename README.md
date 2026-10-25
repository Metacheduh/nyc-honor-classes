# NYC Honor Classes

Free money classes for high-school students, as a phone app that works offline. This is the code behind [nychonor.org/app](https://nychonor.org/app), built by NYC Honor Foundation volunteers.

- **Secure the Bag:** seven short lessons on budgeting and banking, NIL deals, taxes, investing, accounts, scams and credit, and insurance. Each has a quiz before and after.
- **Money Tools:** a tax set-aside, a monthly split and savings goals.
- No accounts, no ads, no tracking. Progress stays on the student's own phone (browser storage only).

## Budget Simulator

`budget-simulator/` is the classroom tool at [nychonor.org/budget-simulator](https://nychonor.org/budget-simulator): five steps in one class period (a first paycheck with 2026 federal, New York State and NYC taxes, needs/wants/savings, an emergency fund, the credit card minimum-payment trap, and starting to save at 16 vs 25). The math is in `budget-simulator/budget-simulator.js`, which also loads in Node (`require('./budget-simulator/budget-simulator.js')`) so you can test it. Update the `TAX` and `MIN_WAGE` figures each year.

## Run your own copy

It's plain HTML, CSS and JavaScript with no build step.

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000/app/ or http://localhost:8000/budget-simulator/. To host it, upload the folder to any static host (Netlify, GitHub Pages, a school web server).

Lessons live in `app/data/nil/01.json` to `07.json`, and the class list is in `app/data/classes.json`. Edit those to adapt the content. Tax figures are for 2026; check them against the IRS and your state before each school year.

## Licenses

- **Code** (JavaScript, HTML, CSS): MIT, see `LICENSE`.
- **Lesson content** (`app/data/`, the trailer and its captions): [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/), see `CONTENT_LICENSE.md`. Free to share and adapt, with credit, not for sale.
- **Fonts:** Inter and JetBrains Mono, under the SIL Open Font License.
- **Name and logo:** "NYC Honor" and the crest are not covered by any of these licenses. If you run your own copy, replace them with your own.

Lessons are educational only, not tax, legal or investment advice.
