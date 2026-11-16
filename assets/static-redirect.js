// GitHub Pages has no extensionless rewrite rules. Preserve authentication fragments.
(() => {
  const path = location.pathname.replace(/\/+$/, "");
  const pages = ["index", "fixtures", "results", "live", "merit", "breaks", "player", "captain", "admin", "knockouts", "venues", "rules", "history", "archive"];
  if (pages.some(page => path === "/" + page))
    location.replace(path + ".html" + location.search + location.hash);
})();
