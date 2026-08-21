# Veritas Reconciliation Modal - Usage Guide

## Overview

The reconciliation modal is a reusable, site-wide component for displaying expense reconciliation details. It works with any expense category and data structure.

## Files

- **reconciliation-modal.js** - Main component (reusable)
- **reconciliation-modal.css** - Styling (matches Veritas design)

## Integration Steps

### 1. Include Files in Your HTML

Add to the `<head>` section:
```html
<link rel="stylesheet" href="reconciliation-modal.css">
```

Add before `</body>`:
```html
<script src="reconciliation-modal.js"></script>
```

### 2. Basic Usage - Method 1: Data Attributes

Add to your [View Recon] link:

```html
<a href="#" 
   data-view-recon
   data-recon-title="Health Insurance - 2026 YTD"
   data-recon-category="Health Insurance"
   data-recon-data='{"items": [...], "ytdThrough": "2026-06-15", "status": "Complete"}'
   data-recon-docs='[{"name": "Pay Stub Jan 2026", "type": "PDF", "url": "/docs/paystub-jan-2026.pdf"}]'>
  [View Recon]
</a>
```

### 3. Advanced Usage - Method 2: JavaScript

```javascript
// Open modal programmatically
openReconciliation({
  title: "Health Insurance - 2026 YTD",
  expenseCategory: "Health Insurance",
  data: {
    items: [
      {
        date: "2026-01-30",
        description: "Self-Employed Health Insurance",
        amount: 5011.00,
        category: "Health Insurance",
        ytd: 5011.00,
        note: "Period 1/1-1/15/26 — stub missing; implied from YTD",
        status: "est",
        sourceLink: "/docs/paystub-jan-2026.pdf"
      },
      {
        date: "2026-02-13",
        description: "Employer-Provided Health Insurance",
        amount: 2180.00,
        category: "Health Insurance",
        ytd: 7192.00,
        note: "Period 1/16-1/31/26",
        status: "doc",
        sourceLink: "/docs/paystub-feb-2026.pdf"
      }
      // ... more items
    ],
    ytdThrough: "2026-06-15",
    status: "Complete"
  },
  documentLinks: [
    {
      name: "Pay Stub - January 2026",
      type: "PDF",
      url: "/documents/paystub-jan-2026.pdf"
    },
    {
      name: "Insurance Statement",
      type: "PDF", 
      url: "/documents/insurance-statement-2026.pdf"
    },
    {
      name: "Bank Statement - June 2026",
      type: "PDF",
      url: "/documents/bank-statement-june-2026.pdf"
    }
  ]
});
```

## Data Structure

### Item Object
```javascript
{
  date: "2026-01-30",           // String or Date
  description: "Description",   // Required
  amount: 5011.00,              // Number
  category: "Category Name",    // String
  ytd: 5011.00,                 // Year-to-date cumulative
  note: "Period notes",         // Optional
  status: "doc" | "est",        // "doc" = documented, "est" = estimated
  sourceLink: "/path/to/doc"    // Optional - link to source document
}
```

### Summary Data
```javascript
{
  items: [...],                 // Array of item objects
  ytdThrough: "2026-06-15",     // End date for YTD calculations
  status: "Complete"            // Overall reconciliation status
}
```

### Document Link Object
```javascript
{
  name: "Document Name",        // Display name
  type: "PDF",                  // Document type (PDF, Excel, Word, etc.)
  url: "/path/to/document"      // Link to document
}
```

## Features

### Automatic Features
- ✅ Table rendering from data
- ✅ Summary calculations (totals, counts)
- ✅ Status-based row highlighting
- ✅ Document linking
- ✅ Print functionality
- ✅ Responsive design
- ✅ Dark mode support
- ✅ Keyboard support (ESC to close)

### Status Colors
- **"doc"** (Green) - Documented with source
- **"est"** (Yellow) - Estimated/implied

## Example: Health Insurance Reconciliation

```html
<!-- In your AFI form -->
<tr>
  <td>3. Health Insurance</td>
  <td>
    <a href="#" data-view-recon 
       data-recon-title="Health Insurance - 2026 YTD"
       data-recon-category="Health Insurance"
       data-recon-data='{"items": [{"date": "2026-01-30", "description": "Self-Employed", "amount": 5011, "category": "Health", "ytd": 5011, "status": "est", "sourceLink": "/docs/pay-stub.pdf"}], "ytdThrough": "2026-06-15", "status": "Complete"}'
       data-recon-docs='[{"name": "Pay Stub Jan", "type": "PDF", "url": "/docs/pay-stub.pdf"}]'>
      [View Recon]
    </a>
  </td>
  <td>—</td>
  <td>$24,885</td>
</tr>
```

## Styling Customization

### Color Variables (in reconciliation-modal.css)
```css
:root {
  --recon-primary: #2e5b8a;          /* Primary brand color */
  --recon-primary-dark: #1f5f9d;     /* Darker shade */
  --recon-border: #e4e8f0;           /* Border color */
  --recon-bg-light: #f5f7fb;         /* Light background */
  --recon-text: #1a2432;             /* Primary text */
  --recon-text-light: #55637a;       /* Secondary text */
  --recon-status-doc: #10b981;       /* Documented status */
  --recon-status-est: #f59e0b;       /* Estimated status */
}
```

## Export/Download Options

### Current Capabilities
- 🖨️ **Print** - Native browser print (Ctrl+P friendly)
- ⬇️ **Download** - Placeholder (ready for PDF integration)

### Future Enhancement
To enable PDF download, integrate a library like:
- **jsPDF** - JavaScript PDF generation
- **html2pdf** - Convert HTML to PDF
- **PDFKit** - Node.js PDF generation

Example with html2pdf:
```javascript
downloadPDF() {
  const element = this.modal.querySelector('.recon-modal-content');
  html2pdf().set({
    margin: 10,
    filename: `${this.title}.pdf`,
    image: { type: 'png', quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' }
  }).save(element);
}
```

## Mobile Responsiveness

The modal is fully responsive:
- **Desktop** (>768px) - Full-width table, 3-column summary grid
- **Mobile** (<768px) - Stack layout, 1-column summary, scrollable table

## Accessibility

- ✅ ARIA labels on buttons
- ✅ Keyboard navigation (ESC to close)
- ✅ Semantic HTML structure
- ✅ High contrast text
- ✅ Focus management

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
- Mobile browsers (iOS Safari 14+, Chrome Android)

## Common Use Cases

### 1. Health Insurance Reconciliation
```javascript
openReconciliation({
  title: "Health Insurance - 2026",
  expenseCategory: "Health Insurance",
  data: { /* health insurance items */ },
  documentLinks: [ /* pay stubs, insurance statements */ ]
});
```

### 2. Childcare Expenses
```javascript
openReconciliation({
  title: "Childcare Expenses - 2026",
  expenseCategory: "Childcare",
  data: { /* childcare items */ },
  documentLinks: [ /* invoices, receipts */ ]
});
```

### 3. Mortgage/Rent
```javascript
openReconciliation({
  title: "Housing - 2026",
  expenseCategory: "Housing",
  data: { /* housing items */ },
  documentLinks: [ /* mortgage statements, bank transfers */ ]
});
```

## Troubleshooting

### Modal Not Appearing
1. Verify `data-view-recon` attribute is on link
2. Check browser console for errors
3. Ensure CSS file is loaded
4. Check z-index conflicts (modal uses z-index: 10000)

### Data Not Showing
1. Verify JSON syntax in `data-recon-data` attribute
2. Check item object structure matches expected format
3. Ensure all required fields are present
4. Use browser DevTools to inspect data

### Styling Issues
1. Clear browser cache
2. Verify reconciliation-modal.css is loaded
3. Check for CSS conflicts with other stylesheets
4. Use browser DevTools to inspect styles

## Support & Documentation

For more details or issues, refer to:
- reconciliation-modal.js - Source code with detailed comments
- reconciliation-modal.css - Styling reference
- This file for usage examples
