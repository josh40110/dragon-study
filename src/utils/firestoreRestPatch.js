/**
 * 將一般 JS 物件轉成 Firestore REST v1 的 `fields` 格式（僅支援本專案用到的型別）。
 * @param {Record<string, unknown>} updates
 */
export function plainUpdatesToFirestoreFields(updates) {
  const fields = {};
  for (const [key, v] of Object.entries(updates)) {
    if (v === null || v === undefined) {
      fields[key] = { nullValue: null };
    } else if (typeof v === 'boolean') {
      fields[key] = { booleanValue: v };
    } else if (typeof v === 'number') {
      fields[key] = Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
    } else if (typeof v === 'string') {
      fields[key] = { stringValue: v };
    }
  }
  return { fields };
}

/**
 * 使用 `fetch(..., { keepalive: true })` 送 PATCH，利於分頁關閉時請求仍有機會送達（仍非 100%）。
 * @param {string} patchUrl 不含 query 的 REST document URL
 * @param {string} idToken Firebase ID token
 * @param {Record<string, unknown>} updates 扁平欄位
 */
export function firestorePatchKeepalive(patchUrl, idToken, updates) {
  const fieldPaths = Object.keys(updates);
  if (fieldPaths.length === 0) return;
  const qs = fieldPaths.map((fp) => `updateMask.fieldPaths=${encodeURIComponent(fp)}`).join('&');
  const body = JSON.stringify(plainUpdatesToFirestoreFields(updates));
  try {
    void fetch(`${patchUrl}?${qs}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
      body,
      keepalive: true,
    });
  } catch {
    /* ignore */
  }
}
