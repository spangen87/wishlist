// Resolve a human-readable name from a users/{uid} document without exposing
// full email addresses to other viewers — fall back to the local part only.
export function resolveDisplayName(
  data: { displayName?: string; username?: string; email?: string } | undefined,
  uid: string,
): string {
  if (!data) return uid;
  if (data.displayName) return data.displayName;
  if (data.username) return data.username;
  if (data.email) return data.email.split('@')[0] || uid;
  return uid;
}
