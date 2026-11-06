// AFI Reference Guide (afi-reference-guide.html): a list of categories with no dollar figures.
// The large numbers are section numbers, not amounts.
VeritasRecon.define({ inert: ['.section-number'] });
// The page may have been scanned before this file loaded, so release any already marked.
document.querySelectorAll('.section-number .vr-num').forEach((n) => n.replaceWith(n.textContent));
VeritasRecon.define({ match: [{ label: /./, recon: (ctx) => (/^categor/.test(ctx.after) ? { status: 'text', calc: ['How many categories this reference section lists. It is not a figure for this case.'] } : null) }] });
