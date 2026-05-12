export async function computeHash(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

// Fallback for non-browser envs (testing)
if (typeof crypto === 'undefined' || !crypto.subtle) {
  (computeHash as any) = async (text: string) => {
    const msgUint8 = new TextEncoder().encode(text);
    // Simulate, but in Obsidian it's available
    throw new Error('Crypto not available');
  };
}
