function mountPanel(panelId, html) {
  const panel = document.getElementById(panelId);
  if (!panel) return null;
  if (panel.dataset.mounted === "1") return panel;
  panel.innerHTML = html;
  panel.dataset.mounted = "1";
  return panel;
}

function unmountPanel(panelId) {
  const panel = document.getElementById(panelId);
  if (!panel) return;
  if (panel.dataset.mounted !== "1" && !panel.innerHTML.trim()) return;
  panel.innerHTML = "";
  delete panel.dataset.mounted;
}

export { mountPanel, unmountPanel };
