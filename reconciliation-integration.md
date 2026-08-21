# Reconciliation Modal - Quick Integration Guide

## For Each Page

### 1. Add to `<head>` section:
```html
<link rel="stylesheet" href="reconciliation-modal.css">
```

### 2. Add before `</body>` tag:
```html
<script src="reconciliation-modal.js"></script>
<script src="reconciliation-data-enhanced.js"></script>
<script>
  function openRecon(category) {
    const reconData = RECONCILIATION_DATA[category];
    if (reconData) {
      openReconciliation(reconData);
    } else {
      alert('No reconciliation data available for this category');
    }
  }
</script>
```

### 3. Add to any [View Recon] link:
```html
<a href="#" onclick="openRecon('ChildHealthIns_SelfEmp'); return false;">
  [View Recon]
</a>
```

---

## Page Updates Needed

### intake-questionnaire.html
- Add CSS and JS includes
- Add openRecon function
- Wire up any [View Recon] links

### document-management.html  
- Add CSS and JS includes
- Add openRecon function
- Link to uploaded documents

### index.html (Dashboard)
- Add CSS and JS includes
- Add openRecon function
- Optional: Summary widget

---

## Category Codes Available

```javascript
// Use these with openRecon()
openRecon('ChildHealthIns_SelfEmp')    // Self Employed
openRecon('ChildHealthIns_Emp')        // Employer Provided
openRecon('ChildHealthIns_Share')      // Shared (50%)
```

Add more categories to `reconciliation-data-enhanced.js`:
```javascript
// Other Expenses (examples)
// openRecon('Childcare')
// openRecon('Medical')
// openRecon('Education')
// openRecon('Housing')
// etc.
```

---

## Testing

1. Add modal to page
2. Click [View Recon] link
3. Modal should pop up
4. Test Print button
5. Test Download button (when implemented)

---

## Next: PDF Download

Will implement in reconciliation-modal.js with html2pdf library.

---

## Next: Database

Will create API endpoints to replace static data.
