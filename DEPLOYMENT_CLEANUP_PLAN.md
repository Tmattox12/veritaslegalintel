# Veritas Domain Deployment - Case Data Removal Plan
## Comprehensive Cleanup & Production Deployment Strategy

**Date**: August 20, 2026  
**Status**: Ready for Execution  
**Objective**: Remove all case-specific data (Ossandon, Coni, Luis) and prepare for domain deployment

---

## 📋 CASE DATA INVENTORY

### Files to DELETE (Case-Specific Data)
These files contain ONLY Ossandon/Coni/Luis case data and should be completely removed:

**Case Documentation** (21 files found):
- ❌ `afi-ossandon-completed.json` - Ossandon case template
- ❌ `afi-population-template-ossandon.md` - Ossandon extraction guide
- ❌ `OSSANDON_ACTION_SUMMARY.txt` - Ossandon case analysis
- ❌ `chase-freedom-expense-mapping.md` - Ossandon Chase CC mapping
- ❌ `expense-reconciliation-ossandon.json` - Ossandon inventory
- ❌ `extract_ossandon_income.py` - Ossandon extraction script
- ❌ `extract_ossandon_expenses.py` - Ossandon extraction script
- ❌ `_archive/afi-versions/*` - Old AFI versions (archive folder)
- ❌ `spousal-OLD-BACKUP.html` - Backup file

---

## 📝 FILES TO CLEAN (Contains Case References)

### Core Application Files (KEEP but CLEAN)

#### 1. **index.html** (Main Dashboard)
**Location**: Line references to "Ossandon" cases  
**Action**: 
- Search for: "ossandon", "coni", "luis" (case-insensitive)
- Replace placeholder case names with generic "Sample Case" or remove
- Keep all UI/navigation structure intact

#### 2. **HTML Category Files**
These files may have case references in comments or sample data:
- `document-hub-expenses.html` - Check localStorage references
- `document-hub-income.html` - Check income samples
- `document-hub-assets.html` - Check asset samples
- `document-hub-liabilities.html` - Check debt samples
- `document-hub-investments.html` - Check investment samples
- `document-hub-retirement.html` - Check retirement samples
- `document-hub-realestate.html` - Check property samples
- `document-hub-business.html` - Check business samples
- `document-hub-tax.html` - Check tax document samples
- `document-hub-legal.html` - Check legal document samples

**Action**: Remove any hardcoded case-specific test data, keep templates

#### 3. **income-reconciliation.html**
**Current Content**: Shows Ossandon data
- Helping Hearts Income: $821,913.50 (Ossandon-specific)
- Fleet Feet W-2: $2.00 (Ossandon-specific)
- Nico Social Security: (Ossandon-specific)

**Action**: Clear all sample data, show empty template with explanatory text

#### 4. **afi.html & afi-form-populator.html**
**Current Content**: Ossandon expense mappings
**Action**: Remove case-specific totals, show blank AFI template

#### 5. **Documentation Files to CLEAN** (not delete)
- `BUILD_COMPLETE_SUMMARY.md` - Remove Ossandon statistics
- `EXECUTIVE_SUMMARY.txt` - Remove case references
- `DEPLOYMENT_STATUS.md` - Remove Ossandon from examples
- `ARCHITECTURE_OVERVIEW.md` - Remove case-specific workflows
- `README.md` (if exists) - Update with generic description

---

## 🔍 SEARCH PATTERNS TO CLEAN

These phrases appear throughout files and must be removed/replaced:

### Case Names
- ❌ "Ossandon" → Remove or replace with "[Case Name]"
- ❌ "Coni" → Remove or replace with "[Party Name]"
- ❌ "Luis" → Remove or replace with "[Party Name]"
- ❌ "Nico" → Remove or replace with "[Party Name]"
- ❌ "Petitioner v. Respondent" → Keep as template text

### Specific Data
- ❌ "$821,913.50" (Helping Hearts income)
- ❌ "$17,612.78" (total expenses)
- ❌ "Chase Freedom CC 5013" (specific card ending)
- ❌ "Fleet Feet" (employer)
- ❌ "Helping Hearts" (charity income source)
- ❌ Specific dates: "2024.09" through "2025.03"

### File References
- ❌ "Ws Chase Freedom CC" (specific statements)
- ❌ "2024.11.06 Nico SS Income.pdf"
- ❌ "2025 W2 FF.pdf"
- ❌ Any actual PDF filenames from Ossandon case

---

## 📂 DIRECTORY CLEANUP

### Folders to DELETE entirely:
```
_archive/                    # Old versions (safe to remove)
.regulations-cache/         # Generated cache (can rebuild)
```

### Folders to CLEAN (not delete):
```
.localStorage/              # Clear test data if exists
```

### Folders to KEEP intact:
```
All HTML files (cleaned)
All JS libraries (unchanged)
All CSS files (unchanged)
Documentation (cleaned)
```

---

## 🗑️ FILES TO DELETE - COMPLETE LIST

```
DELETE THESE FILES:
├── afi-ossandon-completed.json
├── afi-population-template-ossandon.md
├── OSSANDON_ACTION_SUMMARY.txt
├── chase-freedom-expense-mapping.md
├── expense-reconciliation-ossandon.json
├── extract_ossandon_income.py
├── extract_ossandon_expenses.py
├── spousal-OLD-BACKUP.html
├── _archive/                    (entire directory)
└── .regulations-cache/          (entire directory)
```

---

## 🧹 CLEANING SCRIPT TEMPLATE

After cleanup, the application will show:

### Income Reconciliation Page (Cleaned)
```
INCOME RECONCILIATION

W-2 Employment Income:
  Gross Income: [Enter amount]
  Status: [Awaiting verification]

Social Security Income:
  Monthly Amount: [Enter amount]
  Status: [Awaiting verification]

Other Income:
  Source: [Enter details]
  Annual Amount: [Enter amount]
  Status: [Awaiting verification]

[Enter and save your income data]
```

### AFI Form (Cleaned)
```
AFI DISCREPANCY ANALYSIS

Data Sources: [Ready for your documents]
- Upload bank statements
- Upload income documents
- System will auto-categorize

Categories (Ready to populate):
Line 1: Health Insurance    [Awaiting data]
Line 2: Childcare           [Awaiting data]
Line 3: Medical/Dental      [Awaiting data]
... (etc for all 8 lines)

[Upload your documents to begin]
```

---

## 📦 DEPLOYMENT CHECKLIST

### Phase 1: Data Removal (2-3 hours)
- [ ] Delete 9 case-specific files
- [ ] Delete `_archive/` folder
- [ ] Delete `.regulations-cache/` folder
- [ ] Search and remove all "Ossandon" references
- [ ] Search and remove all "Coni" references
- [ ] Search and remove all "Luis" references
- [ ] Remove specific financial data ($821,913.50, etc.)
- [ ] Remove case-specific filenames from documentation

### Phase 2: Template Verification (1 hour)
- [ ] Verify income-reconciliation.html shows blank template
- [ ] Verify afi.html shows blank AFI form
- [ ] Verify afi-form-populator.html is case-neutral
- [ ] Verify all document hub pages have no hardcoded data
- [ ] Test that localStorage is empty on fresh load

### Phase 3: Documentation Update (1 hour)
- [ ] Update BUILD_COMPLETE_SUMMARY.md - remove Ossandon stats
- [ ] Update EXECUTIVE_SUMMARY.txt - remove case references
- [ ] Update DEPLOYMENT_STATUS.md - generic instructions
- [ ] Create USAGE_GUIDE.md - how to use the system
- [ ] Create SETUP_INSTRUCTIONS.md - deployment guide

### Phase 4: Domain Setup (1-2 hours)
- [ ] Prepare cleaned files for upload
- [ ] Set up domain hosting (Netlify, Vercel, AWS, etc.)
- [ ] Upload cleaned application
- [ ] Test in production environment
- [ ] Set up SSL/HTTPS
- [ ] Configure domain DNS

### Phase 5: Quality Assurance (30 mins)
- [ ] Test all navigation links
- [ ] Test document upload functionality
- [ ] Verify no case data in localStorage
- [ ] Check console for errors
- [ ] Test responsive design on mobile/tablet/desktop

---

## 🚀 DEPLOYMENT OPTIONS

### Option A: Cloud Hosting (RECOMMENDED)
**Netlify** (easiest)
- Free tier available
- Auto-deploys from folder
- HTTPS included
- Perfect for static site

**Vercel** (modern)
- Excellent performance
- Zero-config deployment
- Built-in optimization
- Great for JavaScript

**AWS S3 + CloudFront**
- More control
- Scalable
- CDN included
- Slightly complex

### Option B: Traditional Web Hosting
- FTP-based deployment
- More familiar
- Requires manual setup
- Good for shared hosting

---

## 📋 FINAL VERIFICATION CHECKLIST

Before going live:
- [ ] No file named "ossandon*" anywhere
- [ ] No file named "coni*" anywhere
- [ ] No file named "luis*" anywhere
- [ ] No $821,913.50 in any HTML file
- [ ] No $17,612.78 in any HTML file
- [ ] No "Chase Freedom CC 5013" references
- [ ] No "Fleet Feet" references (except as example)
- [ ] No "Helping Hearts" income data (except as template)
- [ ] localStorage is empty on fresh load
- [ ] All forms show blank templates
- [ ] All 10 document hubs ready for fresh data

---

## 📞 WHAT YOU NEED TO PROVIDE

To complete deployment, I'll need:
1. **Domain name** (where you want it hosted)
2. **Hosting preference** (Netlify, Vercel, AWS, etc.)
3. **Hosting credentials** (if needed for upload)
4. **Any custom branding** (logo, company name, colors)
5. **Admin email** (for support/notifications)

---

## ⏱️ TIMELINE

- **Cleanup**: 2-3 hours
- **Verification**: 1 hour
- **Documentation**: 1 hour
- **Domain Setup**: 1-2 hours
- **QA Testing**: 30 minutes

**Total**: 5.5 - 7.5 hours

---

## 🎯 NEXT STEPS

I can execute this plan in this order:

1. **Identify & Delete** all case data files
2. **Search & Remove** case references from all files
3. **Verify** templates are clean and ready
4. **Create** deployment documentation
5. **Prepare** for domain upload
6. **Guide you through** hosting setup

Ready when you are. Just confirm the domain name and hosting preference!

---

**Status**: READY TO EXECUTE  
**Approval Needed**: Domain name + Hosting choice

