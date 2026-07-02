export function ngn(n: number | string | null | undefined) {
  const v = Number(n ?? 0);
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(v);
}

export function genRef(prefix = "EG") {
  const t = Date.now().toString(36).toUpperCase();
  const r = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `${prefix}-${t}-${r}`;
}

export function genValidationCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}
