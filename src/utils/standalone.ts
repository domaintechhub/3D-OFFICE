export function isStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean((window as unknown as { __DTH_STANDALONE__?: boolean }).__DTH_STANDALONE__);
}
