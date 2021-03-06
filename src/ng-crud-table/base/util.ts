export function isBlank(val: any): boolean {
  if (val !== null && val !== undefined) {
    if ((typeof val === 'string' && val.trim().length === 0) ||
      (val instanceof Array && val.length === 0) ||
      (typeof val === 'object' && Object.getOwnPropertyNames(val).length === 0)) {
      return true;
    } else {
      return false;
    }
  }
  return true;
}

let uid: number = 0;

/** @hidden */
export function getUid(): number {
  return uid++;
}

export function getHeight(el): number {
  let height = el.offsetHeight;
  const style = getComputedStyle(el);
  height -= parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
  height -= parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
  return height;
}

export function translate(x: number, y: number) {
  const styles: any = {};
  styles.transform = `translate3d(${x}px, ${y}px, 0)`;
  styles.backfaceVisibility = 'hidden';
  return styles;
}
