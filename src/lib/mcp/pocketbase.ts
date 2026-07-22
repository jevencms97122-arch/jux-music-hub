type PocketBaseRecord = Record<string, unknown> & {
  id: string;
  collectionId?: string;
  collectionName?: string;
};

type PocketBaseList<T> = {
  items: T[];
};

function pocketBaseUrl(): string {
  const deno = (globalThis as { Deno?: { env: { get(name: string): string | undefined } } }).Deno;
  const runtimeEnv = deno
    ? { POCKETBASE_URL: deno.env.get("POCKETBASE_URL"), VITE_PB_URL: deno.env.get("VITE_PB_URL") }
    : { POCKETBASE_URL: process.env.POCKETBASE_URL, VITE_PB_URL: process.env.VITE_PB_URL };
  const url = runtimeEnv.POCKETBASE_URL?.trim() || runtimeEnv.VITE_PB_URL?.trim();
  if (!url) {
    throw new Error("POCKETBASE_URL is not configured for the MCP server.");
  }

  const parsed = new URL(url);
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("POCKETBASE_URL must be an http(s) URL.");
  }

  return parsed.toString().replace(/\/$/, "");
}

export function escapePocketBaseFilter(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export async function listPocketBaseRecords<T extends PocketBaseRecord>(
  collection: string,
  options: { page?: number; perPage?: number; filter?: string; sort?: string } = {},
): Promise<T[]> {
  const page = options.page ?? 1;
  const perPage = options.perPage ?? 20;
  const url = new URL(`${pocketBaseUrl()}/api/collections/${encodeURIComponent(collection)}/records`);
  url.searchParams.set("page", String(page));
  url.searchParams.set("perPage", String(perPage));
  if (options.filter) url.searchParams.set("filter", options.filter);
  if (options.sort) url.searchParams.set("sort", options.sort);

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    redirect: "error",
  });

  if (!response.ok) {
    throw new Error(`PocketBase request failed (${response.status}).`);
  }

  const data = (await response.json()) as PocketBaseList<T>;
  return Array.isArray(data.items) ? data.items : [];
}

export function publicFileUrl(record: PocketBaseRecord, filename: unknown): string | null {
  if (typeof filename !== "string" || !filename) return null;
  const collection = record.collectionId || record.collectionName;
  if (!collection) return null;
  return `${pocketBaseUrl()}/api/files/${encodeURIComponent(collection)}/${encodeURIComponent(record.id)}/${encodeURIComponent(filename)}`;
}

export function publicSong(record: PocketBaseRecord) {
  const coverUrl = typeof record.cover_url === "string" && record.cover_url
    ? record.cover_url
    : publicFileUrl(record, record.cover);

  return {
    id: record.id,
    title: typeof record.title === "string" ? record.title : "",
    author: typeof record.author === "string" ? record.author : "",
    genre: typeof record.genre === "string" && record.genre ? record.genre : null,
    durationSeconds: typeof record.duration === "number" ? record.duration : 0,
    playCount: typeof record.play_count === "number" ? record.play_count : 0,
    weeklyPlayCount: typeof record.weekly_play_count === "number" ? record.weekly_play_count : 0,
    likesCount: typeof record.likes_count === "number" ? record.likes_count : 0,
    coverUrl,
  };
}