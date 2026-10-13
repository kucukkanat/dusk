/**
 * Keep composers on top of the on-screen keyboard. Android resizes the page itself
 * (interactive-widget=resizes-content in the viewport); iOS leaves the page full height and slides the
 * visible area around instead. Either way the visual viewport is what's actually visible, so while
 * the keyboard is up, full-screen layers ([data-fill]) are pinned to it (--vv-top / --vv-h) and the
 * root gets data-kb, which hides the tab bar and drops the home-indicator padding (--safe-b).
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
    root.toggleAttribute("data-kb", open);
    if (open) {
      root.style.setProperty("--vv-h", `${vv.height}px`);
      root.style.setProperty("--vv-top", `${vv.offsetTop}px`);
    } else {
      root.style.removeProperty("--vv-h");
      root.style.removeProperty("--vv-top");
    }
  };
  const schedule = () => void (frame ||= requestAnimationFrame(update));

  vv.addEventListener("resize", schedule);
  vv.addEventListener("scroll", schedule);
  window.addEventListener("orientationchange", () => ((full = 0), schedule()));
  document.addEventListener("focusin", schedule);
  document.addEventListener("focusout", () => {
    schedule();
    // iOS can leave the page scrolled after the keyboard goes away
    setTimeout(() => window.scrollY && window.scrollTo(0, 0), 100);
  });
}
