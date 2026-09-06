/**
 * Storage abstraction for original uploaded files.
 *
 * Mode is selected by env:
 *   STORAGE_MODE=local   -> keep files on disk under server/uploads (default, dev)
 *   STORAGE_MODE=azure   -> upload originals to Azure Blob Storage, store blob key
 *
 * Azure config (only needed when STORAGE_MODE=azure):
 *   AZURE_STORAGE_CONNECTION_STRING  - storage account connection string
 *   AZURE_STORAGE_CONTAINER          - container name (default: veritas-documents)
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const MODE = (process.env.STORAGE_MODE || 'local').toLowerCase();
const CONTAINER = process.env.AZURE_STORAGE_CONTAINER || 'veritas-documents';
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

let blobClient = null;

function isAzure() {
  return MODE === 'azure' && !!process.env.AZURE_STORAGE_CONNECTION_STRING;
}

async function getContainer() {
  if (!blobClient) {
    const { BlobServiceClient } = require('@azure/storage-blob');
    const svc = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
    blobClient = svc.getContainerClient(CONTAINER);
    await blobClient.createIfNotExists(); // private by default
  }
  return blobClient;
}

/**
 * Persist an uploaded file buffer. Returns a storage key to save on the
 * documents.s3_key column (works for both local paths and blob names).
 * @returns {Promise<{key: string, mode: string}>}
 */
async function storeOriginal(matterId, docId, originalname, buffer) {
  const safeName = (originalname || 'file').replace(/[^\w.\-]/g, '_');

  if (isAzure()) {
    const key = `${matterId}/${docId}/${safeName}`;
    const container = await getContainer();
    const block = container.getBlockBlobClient(key);
    await block.uploadData(buffer, { blobHTTPHeaders: { blobContentType: 'application/octet-stream' } });
    return { key, mode: 'azure' };
  }

  // local disk
  const dir = path.join(UPLOADS_DIR, matterId || 'misc');
  fs.mkdirSync(dir, { recursive: true });
  const key = path.join(matterId || 'misc', `${docId}_${safeName}`);
  fs.writeFileSync(path.join(UPLOADS_DIR, key), buffer);
  return { key, mode: 'local' };
}

/** Retrieve a stored original (for re-processing or download). */
async function getOriginal(key) {
  if (isAzure()) {
    const container = await getContainer();
    const block = container.getBlobClient(key);
    const resp = await block.downloadToBuffer();
    return resp;
  }
  return fs.readFileSync(path.join(UPLOADS_DIR, key));
}

module.exports = { storeOriginal, getOriginal, isAzure, MODE };
