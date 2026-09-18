# Veritas Morning Handoff

Date: 2026-09-17

## Current State

- Local backend: run `start-veritas.bat` (double-click) and leave the window open.
  Starting it inside a terminal that later closes is what made the app look empty
  twice this week — a stopped backend renders every page as zeros.
- Frontend: Live Server on `http://127.0.0.1:5502`.
- Everything is committed and pushed. `origin/main` is at `f804ad2`.
- Real documents and the database stay local and gitignored. Do not purge
  `.data/` or `server/uploads/`.

### Matters — unresolved duplicate

| Matter id | Docs | Transactions |
|---|---|---|
| `04042bf8-c744-46ee-a2af-583825acee06` | 127 | 3,430 |
| `6cdff522-2dac-4731-926e-f159da6e29e9` | 127 | 3,485 |

Both are fully populated. Work has been split across them because the matter
selector used to adopt the first matter on every page load (fixed). Decide which
is authoritative before either is deleted.

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

## Open Defects — imputed income is overstated

These are known and unfixed. They matter because they feed support calculations.

1. **"Interest Payment" — $110,805 across 49 rows.** Not interest. One savings
   statement shows $25,186; account 1874 shows ~$13,170/month climbing by a near
   constant ~$967. That is a balance column being read as the transaction
   amount. This is roughly a third of the deposit-derived income figure and is
   the single biggest thing to fix.
2. `Manual CR-Bkrg` ($29,475) and `JPMorgan Chase Chase ACH` ($17,342) look like
   transfers being counted as income.
3. `Tucson Crossroad Web Pmts` — 14 payments of exactly $1,967.50 ($27,545,
   2024-01 to 2026-06). An unidentified fixed obligation, probably rent,
   mortgage or tuition. Left unclassified rather than guessed.

## First Tasks Tomorrow

1. Start the backend with `start-veritas.bat`, then hard-refresh
   `discovery-intake.html` (Ctrl+Shift+R) so the new taxonomy loads.
2. Confirm the AFI mapper renders and that Apple/Prime now appear as
   **discretionary**, not Utilities — your spec reversed an earlier call, so only
   basic cable kept for news or communication is a utility.
3. Decide what `Tucson Crossroad Web Pmts` is and map it. At $27,545 it is the
   largest single unclassified obligation.
4. Fix the "Interest Payment" balance-column misread in the statement parser,
   then re-run classification.
5. Decide which of the two Ossandon matters is authoritative.
6. Review the 489 still-unclassified expense rows ($38,125) in the mapper.
7. Three documents remain unverified — `2025.12`, `2026.01`, `2026.02 Acct
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
