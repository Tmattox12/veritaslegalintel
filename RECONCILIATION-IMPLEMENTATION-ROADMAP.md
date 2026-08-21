# Reconciliation Modal - Implementation Roadmap

## Step A: Real Data Integration ✅ COMPLETE
- Enhanced data structure created
- Case information added
- Document tracking system implemented
- Summary calculations added
- Backward compatibility maintained

**Files:**
- `reconciliation-data-enhanced.js` - Production-ready data
- AFI page updated to use enhanced data

---

## Step B: Deploy to Other Pages 🚀 IN PROGRESS

### Pages to Update:
1. **intake-questionnaire.html**
2. **document-management.html**
3. **index.html** (optional - dashboard)

### Implementation:

Each page needs:
```html
<!-- In <head> -->
<link rel="stylesheet" href="reconciliation-modal.css">

<!-- Before </body> -->
<script src="reconciliation-modal.js"></script>
<script src="reconciliation-data-enhanced.js"></script>
<script>
  function openRecon(category) {
    const reconData = RECONCILIATION_DATA[category];
    if (reconData) {
      openReconciliation(reconData);
    }
  }
</script>
```

### Page-Specific Data:
- **Intake Questionnaire**: Show reconciliations for expenses entered
- **Document Management**: Link reconciliations to uploaded documents
- **Dashboard**: Summary view of all reconciliations

---

## Step C: PDF Download Functionality 📄

### Implementation Options:

#### Option 1: jsPDF (Recommended)
```javascript
downloadPDF() {
  const doc = new jsPDF();
  const content = this.modal.querySelector('.recon-modal-content');
  
  doc.text(this.title, 20, 20);
  doc.autoTable({
    html: '.recon-table',
    startY: 40
  });
  
  doc.save(`${this.title}.pdf`);
}
```

#### Option 2: html2pdf
```javascript
downloadPDF() {
  const element = this.modal.querySelector('.recon-modal-content');
  html2pdf({
    element: element,
    filename: `${this.title}.pdf`,
    html2canvas: { scale: 2 },
    jsPDF: { format: 'a4' }
  });
}
```

### Installation:
```html
<!-- Add to reconciliation-modal.js -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
```

### Features to Include:
- ✅ Table formatting
- ✅ Summary section
- ✅ Case information header
- ✅ Document links list
- ✅ Print-optimized styling

---

## Step D: Database Integration 💾

### Architecture:

```
Frontend (Modal) 
    ↓
    API Endpoints
    ↓
Backend Service
    ↓
Database
```

### Backend Endpoints:

#### 1. Get Reconciliation Data
```
GET /api/reconciliations/:caseId/:category

Response:
{
  "title": "...",
  "expenseCategory": "...",
  "data": { ... },
  "documentLinks": [ ... ],
  "summary": { ... }
}
```

#### 2. Save Reconciliation
```
POST /api/reconciliations

Body:
{
  "caseId": "D2024-1669",
  "category": "ChildHealthIns_SelfEmp",
  "data": { ... },
  "documentLinks": [ ... ]
}
```

#### 3. List Case Reconciliations
```
GET /api/cases/:caseId/reconciliations

Response:
{
  "reconciliations": [
    { "category": "...", "title": "...", "status": "..." },
    ...
  ]
}
```

### Database Schema:

```sql
-- Cases Table
CREATE TABLE cases (
  id VARCHAR(50) PRIMARY KEY,
  case_name VARCHAR(255),
  case_number VARCHAR(50),
  county VARCHAR(100),
  report_date DATE
);

-- Reconciliations Table
CREATE TABLE reconciliations (
  id UUID PRIMARY KEY,
  case_id VARCHAR(50),
  category VARCHAR(100),
  title VARCHAR(255),
  data JSON,
  status VARCHAR(20),
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  FOREIGN KEY (case_id) REFERENCES cases(id)
);

-- Reconciliation Items Table
CREATE TABLE reconciliation_items (
  id UUID PRIMARY KEY,
  reconciliation_id UUID,
  date DATE,
  description VARCHAR(255),
  amount DECIMAL(10,2),
  ytd DECIMAL(10,2),
  category VARCHAR(100),
  status VARCHAR(20),
  note TEXT,
  source_link VARCHAR(500),
  document_id VARCHAR(100),
  FOREIGN KEY (reconciliation_id) REFERENCES reconciliations(id)
);

-- Document Links Table
CREATE TABLE document_links (
  id UUID PRIMARY KEY,
  reconciliation_id UUID,
  document_name VARCHAR(255),
  document_type VARCHAR(50),
  document_url VARCHAR(500),
  upload_date DATE,
  pages INT,
  FOREIGN KEY (reconciliation_id) REFERENCES reconciliations(id)
);
```

### Backend Implementation Example (Node.js/Express):

```javascript
// routes/reconciliations.js

router.get('/api/cases/:caseId/reconciliations', async (req, res) => {
  const { caseId } = req.params;
  
  const reconciliations = await db.query(
    'SELECT * FROM reconciliations WHERE case_id = ?',
    [caseId]
  );
  
  res.json({
    reconciliations: reconciliations.map(r => ({
      category: r.category,
      title: r.title,
      status: r.status,
      totalAmount: r.data.totalAmount,
      lastUpdated: r.updated_at
    }))
  });
});

router.get('/api/reconciliations/:caseId/:category', async (req, res) => {
  const { caseId, category } = req.params;
  
  const recon = await db.query(
    'SELECT * FROM reconciliations WHERE case_id = ? AND category = ?',
    [caseId, category]
  );
  
  if (recon) {
    res.json(recon);
  } else {
    res.status(404).json({ error: 'Reconciliation not found' });
  }
});
```

### Frontend Integration:

```javascript
// Update reconciliation-modal.js
async fetchFromAPI(caseId, category) {
  try {
    const response = await fetch(
      `/api/reconciliations/${caseId}/${category}`
    );
    const data = await response.json();
    
    this.data = data;
    this.populateTable();
    this.updateSummary();
    this.populateDocuments();
  } catch (error) {
    console.error('Error fetching reconciliation:', error);
  }
}
```

---

## Implementation Timeline

| Step | Task | Effort | Status |
|------|------|--------|--------|
| A | Enhanced Data Structure | 2 hrs | ✅ Done |
| B | Deploy to Other Pages | 4 hrs | 🚀 In Progress |
| C | PDF Download | 3 hrs | ⏳ Next |
| D | Database Integration | 8 hrs | ⏳ Final |
| **Total** | | **17 hrs** | |

---

## Testing Checklist

### Step B (Pages):
- [ ] Modal opens on all pages
- [ ] Data displays correctly
- [ ] Print works
- [ ] Download button visible

### Step C (PDF):
- [ ] PDF generates correctly
- [ ] All data included
- [ ] Formatting looks good
- [ ] File names correct

### Step D (Database):
- [ ] API endpoints functional
- [ ] Data persists
- [ ] Concurrent access works
- [ ] No data loss

---

## Next Immediate Actions

1. Add modal to intake-questionnaire.html
2. Add modal to document-management.html
3. Implement PDF download with html2pdf
4. Create backend API structure
5. Wire frontend to API endpoints
6. Test end-to-end

---

## Notes

- All code is backward compatible
- Existing static data still works
- API optional - can add later
- PDF library can be swapped
- Database schema is flexible for future enhancements
