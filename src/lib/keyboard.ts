/**
 * Keep composers on top of the on-screen keyboard. Android resizes the page itself
 * (interactive-widget=resizes-content in the viewport); iOS leaves the page full height and slides the
 * visible area around instead. Either way the visual viewport is what's actually visible, so while
 * the keyboard is up, full-screen layers ([data-fill]) are pinned to it (--vv-top / --vv-h) and the
 * root gets data-kb, which hides the tab bar and drops the home-indicator padding (--safe-b).
 *
 * iOS also scrolls the whole document to reveal a focused field (body overflow is ignored for this),
 * and fixed layers move with it. On top of the pinning that shifted everything up a second time and
 * left a keyboard-sized gap, so while the keyboard is up the document is held at scroll 0 and the
 * field is scrolled into view inside its own layer instead.
 */
const editable = (el: Element | null) => !!el && (el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && !["checkbox", "radio", "range", "button", "submit", "file", "color"].includes(el.type)) || (el as HTMLElement).isContentEditable);

export function watchKeyboard() {
  const vv = window.visualViewport;
  if (!vv) return;
  const root = document.documentElement;
  let full = window.innerHeight; // the height with no keyboard, refreshed whenever nothing is focused
  let frame = 0;

  const update = () => {
    frame = 0;
    const typing = editable(document.activeElement);
    if (!typing) full = Math.max(window.innerHeight, vv.height);
    const open = typing && full - vv.height > 120;
    const opening = open && !root.hasAttribute("data-kb");
    root.toggleAttribute("data-kb", open);
    if (open) {
      if (window.scrollY) window.scrollTo(0, 0);
      root.style.setProperty("--vv-h", `${vv.height}px`);
      root.style.setProperty("--vv-top", `${vv.offsetTop}px`);
      if (opening) requestAnimationFrame(() => document.activeElement?.scrollIntoView({ block: "nearest" }));
    } else {
      root.style.removeProperty("--vv-h");
      root.style.removeProperty("--vv-top");
    }
  };
  const schedule = () => void (frame ||= requestAnimationFrame(update));

  vv.addEventListener("resize", schedule);
  vv.addEventListener("scroll", schedule);
  window.addEventListener("scroll", () => root.hasAttribute("data-kb") && window.scrollY && schedule(), { passive: true });
  window.addEventListener("orientationchange", () => ((full = 0), schedule()));
  document.addEventListener("focusin", schedule);
  document.addEventListener("focusout", () => {
    schedule();
    // iOS can leave the page scrolled after the keyboard goes away
    setTimeout(() => window.scrollY && window.scrollTo(0, 0), 100);
  });
}
