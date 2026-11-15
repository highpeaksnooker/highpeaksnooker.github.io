// Static hosts may turn admin.html into /admin or /admin/.
export function pageFromPath(pathname) {
  const parts = pathname.split("/").filter(Boolean);
  let last = parts.at(-1) || "index";
  if (last === "index.html" && parts.length > 1) last = parts.at(-2);
  return last.endsWith(".html") ? last : `${last}.html`;
}
