# Veritas Document Hub - Testing Guide
## Complete Test Plan & Validation Procedures

---

## 📋 PRE-LAUNCH TESTING

### Phase 1: Navigation & Structure (30 mins)

#### Test 1.1: Sidebar Navigation
```
❑ Open index.html in browser
❑ Verify sidebar loads with Veritas branding
❑ Check "Document Hub" link in sidebar
❑ Click Document Hub → should load document-hub-master.html
❑ Verify active state highlights correctly
❑ Test responsive sidebar on mobile (max-width: 768px)
```

#### Test 1.2: Master Hub Layout
```
❑ Verify header displays "Master Document Hub"
❑ Check stats cards display (Total Docs, Items, Categories, Mapping %)
❑ All stats should show "0" initially (no data yet)
❑ Verify 10 category cards visible:
   ✓ Expenses (💰)
   ✓ Income (💵)
   ✓ Assets (💎)
   ✓ Liabilities (💳)
   ✓ Investments (📈)
   ✓ Retirement (🎯)
   ✓ Real Estate (🏠)
   ✓ Business (🏢)
   ✓ Tax Documents (📋)
   ✓ Legal & Other (📄)
❑ Verify cards are clickable and show hover effect
```

#### Test 1.3: Category Page Links
```
For each category card:
  ❑ Click card → verify correct category page loads
  ❑ Check URL matches expected file:
     - Expenses → document-hub-expenses.html
     - Income → document-hub-income.html
     - Assets → document-hub-assets.html
     - Liabilities → document-hub-liabilities.html
     - Investments → document-hub-investments.html
     - Retirement → document-hub-retirement.html
     - Real Estate → document-hub-realestate.html
     - Business → document-hub-business.html
     - Tax → document-hub-tax.html
     - Legal → document-hub-legal.html
  ❑ Verify category page loads without errors
  ❑ Check sidebar remains visible and functional
```

---

### Phase 2: Upload Functionality (45 mins)

#### Test 2.1: Single File Upload
```
On document-hub-expenses.html:
  ❑ Locate file upload area
  ❑ Click upload button
  ❑ Select single PDF file
  ❑ Verify "Processing..." modal appears
  ❑ Check 5-step timeline displays:
     Step 1: Reading document...
     Step 2: Extracting content...
     Step 3: Categorizing items...
     Step 4: Mapping transactions...
     Step 5: Saving to hub...
  ❑ Verify progress bar animates
  ❑ Verify bot indicator shows (if included in timeline)
  ❑ Wait for completion or timeout (30 seconds max)
  ❑ Verify success notification appears
  ❑ Check extracted count displays
```

#### Test 2.2: Batch Upload
```
On document-hub-expenses.html:
  ❑ Click upload area
  ❑ Hold Ctrl (or Cmd on Mac) and select 3-5 PDF files
  ❑ Verify "Processing..." modal appears
  ❑ Check progress timeline displays
  ❑ Verify timeout protection works (30 seconds)
  ❑ Wait for completion
  ❑ Verify all files processed
  ❑ Check total extracted count = sum of all items from all files
```

#### Test 2.3: Multiple File Formats
```
Upload test files:
  ❑ PDF file (.pdf) → verify extraction works
  ❑ Excel file (.xlsx) → verify extraction works
  ❑ Word file (.docx) → verify extraction works
  ❑ Image file (.jpg, .png) → verify extraction works
  ❑ CSV file (.csv) → verify parsing works
  ❑ TXT file (.txt) → verify parsing works
  ❑ JSON file (.json) → verify parsing works
  
For each format:
  ❑ Verify no console errors
  ❑ Check data extracts correctly
  ❑ Verify counts update properly
```

#### Test 2.4: Error Handling
```
❑ Upload empty file → should handle gracefully
❑ Upload corrupted PDF → should show error notification
❑ Upload very large file (>100MB) → should warn user
❑ Select file then click elsewhere → upload should cancel
❑ Network interruption during upload → should timeout after 30s
```

---

### Phase 3: Auto-Categorization (40 mins)

#### Test 3.1: Confidence Scoring
```
Upload document-hub-expenses.html test file:
  For each extracted item:
  ❑ Verify confidence score displays (0-100%)
  ❑ Items with 75%+ confidence = auto-mapped
  ❑ Items with <75% confidence = manual review needed
  ❑ High confidence items show in main list
  ❑ Low confidence items show in "Unmapped" section
```

#### Test 3.2: Category Mapping
```
Upload test data with known merchants:
  ❑ "AT&T" → should map to Utilities
  ❑ "CVS PHARMACY" → should map to Medical/Dental
  ❑ "Honda payment" → should map to Transportation
  ❑ "Kroger" → should map to Food
  ❑ "Blue Cross" → should map to Health Insurance
  ❑ "Home Depot" → should map to Housing
  ❑ "Taekwondo" → should map to Childcare
  ❑ "Trader Joe's" → should map to Food
  ❑ "Uber" → should map to Transportation
  ❑ "Dental" → should map to Medical/Dental
  
Verify each merchant maps to correct AFI category.
```

#### Test 3.3: Confidence Display
```
❑ High confidence items (75-95%): Green indicator
❑ Medium confidence items (50-74%): Yellow indicator
❑ Low confidence items (<50%): Red indicator
❑ All items show matched keywords
❑ Confidence score updates in real-time
```

---

### Phase 4: Manual Mapping (35 mins)

#### Test 4.1: Mapping Modal
```
On document-hub-expenses.html:
  ❑ Locate unmapped items section
  ❑ Click "Map" button on unmapped item
  ❑ Verify modal popup appears
  ❑ Modal shows:
     - Item date
     - Item merchant/description
     - Item amount
     - 8 category buttons
  ❑ Verify modal is centered and readable
  ❑ Check all 8 AFI categories present:
     Health Insurance, Childcare, Medical/Dental, Education,
     Housing, Utilities, Transportation, Food
```

#### Test 4.2: Category Selection
```
❑ Click each category button in modal
❑ Verify selection updates item category
❑ Verify modal closes after selection
❑ Check item moves from "Unmapped" to mapped section
❑ Verify stats update:
   - Unmapped count decreases
   - Selected category total increases
❑ Show next unmapped item (if exists)
```

#### Test 4.3: Skip Functionality
```
❑ Click "Skip" button on unmapped item
❑ Verify item defers to later
❑ Verify next unmapped item displays
❑ After reviewing all items, can return to skipped ones
❑ Skip count tracks correctly
```

#### Test 4.4: Progress Tracking
```
While mapping items:
  ❑ Progress indicator shows "Item X of Y"
  ❑ Completion percentage updates
  ❑ When all mapped, "Complete!" message shows
  ❑ Stats show 0 unmapped items remaining
```

---

### Phase 5: Data Persistence (25 mins)

#### Test 5.1: localStorage Storage
```
After uploading documents:
  ❑ Open browser DevTools (F12)
  ❑ Navigate to Application → Local Storage
  ❑ Verify hub_expenses key exists
  ❑ Check data contains extracted items
  ❑ Verify data is properly JSON formatted
```

#### Test 5.2: Page Reload Persistence
```
After uploading documents:
  ❑ Note number of extracted items
  ❑ Note mapped/unmapped counts
  ❑ Refresh page (Ctrl+R)
  ❑ Verify documents still display
  ❑ Verify all counts match pre-reload
  ❑ Verify all mapped items still in category
```

#### Test 5.3: Cross-Category Sync
```
❑ Upload items to Expenses category
❑ Go to Master Hub
❑ Verify Expenses card shows updated count
❑ Click Expenses card again
❑ Verify same items still present
❑ Repeat for 2-3 other categories
```

#### Test 5.4: Data Clearing
```
❑ Note current document count
❑ Access reset functionality (if available)
❑ Verify all localStorage data clears
❑ Verify counts reset to 0
❑ Refresh page → counts remain 0
❑ Upload new documents → starts fresh
```

---

### Phase 6: Stats & Reporting (20 mins)

#### Test 6.1: Category Stats
```
On each category page:
  ❑ Total Documents count accurate
  ❑ Items Extracted count accurate
  ❑ Mapping Rate % calculated correctly
  ❑ Per-category totals display correctly
  ❑ Stats update in real-time after new upload
```

#### Test 6.2: Master Hub Stats
```
After uploading to multiple categories:
  ❑ Master Hub shows Total Documents (sum of all)
  ❑ Shows Total Items Extracted (sum of all)
  ❑ Shows Categories Populated (count of non-zero)
  ❑ Shows Avg Mapping Rate % (weighted average)
  ❑ Each category card shows document count
  ❑ Stats reflect all uploaded categories
```

#### Test 6.3: Recent Uploads List
```
After uploading documents:
  ❑ Master Hub "Recent Uploads" section displays
  ❑ Shows latest uploaded files in descending order
  ❑ Shows filename and upload timestamp
  ❑ Shows item count for each upload
  ❑ List updates with each new upload
  ❑ Max of 10 recent uploads shows
```

---

### Phase 7: AFI Expense Integration (30 mins)

#### Test 7.1: AFI Page Button
```
On afi.html:
  ❑ Locate "📁 Upload Expense Documents" button
  ❑ Button is green/prominent
  ❑ Verify button is positioned correctly
  ❑ Click button → opens document-hub-expenses.html
  ❑ Can navigate back to afi.html via sidebar
```

#### Test 7.2: AFI Data Population
```
<<<<<<< HEAD
With Ossandon test data:
=======
With Template Matter test data:
>>>>>>> cbd6749 (Clean stale case data and neutralize templates)
  ❑ Upload Chase Freedom CC statements
  ❑ Verify auto-mapping works (75%+ confidence)
  ❑ Check AFI expense totals:
     - Health Insurance: $1,142.00
     - Childcare: $468.00
     - Medical/Dental: $2,135.94
     - Education: $71.00
     - Housing: $6,813.99
     - Utilities: $2,491.11
     - Transportation: $3,236.09
     - Food: $1,254.65
     - TOTAL: $17,612.78
❑ Verify monthly average: $1,467.60
```

#### Test 7.3: AFI Reconciliation
```
❑ Compare extracted totals to source documents
❑ Verify all transactions accounted for
❑ Check no duplicate amounts
❑ Verify all merchants properly categorized
❑ Cross-check with original PDF statements
```

---

### Phase 8: Notifications (20 mins)

#### Test 8.1: Success Notification
```
After successful upload:
  ❑ Green success notification appears
  ❑ Shows message "Documents processed successfully"
  ❑ Shows count of extracted items
  ❑ Notification auto-closes after 5 seconds
  ❑ User can close manually (X button)
```

#### Test 8.2: Error Notification
```
For error conditions:
  ❑ Red error notification appears
  ❑ Shows descriptive error message
  ❑ Notification stays until dismissed
  ❑ User can close manually (X button)
```

#### Test 8.3: Processing Notification
```
During upload/processing:
  ❑ Processing modal displays
  ❑ 5-step timeline shows with spinner
  ❑ Progress bar animates
  ❑ "Cancel" button available
  ❑ 30-second timeout protection active
  ❑ Auto-closes on completion or timeout
```

#### Test 8.4: Warning Notification
```
For warnings (slow processing, etc):
  ❑ Yellow warning notification appears
  ❑ Shows warning message
  ❑ Notification stays visible longer
  ❑ User can acknowledge and continue
```

---

### Phase 9: Responsive Design (25 mins)

#### Test 9.1: Desktop (1920x1080)
```
❑ Master Hub layout displays correctly
❑ Category cards in 4-column grid
❑ All text readable
❑ Buttons properly sized
❑ Stats cards display nicely
```

#### Test 9.2: Tablet (768x1024)
```
❑ Master Hub layout responsive
❑ Category cards in 2-column grid
❑ Sidebar collapses or adapts
❑ Upload area still functional
❑ Stats cards stack properly
```

#### Test 9.3: Mobile (375x667)
```
❑ Master Hub layout responsive
❑ Category cards in 1-column layout
❑ Sidebar hamburger menu functional
❑ Upload area touch-friendly
❑ No horizontal scrolling
❑ Text remains readable
❑ Buttons appropriately sized
```

#### Test 9.4: Different Browsers
```
❑ Chrome (latest)
  ├─ All features work
  ├─ No console errors
  └─ Responsive layout correct
  
❑ Firefox (latest)
  ├─ All features work
  ├─ No console errors
  └─ Responsive layout correct
  
❑ Safari (latest)
  ├─ All features work
  ├─ No console errors
  └─ Responsive layout correct
  
❑ Edge (latest)
  ├─ All features work
  ├─ No console errors
  └─ Responsive layout correct
```

---

### Phase 10: Performance (20 mins)

#### Test 10.1: Load Time
```
❑ Master Hub loads in <2 seconds
❑ Category pages load in <1 second
❑ JavaScript engines load without delay
❑ No render-blocking resources
```

#### Test 10.2: Upload Speed
```
❑ Single file upload: <500ms
❑ Batch 5 files: <3 seconds
❑ Batch 10 files: <8 seconds
❑ Progress updates smooth
❑ No UI freezing during processing
```

#### Test 10.3: Memory Usage
```
❑ Master Hub <10MB RAM usage
❑ Category pages <15MB with data
❑ No memory leaks after repeated uploads
❑ Browser remains responsive
```

#### Test 10.4: Console Errors
```
❑ Open DevTools (F12)
❑ Check Console tab
❑ No JavaScript errors should appear
❑ No warnings about deprecated features
❑ All network requests successful
```

---

## ✅ TEST CHECKLIST SUMMARY

### Must Pass (Critical)
- [ ] All 10 category pages load
- [ ] Master Hub links to all categories
- [ ] File upload works (single & batch)
- [ ] Processing timeline displays correctly
- [ ] Auto-categorization works (75%+ mapping)
- [ ] Manual mapping modal functional
- [ ] Data persists after page reload
- [ ] AFI expense totals calculate correctly
- [ ] Timeout protection works (30 seconds)
- [ ] No console JavaScript errors

### Should Pass (Important)
- [ ] Recent uploads list displays
- [ ] Stats update in real-time
- [ ] Mobile responsive design works
- [ ] Multiple file formats supported
- [ ] Error notifications display
- [ ] Success notifications display
- [ ] Cross-category sync functional
- [ ] Skip functionality in mapping

### Nice to Have (Enhancement)
- [ ] Animations smooth and professional
- [ ] Drag-and-drop upload support
- [ ] Progress indicators detailed
- [ ] Keyboard shortcuts work
- [ ] Accessibility features present
- [ ] Print-friendly pages available

---

## 🚀 TEST EXECUTION

### Day 1: Core Functionality
- [ ] Phase 1: Navigation & Structure (30 min)
- [ ] Phase 2: Upload Functionality (45 min)
- [ ] Phase 3: Auto-Categorization (40 min)

### Day 2: User Workflows
- [ ] Phase 4: Manual Mapping (35 min)
- [ ] Phase 5: Data Persistence (25 min)
- [ ] Phase 6: Stats & Reporting (20 min)

### Day 3: Integration & Performance
- [ ] Phase 7: AFI Integration (30 min)
- [ ] Phase 8: Notifications (20 min)
- [ ] Phase 9: Responsive Design (25 min)
- [ ] Phase 10: Performance (20 min)

**Total Test Time**: ~6 hours

---

## 📊 TEST RESULTS TEMPLATE

### Summary
- Total Tests: ___
- Passed: ___
- Failed: ___
- Pending: ___
- Pass Rate: ___%

### Critical Issues
```
1. Issue: _________________________
   Impact: _______________________
   Fix: __________________________
   
2. Issue: _________________________
   Impact: _______________________
   Fix: __________________________
```

### Recommendations
```
1. ________________
2. ________________
3. ________________
```

---

**Testing Guide Version**: 1.0  
**Created**: August 20, 2026  
**Status**: Ready for QA

*Use this guide to validate Veritas Document Hub before production launch.*
