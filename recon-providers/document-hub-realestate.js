// Recons for this Document Hub category page. Rebuilds its counts from the matter's
// document list using the page's own filter (window.HUB_CONFIG, see document-hub-category.js).
(function () {
  const columns = [{ key: 'filename', label: 'Document' }, { key: 'category', label: 'Category' }, { key: 'type', label: 'Type' }, { key: 'status', label: 'Read status' }, { key: 'review', label: 'Needs review' }];
  const line = (d) => ({ filename: d.filename, category: d.category || '', type: d.document_type || '', status: d.extraction_status || '', review: d.ocr_needed ? 'Yes' : 'No', documentId: d.id });
  const filterText = () => {
    const c = window.HUB_CONFIG || {};
    return `${c.category ? `Filed under "${c.category}"` : 'All categories'}${c.typeFilter && c.typeFilter.length ? ` with type ${c.typeFilter.join(' or ')}` : ''}`;
  };
  const matched = async (ctx) => {
    const c = window.HUB_CONFIG || {};
    return (await ctx.json('documents')).filter((d) => !d.deleted_at
      && (!c.category || d.category === c.category)
      && (!(c.typeFilter && c.typeFilter.length) || c.typeFilter.includes(d.document_type)));
  };
  const counted = (list, calc) => ({ format: 'count', value: list.length, columns, rows: list.map(line), documentIds: list.map((d) => d.id), calc });

  VeritasRecon.define({
    byId: {
      totalDocs: async (ctx) => counted(await matched(ctx), [`${filterText()}, leaving out deleted documents.`, `Count = ${(await matched(ctx)).length}.`]),
      totalItems: async (ctx) => {
        const list = (await matched(ctx)).filter((d) => d.extraction_status === 'parsed' || d.extraction_status === 'manual');
        return counted(list, [`${filterText()}, with read status "parsed" or "manual".`, `Count = ${list.length}.`]);
      },
      totalValue: async (ctx) => {
        const list = (await matched(ctx)).filter((d) => d.ocr_needed);
        return counted(list, [`${filterText()}, flagged as needing OCR or manual review.`, `Count = ${list.length}.`]);
      },
    },
    inert: ['.doc-name', '.doc-meta', '.category-desc', '.category-name'],
  });
})();
