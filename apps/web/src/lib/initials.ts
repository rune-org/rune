/**
 * Returns the initials of a given name.
 * - If the name is empty, returns "U".
 * - For names with multiple words, returns the first letter of the first and last name.
 * - For single-word names, returns just the first letter.
 * @param name The full name string.
 * @returns The initials (up to 2 uppercase letters), or "U" if not available.
 */
export const getInitials = (name: string): string => {
  if (!name) return "U";
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((part) => part.length > 0);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};
