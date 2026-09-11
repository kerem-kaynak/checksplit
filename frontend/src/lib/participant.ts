export function getParticipantName(code: string): string | null {
  try {
    return localStorage.getItem(`checksplit_name_${code.toUpperCase()}`)
      || localStorage.getItem(`checksplit_name_${code}`);
  } catch {
    return null;
  }
}

export function storeParticipantName(code: string, name: string): void {
  localStorage.setItem(`checksplit_name_${code.toUpperCase()}`, name);
}
