# Reconciliation Modal - Available Expense Categories

## Quick Reference

All expense categories are available via the `openRecon()` function:

```javascript
openRecon('CategoryCode')  // Opens modal with category data
```

---

## Health Insurance Categories

### Child Health Insurance - Self Employed
```javascript
openRecon('ChildHealthIns_SelfEmp')
```
- Monthly premium: $450
- 6 items (4 documented, 2 estimated)
- YTD Total: $2,700
- Status: ✓ Complete

### Child Health Insurance - Employer Provided
```javascript
openRecon('ChildHealthIns_Emp')
```
- Bi-weekly deduction: $285.50
- 10 items (7 documented, 3 estimated)
- YTD Total: $2,855
- Status: ✓ Complete

### Child Health Insurance - Shared (50%)
```javascript
openRecon('ChildHealthIns_Share')
```
- Monthly share: $225
- 6 items (all estimated)
- YTD Total: $1,350
- Status: ✓ Complete
- Note: Respondent's 50% share per court order

---

## Child Care Categories

### Child Care - Daycare/Preschool
```javascript
openRecon('Childcare_Daycare')
```
- Monthly tuition: $1,200 (2 children)
- 6 items (4 documented, 2 estimated)
- YTD Total: $6,600
- Status: ✓ Complete
- Coverage: Ages 3 & 5

---

## Medical/Dental Categories

### Medical & Dental - Unreimbursed
```javascript
openRecon('Medical_Uninsured')
```
- Copays & out-of-pocket: $65-$180
- 5 items (4 documented, 1 estimated)
- YTD Total: $600
- Status: ✓ Complete
- Includes: Dental cleanings, urgent care, prescriptions, physicals

---

## Education Categories

### Education - School & Supplies
```javascript
openRecon('Education_SchoolSupplies')
```
- School tuition: $350/month
- Supplies: $125/semester
- 6 items (4 documented, 2 estimated)
- YTD Total: $1,700
- Status: ✓ Complete
- Coverage: Private school tuition + materials

---

## Housing Categories

### Housing - Mortgage & Property Taxes
```javascript
openRecon('Housing_MortgageAndTaxes')
```
- Monthly PITI: $1,850
- 6 items (4 documented, 2 estimated)
- YTD Total: $11,175
- Status: ✓ Complete
- Includes: Principal, Interest, Taxes, Insurance

---

## Integration Examples

### AFI Page
Add [View Recon] links to any section:

```html
<a href="#" onclick="openRecon('ChildHealthIns_SelfEmp'); return false;">
  [View Recon]
</a>
```

### Intake Questionnaire
Link from child health insurance section:

```html
<!-- In CHILDREN section -->
<a href="#" onclick="openRecon('Childcare_Daycare'); return false;">
  View Childcare Costs Reconciliation
</a>
```

### Dashboard
Add expense category cards:

```html
<button onclick="openRecon('Housing_MortgageAndTaxes')">
  View Housing Details
</button>
```

---

## Data Structure

Each category contains:

### Title & Metadata
- `title` - Display title with YTD period
- `expenseCategory` - Category name
- `caseInfo` - Case name, number, county, report date

### Financial Data
- `items` - Array of transactions with:
  - `date` - Transaction date
  - `description` - Item description
  - `amount` - Transaction amount
  - `category` - Expense category
  - `status` - "doc" (documented) or "est" (estimated)
  - `ytd` - Running year-to-date total
  - `sourceLink` - Link to supporting document
  - `documentId` - Document tracking ID

### Supporting Documents
- `documentLinks` - Array of PDF/document references
- `name` - Document name
- `type` - Document type (PDF, etc.)
- `url` - Document location/link
- `uploadDate` - Upload date
- `pages` - Number of pages

### Summary
- `totalItems` - Total number of items
- `documentedItems` - Count of documented items
- `estimatedItems` - Count of estimated items
- `totalAmount` - Total amount YTD
- `averagePerPeriod` - Average per month/period

---

## Adding New Categories

To add a new expense category:

1. Edit `reconciliation-data-enhanced.js`
2. Add new category object with unique code:

```javascript
CategoryCode: {
  title: "Category Name - 2026 YTD",
  expenseCategory: "Category Name",
  caseInfo: { /* case details */ },
  data: {
    items: calculateYTD([ /* item array */ ]),
    ytdThrough: "2026-06-15",
    status: "Complete",
    notes: "Description"
  },
  documentLinks: [ /* supporting docs */ ],
  summary: { /* summary object */ }
}
```

3. Use in page:
```javascript
openRecon('CategoryCode')
```

---

## Status Legend

| Status | Meaning | Color |
|--------|---------|-------|
| doc | Documented (supported by records) | 🟢 Green |
| est | Estimated (calculated/projected) | 🟡 Yellow |

---

## Testing Checklist

- [ ] All 8 categories load without errors
- [ ] Data displays correctly in modal
- [ ] YTD calculations are accurate
- [ ] Status badges show correct colors
- [ ] Print button functions
- [ ] Download PDF generates valid file
- [ ] Modal closes properly
- [ ] Works on all device sizes
- [ ] Keyboard navigation works
- [ ] Supporting document links are valid

---

## Performance Notes

- Each category loads instantly (static data)
- No database calls required for current setup
- With backend API: Calls `/api/reconciliations/{reconId}`
- Modal caches opened data to prevent reloads
- PDF generation uses browser print functionality

---

## Future Enhancements

- [ ] Search/filter reconciliations
- [ ] Export to Excel
- [ ] Bulk category download
- [ ] API-driven data loading
- [ ] Edit/add items
- [ ] Document upload
- [ ] Concurrent modification tracking
- [ ] Audit trail/history
