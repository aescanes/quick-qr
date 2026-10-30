// Runs before first paint (see index.html) so the page never flashes the wrong theme.
try {
  var t = localStorage.getItem("quickqr-theme");
  if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t);
} catch (e) {}
