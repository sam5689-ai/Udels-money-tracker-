export const CATEGORICAL = {
  light: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"],
  dark: ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"],
};

export const DIVERGING = {
  income: { light: "#2a78d6", dark: "#3987e5" },
  expense: { light: "#e34948", dark: "#e66767" },
};

export const INK = {
  primary: { light: "#0b0b0b", dark: "#ffffff" },
  secondary: { light: "#52514e", dark: "#c3c2b7" },
  muted: { light: "#898781", dark: "#898781" },
  gridline: { light: "#e1e0d9", dark: "#2c2c2a" },
};

export const DELTA = {
  good: { light: "#006300", dark: "#0ca30c" },
  bad: { light: "#d03b3b", dark: "#e66767" },
};

export function categoricalColor(index: number, dark: boolean): string {
  const palette = dark ? CATEGORICAL.dark : CATEGORICAL.light;
  return palette[index % palette.length];
}

export function stableIndex(key: string, mod: number): number {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return hash % mod;
}
