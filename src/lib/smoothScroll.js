/**
 * Smooth scroll helper (wheel inertia + animated scrollTo).
 */
function attachSmoothScroll(el, opts = {}) {
  if (!el) return null;
  if (el._smoothScroll) return el._smoothScroll;
  const ease = opts.ease ?? 0.22;
  const state = { target: el.scrollTop, raf: 0 };

  const maxScroll = () => Math.max(0, el.scrollHeight - el.clientHeight);

  const tick = () => {
    const cur = el.scrollTop;
    const capped = Math.max(0, Math.min(maxScroll(), state.target));
    state.target = capped;
    const diff = capped - cur;
    if (Math.abs(diff) < 0.5) {
      el.scrollTop = capped;
      state.raf = 0;
      return;
    }
    el.scrollTop = cur + diff * ease;
    state.raf = requestAnimationFrame(tick);
  };

  const start = () => {
    if (!state.raf) state.raf = requestAnimationFrame(tick);
  };

  const api = {
    by(delta) {
      const base = state.raf ? state.target : el.scrollTop;
      state.target = Math.max(0, Math.min(maxScroll(), base + delta));
      start();
    },
    to(top) {
      state.target = Math.max(0, Math.min(maxScroll(), top));
      start();
    },
    toEnd() {
      state.target = maxScroll();
      start();
    },
    syncFromDom() {
      if (!state.raf) state.target = el.scrollTop;
    },
    stop() {
      if (state.raf) cancelAnimationFrame(state.raf);
      state.raf = 0;
      state.target = el.scrollTop;
    }
  };

  el._smoothScroll = api;
  el.addEventListener(
    "scroll",
    () => {
      // если скроллят полосой / тачем — подтянуть target
      if (!state.raf) state.target = el.scrollTop;
    },
    { passive: true }
  );
  return api;
}

function getSmoothScroll(el) {
  return el?._smoothScroll || attachSmoothScroll(el);
}

export { attachSmoothScroll, getSmoothScroll };
