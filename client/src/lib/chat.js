const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// True when a message @mentions this user by first name, or @everyone / @all
export function mentionsName(text, name) {
  const first = escapeRegex((name || "").split(/\s+/)[0].toLowerCase());
  if (!first) return false;
  return new RegExp(`@(${first}|everyone|all)(?![\\w])`, "i").test(text);
}
