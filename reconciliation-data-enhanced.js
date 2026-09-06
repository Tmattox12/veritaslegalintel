/* Empty reconciliation template. Populate from uploaded documents for the active matter. */
function calculateYTD(items) {
  let ytd = 0;
  return items.map((item) => {
    ytd += Number(item.amount) || 0;
    return { ...item, ytd };
  });
}
const RECONCILIATION_DATA_ENHANCED = {};
