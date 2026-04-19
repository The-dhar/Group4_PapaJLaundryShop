/**
 * While an <input type="number"> is focused, Chrome/Edge/Safari may change its value
 * when the user scrolls (mouse wheel / trackpad) anywhere on the page.
 * Calling preventDefault on wheel in that state stops both the value change and scroll;
 * staff can scroll after clicking outside the field or tabbing away.
 */
export function installNumberInputWheelBlock() {
  const onWheel = (e) => {
    const ae = document.activeElement;
    if (!ae || ae.tagName !== 'INPUT') return;
    if (ae.getAttribute('type') !== 'number') return;
    e.preventDefault();
  };
  document.addEventListener('wheel', onWheel, { passive: false, capture: true });
}
