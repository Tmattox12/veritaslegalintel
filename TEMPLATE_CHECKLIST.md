# Veritas Template — Implementation Checklist

## Phase 1: ✅ COMPLETE — Frontend Demo Ready

### Core Infrastructure
- [x] Scaffold `webapp-template/` folder
- [x] Copy generic infrastructure JS (api-client, case-manager, calculator, etc.)
- [x] Copy Veritas branding CSS (styles.css, calculator.css)
- [x] Copy 40 HTML analysis module shells
- [x] Verify zero case-specific names in all infrastructure files

### Sample Data Layer
- [x] Create `sampleData.js` with fictional Anderson v. Anderson case
- [x] Create generic `app.js` dashboard using sample data
- [x] Create generic `reconData.js` with sample transactions
- [x] Create generic `calculations-registry.js` with sample income
- [x] Update `doc-linking-integration.js` examples to use generic references

### Documentation
- [x] Create `README.md` in template folder (usage guide, structure, future phases)
- [x] Create `TEMPLATE_SETUP_SUMMARY.md` in parent repo (what was done, how to use)
- [x] Create this checklist (tracking progress for future phases)

### Verification
- [x] Grep sweep: `app.js`, `reconData.js`, `calculations-registry.js`, `sampleData.js`, `doc-linking-integration.js` all have ZERO Ossandon/Luis/Coni/Nico names
- [x] File count: 56 files, 1.2MB (vs. 900MB original with PDFs)
- [x] Entry point: `index.html` loads with sample dashboard stats

---

## Phase 2: TODO — Genericize Analysis Modules

These 10 JS modules contain hardcoded case values and need to be rewritten to read from `sampleData.js`:

### High Priority (Core Financial Analysis)
- [ ] `afi.js` — Expense discrepancy analysis
  - Currently hardcodes real transaction lists
  - Should read from `reconData.js` sample transactions
  - Expected lines to change: ~200-300
  
- [ ] `spousal.js` — Spousal maintenance calculator
  - Currently embeds real income figures and BLS bands
  - Should read from `calculations-registry.js` sample income
  - Expected lines to change: ~400-500
  
- [ ] `child-support.js` — Child support worksheet
  - Currently has hardcoded party names and income
  - Should use `SAMPLE_CASE.parties`, `SAMPLE_CASE.children`, income from registry
  - Expected lines to change: ~300-400

- [ ] `estate.js` — Asset/liability inventory
  - Currently lists real account numbers and balances
  - Should use `SAMPLE_CASE.estateAtDateOfService` structure
  - Expected lines to change: ~150-200

### Medium Priority (Related Calculations)
- [ ] `equitable-distribution.js` — Property division
- [ ] `forensic-tracing.js` — Asset tracing
- [ ] `income-imputation.js` — Income calculation imputation
- [ ] `owes.js` — Obligation summary
- [ ] `settlement.js` — Settlement modeling

### Lower Priority (Utility & Display)
- [ ] `red-flags.js` — Red flag detection
- [ ] `audit-reconciliation.js` — Reconciliation display
- [ ] `discovery-intake.js` — Document upload UI (currently simulated, already mostly generic)
- [ ] `document-support-registry.js` — Document registry examples

### Search & Replace Pattern
For each module, the pattern is:
1. Replace hardcoded `const LuisName = 'Luis';` with reads from `SAMPLE_CASE.parties.petitioner.name`
2. Replace hardcoded dollar amounts with reads from `calculations-registry.js` or `sampleData.js`
3. Replace real transaction lists with `reconData.js` categories
4. Keep all calculation logic, render logic, UI patterns **unchanged**
5. Add sample data guards: `if (!SAMPLE_CASE) { console.error('sample data not loaded'); return; }`

---

## Phase 3: TODO — Real File Upload Pipeline

### Backend (Node.js Express)
- [ ] Implement real `POST /documents/upload` endpoint (currently stub at `backend/routes/documents.js:19-39`)
  - Use `multer` to receive file bytes
  - Store to local disk or S3 (AWS creds in `.env`)
  - Populate `Document.s3Url` or `filepath` field
  - Call parsing service (Python or Node.js)

### Document Parsing (CSV → Structured Data)
- [ ] Build CSV parser (transactions from bank statements)
  - Input: uploaded CSV with columns like `Date | Description | Amount`
  - Output: structured records in database (`Transaction` model)
  - Call from backend upload handler

- [ ] Build PDF text extraction (paystubs, tax returns)
  - Input: PDF file (paystub, tax return, discovery doc)
  - Output: extracted text + metadata (party name, date, amounts)
  - Use `pdfjs` (client-side, limited) or `PyPDF2`/`pdf2image` (server-side, better)

### Frontend Upload Flow
- [ ] Wire `discovery-intake.js` upload UI to real backend endpoint
  - Currently: `simulateUpload()` shows fake progress bar → nothing happens
  - Replace with: real FormData POST → backend receives file
  - Show real upload progress from `XMLHttpRequest.upload.onprogress`

- [ ] Update `PROCESSED_DOCS` display to pull from `GET /documents?caseId=X`
  - Currently: hardcoded mock docs array (line 40-65)
  - Replace with: API call, render returned documents

### Database Schema Extension (if needed)
- [ ] Add `Transaction` model (Date, Amount, Description, Category, CaseID, DocumentID)
- [ ] Add `ParsedPaystub` model (StartDate, EndDate, GrossAmount, YTD, CaseID, DocumentID)
- [ ] Link via `DocumentID` back to `Document` model

---

## Phase 4: TODO — Multi-Case Management UI

### Backend (Already partially exists in Prisma schema)
- [ ] Verify `Case.collaborators[]` and `Case.ownerId` are properly enforced in all routes
- [ ] Add case-level permissions (who can see/edit this case's documents?)

### Frontend
- [ ] Build cases dashboard (`cases.html` — already exists, needs wiring)
  - List all cases the user owns or is collaborating on
  - Link to each case's analysis modules

- [ ] Wire case selector to analysis modules
  - When user switches cases, reload all calculations against that case's documents

- [ ] Build case intake form
  - Create new case: enter party names, children, court info
  - Pre-populate `sampleData.js` structure with real values
  - Save to backend as new `Case` record

---

## Phase 5: TODO — Production Hardening

- [ ] Add CSRF protection (currently backend has no CSRF middleware)
- [ ] Implement rate limiting on upload endpoint
- [ ] Add audit logging (who accessed what documents when?)
- [ ] Encrypt sensitive data at rest (PII in documents, email addresses, SSN fragments)
- [ ] Add data retention policy (how long to keep uploaded docs after case closes?)
- [ ] Test with real file sizes (current upload endpoint never tested with >1MB files)

---

## Testing Checklist

### Phase 1 Verification (Do This Now)
- [ ] Open `http://localhost:8000/index.html` — dashboard loads
- [ ] Click "Discovery Intake" tab — loads without errors
- [ ] Console (F12) shows no `Uncaught ReferenceError: Luis is not defined` errors
- [ ] Grep for case names: `grep -r "Ossandon\|Luis\|Coni" webapp-template/*.js` returns ZERO
- [ ] Dashboard stats show sample numbers (e.g., "$2,850/mo · 11 yr" for spousal)

### Phase 2 Testing
- [ ] Each genericized module loads its sample data correctly
- [ ] Changing sample data in `sampleData.js` re-calculates numbers in modules
- [ ] No hardcoded Ossandon/Luis/Coni references remain in JS (except HTML embedded data)

### Phase 3 Testing
- [ ] Upload a test CSV file → file appears in file list
- [ ] Transactions from CSV are parsed and appear in AFI module
- [ ] Upload a paystub PDF → extracted income appears in spousal/child-support calculators

### Phase 4 Testing
- [ ] Create two sample cases → both appear in cases dashboard
- [ ] Switch cases → all calculations update to new case's data
- [ ] Add a collaborator → they can see and edit the case

### Phase 5 Testing
- [ ] Audit log shows who uploaded what and when
- [ ] Test with 50MB file upload → completes without timeout
- [ ] Sensitive data is encrypted in database

---

## Notes for Future Development

### Architecture Observations
1. **CLI vs. UI**: Currently you have Python scripts (build_*.py) that generate Excel workbooks offline. Future should be: user uploads documents → web UI processes & displays → no offline step needed.

2. **Data Flow**: Real Ossandon workflow: `hard-drive folders → Python builds Excel → manual calculations → stored in git`. Template workflow should be: `Upload tab → Document parsing → Veritas calculates & displays → saved in database → exportable Excel (optional)`.

3. **Reusability**: The 80% of calculation logic (spousal support formula, child support worksheet, AFI variance) is all here and works. The other 20% is UI/data-plumbing (upload, parse, display). Focus Phase 2-3 on that plumbing, not recalculating the math.

4. **Ossandon as Living Demo**: Keep the original `webapp/` (pointing to real case data via Python builds) as a **reference implementation** and demo of what the finished product looks like with real data. Template is the blank slate others fill in.

---

**Last Updated**: 2026-08-19  
**Template Status**: Phase 1 ✅ Complete  
**Ready for**: Demo, testing, future client setup
