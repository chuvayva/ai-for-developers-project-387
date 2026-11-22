/** The length of a text the way the contract counts it: in code points, as the server does. */
export function characters(text: string): number {
  return [...text].length;
}
