// Client-side helper snippets for Signed URL uploads (SyncManager integration)
// Usage: request a signed URL from your server, then upload the Blob/File using PUT.

// 1) Request signed URL from your backend
async function requestSignedUrl(apiEndpoint, bucket, path, expires = 600) {
  const res = await fetch(apiEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bucket, path, expires })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error('Failed to get signed URL: ' + res.status + ' - ' + text);
  }
  const body = await res.json();
  return body.signedUrl || body.signedURL || body.signedUrl;
}

// 2) Convert base64 string to Blob (if your SyncManager has base64)
function base64ToBlob(base64, contentType = 'application/octet-stream') {
  const byteChars = atob(base64.split(',').pop());
  const byteNumbers = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteNumbers[i] = byteChars.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: contentType });
}

// 3) Upload Blob/File to signed URL
async function uploadToSignedUrl(signedUrl, blob, contentType) {
  const res = await fetch(signedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType || blob.type || 'application/octet-stream' },
    body: blob
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error('Upload failed: ' + res.status + ' - ' + text);
  }
  return true;
}

// Example integration in SyncManager:
// 1) prepare a unique path: `uploads/${id}_${Date.now()}.jpg`
// 2) const signedUrl = await requestSignedUrl('/api/sign-upload', 'ttocc-archivos', path, 600);
// 3) const blob = base64ToBlob(base64string, 'image/jpeg');
// 4) await uploadToSignedUrl(signedUrl, blob, 'image/jpeg');
// 5) store the path (e.g. 'uploads/xx.jpg') or public URL equivalent in your record and upsert it.

export { requestSignedUrl, base64ToBlob, uploadToSignedUrl };
