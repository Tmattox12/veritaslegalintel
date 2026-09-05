// Reset template to clean slate
async function resetTemplate() {
  if (!confirm('🗑️ This will PERMANENTLY delete all case data, documents, and uploads.\n\nContinue?')) {
    return;
  }

  if (!confirm('⚠️ Are you absolutely sure? This cannot be undone.')) {
    return;
  }

  try {
    // Clear browser localStorage
    const keysToRemove = ['currentCase', 'currentCaseDraft', 'currentMatterId', 'bankStatementsData'];
    keysToRemove.forEach(key => localStorage.removeItem(key));
    console.log('✓ Cleared localStorage');

    // Call backend reset API
    const response = await fetch('/api/admin/reset', { method: 'POST' });
    if (!response.ok) {
      throw new Error('Backend reset failed');
    }

    console.log('✓ Backend reset complete');

    // Refresh and show success
    alert('✓ Template reset complete!\n\nThe page will now reload.');
    location.reload();
  } catch (error) {
    alert('❌ Reset failed: ' + error.message);
    console.error(error);
  }
}
