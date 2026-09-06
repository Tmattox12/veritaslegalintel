const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle } = require('docx');
const fs = require('fs');

const H = (text, level) => new Paragraph({ heading: level, spacing: { before: 240, after: 120 }, children: [new TextRun({ text, bold: true })] });
const P = (text, opts = {}) => new Paragraph({ spacing: { after: 160 }, children: [new TextRun({ text, ...opts })] });
const B = (text) => new Paragraph({ bullet: { level: 0 }, spacing: { after: 80 }, children: [new TextRun({ text })] });

const cell = (text, bold = false, shade) => new TableCell({
  shading: shade ? { fill: shade } : undefined,
  margins: { top: 80, bottom: 80, left: 120, right: 120 },
  children: [new Paragraph({ children: [new TextRun({ text, bold })] })],
});

const doc = new Document({
  sections: [{
    properties: {},
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 },
        children: [new TextRun({ text: 'Veritas Financial Intelligence', bold: true, size: 32 })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 240 },
        children: [new TextRun({ text: 'On-Premises Tunnel + Azure Deployment Option', size: 24, color: '2E5B8A' })],
      }),

      H('What "On-Prem Tunnel + Azure" Means Here', HeadingLevel.HEADING_1),
      P('This is a hybrid architecture. Your sensitive financial documents and database stay on your own hardware ("on-premises"), while Microsoft Azure provides the public-facing web front-end and optional cloud AI. A secure, outbound-only tunnel connects the two — so you never open an inbound firewall port or expose your local server to the internet.'),

      H('The Three Pieces', HeadingLevel.HEADING_2),
      B('On-Premises (your office/server): the Node/Express backend, the SQLite database, and the original uploaded PDF/Word/Excel/image files. Data never leaves your control.'),
      B('Azure (the cloud): the static web app (the pages you click), plus optional services like Azure AI for OCR and Azure Blob Storage for encrypted backups.'),
      B('The Tunnel: a persistent, outbound-only, encrypted connection from your on-prem server to Azure. Azure routes requests down the tunnel to your local API. You open no inbound ports.'),

      new Paragraph({ spacing: { before: 120, after: 240 }, children: [new TextRun({ text: 'Browser  →  Azure Static Web App (HTTPS)  →  Azure Relay / Tunnel  →  On-Prem Node API (:3000)  →  SQLite + Files', italics: true, color: '425C7F' })] }),

      H('Why This Fits Family-Law / Discovery Work', HeadingLevel.HEADING_2),
      B('Confidentiality: bank statements and affidavits stay on your hardware, not in a shared cloud database.'),
      B('Compliance: easier to answer "where does client data live?" — it lives in your office.'),
      B('Accessibility: attorneys and paralegals reach the app from anywhere via the Azure-hosted site, without VPNing into the office.'),
      B('Cost: you avoid paying for a large cloud database or VM; the tunnel and static site are inexpensive.'),

      H('Comparison: Where Data Lives', HeadingLevel.HEADING_2),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({ children: [cell('Component', true, 'DCE6F1'), cell('On-Prem (Local Only)', true, 'DCE6F1'), cell('Full Azure Cloud', true, 'DCE6F1'), cell('On-Prem Tunnel + Azure', true, 'DCE6F1')] }),
          new TableRow({ children: [cell('Web UI (pages)'), cell('Your machine only'), cell('Azure Static Web App'), cell('Azure Static Web App')] }),
          new TableRow({ children: [cell('API / Backend'), cell('Your machine'), cell('Azure App Service'), cell('Your machine (via tunnel)')] }),
          new TableRow({ children: [cell('Database (transactions)'), cell('Your machine (SQLite)'), cell('Azure SQL'), cell('Your machine (SQLite)')] }),
          new TableRow({ children: [cell('Original documents'), cell('Your machine'), cell('Azure Blob Storage'), cell('Your machine (optional encrypted Blob backup)')] }),
          new TableRow({ children: [cell('AI OCR / parsing'), cell('Local or none'), cell('Azure AI / Claude'), cell('Your choice (local or Azure AI)')] }),
        ],
      }),

      H('Tunnel Options (Most to Least Managed)', HeadingLevel.HEADING_2),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({ children: [cell('Option', true, 'DCE6F1'), cell('What It Is', true, 'DCE6F1'), cell('Good For', true, 'DCE6F1')] }),
          new TableRow({ children: [cell('Azure Relay (Hybrid Connections)'), cell('Fully managed Azure service; your server makes an outbound WebSocket to Azure.'), cell('Recommended default; no inbound firewall changes.')] }),
          new TableRow({ children: [cell('Azure App Service Hybrid Connection'), cell('If the API moves to App Service but must reach an on-prem DB.'), cell('When only the database stays on-prem.')] }),
          new TableRow({ children: [cell('Cloudflare Tunnel'), cell('Not Azure, but a popular zero-inbound-port tunnel.'), cell('Simplest setup; works with any cloud front-end.')] }),
          new TableRow({ children: [cell('Site-to-Site VPN / ExpressRoute'), cell('Network-level link between office and Azure.'), cell('Larger firms with IT staff and many users.')] }),
        ],
      }),

      H('Recommendation', HeadingLevel.HEADING_2),
      P('For your stage: start with Azure Relay (Hybrid Connections). It is the least work, keeps all client documents and the database on your own hardware, and lets the Azure-hosted website reach your local API securely. You can add Azure Blob Storage later purely as an encrypted off-site backup of the original files, without moving day-to-day processing off your machine.'),

      H('What Changes in Our Code', HeadingLevel.HEADING_2),
      B('Frontend pages move to Azure Static Web Apps (they are already static HTML/JS).'),
      B('The API base URL becomes the public tunnel address instead of localhost:3000.'),
      B('The on-prem server runs a small relay listener process alongside node server/index.js.'),
      B('Authentication: put the tunnel endpoint behind Azure AD (Entra) sign-in so only your firm can reach it.'),

      new Paragraph({ spacing: { before: 240 }, children: [new TextRun({ text: 'Prepared for internal planning — not a security audit.', italics: true, color: '8A94A3', size: 18 })] }),
    ],
  }],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync('Veritas-OnPrem-Tunnel-Azure.docx', buf);
  console.log('WROTE Veritas-OnPrem-Tunnel-Azure.docx');
});
