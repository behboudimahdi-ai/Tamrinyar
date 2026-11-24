export async function request<T>(path: string, data?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: data === undefined ? 'GET' : 'POST',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const value = await res.json().catch(() => ({ error: 'پاسخ سرور خوانده نشد.' }));
  if (!res.ok) throw new Error(value.error || 'ذخیره انجام نشد.');
  return value as T;
}
export const message = (error: unknown) =>
  error instanceof Error ? error.message : 'ارتباط برقرار نشد. دوباره تلاش کنید.';
export function moveItem<T>(items: T[], index: number, offset: number) {
  const next = [...items],
    target = index + offset;
  if (target < 0 || target >= items.length) return items;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
