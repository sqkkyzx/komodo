import labels from "@/locales/zh-cn.json";

const normalize = (value: string) => value.replace(/[\s_-]/g, "").toLowerCase();
const displayNames = new Map(
  Object.entries(labels).map(([key, value]) => [normalize(key), value]),
);

/** Display text only. Keep the original value in requests, routes and storage. */
export function displayLabel(value: string | number | null | undefined): string {
  if (value == null) return "";
  const text = String(value);
  return displayNames.get(normalize(text)) ?? text;
}

export function resourceLabel(type: string): string {
  return displayLabel(type);
}
