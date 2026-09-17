# Veritas Morning Handoff

Date: 2026-09-06

## Current State

- Local backend: `node server/index.js` on `http://localhost:3000`.
- Frontend: Live Server on `http://127.0.0.1:5502`.
- Active real matter id: `6cdff522-2dac-4731-926e-f159da6e29e9`.
- Real documents/database remain local and gitignored. Do not purge `.data/` or `server/uploads/`.
- Current uncommitted product files:
  - `server/index.js`
  - `income-imputation.js`
  - `income-imputation.html`
  - `discovery-intake-afi.js`
  - `discovery-intake.html`
  - `discovery-bridge.js`

## Completed Tonight

- Added account-wide statement classification. Changing one account statement can update every matching filename/account token together.
- Added explicit statement options:
  - Bank Account Statement (feeds AFI expenses)
  - Credit Card Statement (feeds AFI expenses)
  - Pay Stub (links to Income)
- Added merchant auto-mapping for common merchants.
  - Walmart, Safeway, Sam's Club, Costco, Target -> groceries / AFI Line 8.
  - Medical, gas/auto, utilities, insurance, childcare, education, housing patterns are covered.
  - Ambiguous merchants remain for review.
- Amazon/AMZN is classified as `shopping` and now appears in a visible `Shopping / Discretionary` review row instead of disappearing into groceries or the unresolved list.
- AFI manual merchant overrides now persist by matter in localStorage.
- Income review workflow exists:
  - pay stubs and benefits are reviewed by party;
  - annual amount must be entered before acceptance;
  - accepted-only evidence feeds calculation-ready income;
  - bank deposit candidates remain review-only.
- Income Engine cards exist for:
  - 12-month average
  - 6-month average
  - 3-month average
  - last-month run-rate
  - accepted document income
- Income basis selection now requires confirmation for review-only bank candidates and persists by matter.
- Shared AFI/spousal/child-support discovery bridge now displays the selected basis and amount for each party, with a review warning and no automatic legal-calculation write.
- Income averages now include calendar gaps as zero months to avoid overstating trailing averages.
- Cache versions updated:
  - `discovery-intake-uploads.js?v=21`
  - `discovery-intake-afi.js?v=6`
  - `income-imputation.js?v=2`

## Live Validation

- `node --check server/index.js` passed.
- `node --check income-imputation.js` passed.
- `node --check discovery-intake-afi.js` passed.
- Editor diagnostics are clear for all five touched files.
- Live `/api/matters/:id/income-analysis` responds successfully.
- Current analysis reported 36 calendar months of coverage, 12-month and 6-month candidate values, and `$0` accepted income because no evidence has been explicitly accepted yet.

## First Tasks Tomorrow

1. Hard-refresh `discovery-intake.html` and verify:
   - Amazon appears under `Shopping / Discretionary`.
   - Walmart/Safeway appear in AFI Line 8.
   - manual merchant mappings survive refresh.
2. Hard-refresh `income-imputation.html` and verify the income card grid renders.
3. Open the review modal and review the three current income evidence records:
   - `2024.08 Ws SS Stmt.pdf`
   - `2024.11.06 Nico SS Income.pdf`
   - `2025.05.15 Helping Hearts.pdf`
   Assign the correct party and enter attorney-confirmed annual amounts before accepting. Do not annualize a single pay stub automatically.
4. Decide whether Amazon should remain entirely discretionary or whether selected Amazon merchants should be manually moved to groceries/education/other. The persisted merchant override supports this.
5. Test `Push to AFI` and confirm `afi_form_draft` contains monthly lines 1-8 without transfers, card payments, Zelle, Venmo, PayPal, or OCR outliers.
6. Wire the selected basis into each page's actual calculation contract only after confirming the field mapping; the shared bridge display is complete but deliberately read-only.
7. Add a visible selected-basis/source summary to any remaining calculation panels before allowing calculation use.
8. Review the two remaining unclassified documents manually:
   - `2024.04.05 Fleet Feet.pdf`
   - `Screenshot.pdf`

## Technical Follow-Up

- `income-imputation.js` currently shows the same unassigned bank candidate bases for both parties. Keep them visibly labeled as shared/unassigned unless account-to-party assignment is added.
- Consider adding a server-side persistence table for AFI merchant mappings if mappings must follow the matter across browsers/devices; localStorage is currently browser-local.
- Verify the income-analysis average definition with counsel: current trailing averages use calendar months between first and last observed deposit, with missing months as zero.
- Do not enable Entra/Azure tunnel or imply production confidentiality until deployment is explicitly configured. Local mode remains `AUTH_MODE=none` and `TUNNEL_MODE=none`.
- Before committing, inspect `git diff` carefully. Never commit `.data/`, SQLite files, uploads, or real client documents.

## Safe Shutdown

The work is saved in the repository and this handoff file. It is safe to stop the local Node server and Live Server tonight. Restart tomorrow with:

```powershell
cd C:\dev\Veritas_CLEAN
node server\index.js
```

Then start Live Server for the workspace and hard-refresh the two pages.
