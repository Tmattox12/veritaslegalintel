# Veritas Morning Handoff

Date: 2026-09-18

## Current State

- Local backend: run `start-veritas.bat` (double-click) and leave the window open.
  Starting it inside a terminal that later closes is what made the app look empty
  twice this week — a stopped backend renders every page as zeros.
- Frontend: Live Server on `http://127.0.0.1:5502`.
- Everything is committed and pushed. `origin/main` is at `f804ad2`.
- Real documents and the database stay local and gitignored. Do not purge
  `.data/` or `server/uploads/`.

### Matter

Use **`04042bf8-c744-46ee-a2af-583825acee06`** (Ossandon, Pima, AZ, 127 docs).
The duplicate `6cdff522…` (the original Sept 5 intake) was archived on
2026-09-18 — soft-deleted, every row retained, recoverable.

Database backups taken today, before each data change:
`.data/veritas.sqlite.bak-20260917-165728` and `.bak-reclass-*`.

## Completed Today

- **Bulk intake no longer stalls.** Batches over 20 files ran one at a time and
  looked frozen; reloading to retry abandoned the queue, which is why repeated
  attempts landed only 2–4 files. Concurrency is 4, and the browser now warns
  before you navigate away mid-batch.
- **The active matter survives a backend outage.** An unreachable backend was
  treated as proof the matter no longer existed and its id was deleted from
  browser storage.
- **Withdrawals are no longer counted as income.** Direction was decided from the
  sign of the amount alone. 14 stored rows corrected; none remain.
- **Fuel and gas precedence fixed.** $1,718 of fuel bought at Fry's and Safeway
  pumps was filed as groceries; Southwest Gas would have been transportation.
- **AFI-aligned taxonomy.** `afi-taxonomy.js` is now the single definition of
  expense categories, mirroring AFI sections 6–10 plus discretionary and
  excluded. It had been defined three times over (mapper, workbook, parser).
  5,539 stored rows re-classified. 81.5% coverage on real data.
- **CSV exports carry the account.** Account, Account Type and Source File, so a
  figure can be traced back to the statement it came from.
- Cache versions: `discovery-intake-uploads.js?v=23`, `afi-taxonomy.js?v=1`,
  `discovery-intake-afi.js?v=9`.

## Completed 2026-09-18

- **"Interest Payment" misread fixed.** Chase PDFs drop the amount column from
  part of the text layer, leaving the balance in its place — $0.39 of interest
  was recorded as $25,186.83. The parser now resolves each row against the
  statement's ending balance and Deposits total, and only accepts a proven
  reading. 29 statements corrected; interest now totals $4.05, not $110,805.
  A $20,244.80 "Transfer To CD" recorded as income is now an expense.
- 12-month deposit-derived income: **$116,855 → $19,715** (review-only).
- `Tucson Crossroad Web Pmts` ($1,967.50/mo) confirmed as **rent/mortgage**.
- `JPMorgan Chase Chase ACH` confirmed as **cash/investment transfer**; excluded
  from income. Worth re-confirming: it is biweekly, a fixed $1,570.10, and
  PPD-coded, which is the pattern of a payroll deposit.
- Duplicate matter archived; `04042bf8` is authoritative with State set to AZ.

## Still Open

1. `Manual CR-Bkrg` ($29,475, 3 rows) still counts as income — likely a
   brokerage transfer; needs your call.
2. Two transfer rows on `2024.01 Acct 3063.pdf` have an unproven split (their
   total is proven). Flagged `amountUncertain` in the parser.

## First Tasks Tomorrow

1. Start the backend with `start-veritas.bat`, then hard-refresh
   `discovery-intake.html` (Ctrl+Shift+R) so the new taxonomy loads.
2. Confirm the AFI mapper renders and that Apple/Prime now appear as
   **discretionary**, not Utilities — your spec reversed an earlier call, so only
   basic cable kept for news or communication is a utility.
3. Say what `Manual CR-Bkrg` is.
4. Review the still-unclassified expense rows in the mapper.
5. Three documents remain unverified — `2025.12`, `2026.01`, `2026.02 Acct
   3063.pdf`. Their Chase text layer is boilerplate only; even the balance
   summary is empty, so zero activity cannot be confirmed from text.
   `ANTHROPIC_API_KEY` is configured, so
   `POST /api/documents/:id/retry-extraction` with `{useOcr: true}` can settle
   it. It bills and sends financial documents to an external API.

## Technical Follow-Up

- Clothing and personal necessities are Section 7 needs with no box on the
  eight-line `afi-form-populator.html`. They report in their own section but
  cannot be pushed to the form without rebuilding it.
- AFI merchant overrides are still browser-local `localStorage`. A server-side
  table is needed if mappings must follow the matter across devices.
- The parser fix only affects newly parsed statements. Stored rows were
  corrected by targeted update, not by reprocessing.
- Verify the trailing-average definition with counsel: it uses calendar months
  between the first and last observed deposit, with missing months as zero.
- Local mode stays `AUTH_MODE=none` and `TUNNEL_MODE=none`. Do not imply
  production confidentiality until deployment is configured.
- Before committing, inspect `git diff`. Never commit `.data/`, SQLite files,
  uploads, or real client documents. `.gitignore` covers these today and the
  pushed history has been checked for client names and credentials.

## Safe Shutdown

Everything is committed and pushed; nothing is held only in a running process.
Close the backend window and Live Server. Tomorrow, double-click
`start-veritas.bat`, start Live Server, and hard-refresh.
