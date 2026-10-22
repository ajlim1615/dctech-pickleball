/** "Ana Cruz" → "AC", "Cher" → "CH", "" → "?". Used for the player badges. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const letters = (word: string) => Array.from(word);
  if (words.length === 1) return letters(words[0]).slice(0, 2).join("").toUpperCase();
  return (letters(words[0])[0] + letters(words[words.length - 1])[0]).toUpperCase();
}
