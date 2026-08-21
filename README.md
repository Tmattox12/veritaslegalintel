# Veritas Template — Generic Demo & Testing Version

This is a **clean, generic fork** of Veritas tailored for demo, testing, and future client onboarding. It contains **80% of the core functionality** without any Ossandon-case-specific data or hardcoded client references.

## Key Differences from `../webapp/` (Production Ossandon)

- **No case-specific hardcoding**: Removes all real party names (Luis, Coni, Nico, Constanza, Martin, Joaquin), real dollar figures, real document paths, and real account numbers.
- **Sample data only**: Uses a fictional "Anderson v. Anderson" case (`sampleData.js`) for all calculations and displays.
- **No external asset dependencies**: Excludes the 80MB+ of real PDFs, exhibits, and generated Excel workbooks (`support-pdfs/`, `exhibits/`, all `.xlsx` and case-specific `.json` files).
- **Upload-ready structure**: The infrastructure (backend models, API routes, frontend form scaffolds) exists to wire real file uploads and document processing in a future phase.

## File Structure

```
webapp-template/
├── README.md                              (this file)
├── sampleData.js                          (fictional Anderson v. Anderson case data)
├── app.js                                 (generic dashboard with sample stats)
├── reconData.js                           (sample bank/card transactions)
├── calculations-registry.js               (sample income calculations)
├── doc-linking-integration.js             (genericized examples)
│
├── [Generic infrastructure — unchanged from ../webapp/]
├── api-client.js, case-manager.js, sync-handler.js, calculator.js
├── income-types-registry.js, safe-text.js, doc-linking.js
├── document-support-integration.js, styles.css, calculator.css
│
├── [Analysis module HTML shells]
├── index.html, afi.html, spousal.html, child-support.html
├── estate.html, equitable-distribution.html, settlement.html
├── forensic-tracing.html, owes.html, income-imputation.html
├── red-flags.html, audit-reconciliation.html, discovery-intake.html
├── case-intake.html, cases.html, custody.html, schedules.html
├── regulations.html, search.html, export.html, auth.html
└── ... (40+ HTML files total)
```

## Getting Started

### 1. Serve Locally
```bash
# Using Python 3
cd webapp-template
python -m http.server 8000

# Or Node.js
npx http-server .
```

Then open `http://localhost:8000/index.html` in your browser.

### 2. Explore the Dashboard
The dashboard (`index.html`) displays sample module stats and activity log pulled from `sampleData.js` and `app.js`. All numbers are fictional but structurally realistic.

### 3. Check Sample Data
- `sampleData.js`: Fictional "Anderson v. Anderson" case with party info, income, expenses, estate snapshot, children.
- `reconData.js`: Sample bank transactions (groceries, restaurants, utilities, childcare, etc.) across 3-month period.
- `calculations-registry.js`: Sample income calculations for both parties.

## Genericization Checklist

✅ **Completed:**
- Removed all Ossandon/Luis/Coni party name references from core infrastructure files  
- Created sample dataset (`sampleData.js`) with fictional party names and realistic financials  
- Rewrote `app.js` dashboard using sample stats instead of real case numbers  
- Genericized `reconData.js` with sample merchant transactions  
- Genericized `calculations-registry.js` with sample income structures  
- Updated `doc-linking-integration.js` examples to use generic references  
- Excluded all `support-pdfs/`, `exhibits/`, and static case `.json` files  

⏳ **Future Phases (out of scope for this initial release):**
- Genericize individual analysis module JS files (afi.js, spousal.js, child-support.js, etc.) to read from sample data instead of hardcoded case values  
- Wire backend upload endpoint to actually receive files (currently stub-only)  
- Implement real document parsing pipeline (CSV → structured data)  
- Add authentication flow for multi-case/multi-user access  

## How to Use for Future Clients

1. **Make a copy** of this template folder with the client's case name (e.g., `client-smith-divorce/`)  
2. **Update `sampleData.js`** with the client's actual party names and key financial facts (but keep demo/test mode separate from production data)  
3. **Set up backend** to ingest their uploaded documents (bank statements, paystubs, tax returns) via the Discovery Intake tab  
4. **Wire documents → module data** (Python scripts or Node.js pipeline) so uploaded CSVs populate the calculation tabs  
5. **Run the analysis modules** against real client data with the same generic UI and calculation logic  

## Notes

- The backend (`backend/` directory) is **not included** in this template folder — it remains in the parent directory and is case-agnostic (multi-tenant User/Case/Document models, no Ossandon-specific code).  
- Static assets (real PDFs, exhibit images) are **excluded** by design. The template's lightweight asset footprint makes it portable.  
- The "upload tab" (`discovery-intake.html`) currently shows a simulated upload UI; real file processing is a next-phase task.  

## Verifying Zero Case Leakage

To double-check no real party names remain:
```bash
grep -r "Ossandon\|Luis\|Coni\|Nico\|Constanza\|Martin\|Joaquin" webapp-template/
```

Should return **zero results** (only in this README as documentation).

---

**Status**: Initial demo-ready release (Phase 1: Frontend generics + sample data)  
**Last Updated**: 2026-08-19
