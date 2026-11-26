export function isStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false;
  const flag = Boolean((window as unknown as { __DTH_STANDALONE__?: boolean }).__DTH_STANDALONE__);
  const isFileProtocol = window.location?.protocol === 'file:';
  return flag || isFileProtocol;
}

export function isOfflineMode(): boolean {
  if (isStandaloneMode()) return true;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  return false;
}
