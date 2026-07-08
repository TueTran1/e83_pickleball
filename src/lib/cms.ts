// ═════════════════════════════════════════════════════════════════════════════
// INTRODUCTION PAGE CMS — backed by Turso (libSQL / SQLite over HTTP)
// ═════════════════════════════════════════════════════════════════════════════

import { getDb, ensureSchema } from "./turso";
import { deepNormalize } from "./textNormalize";

export type ContentBlockType = "heading" | "text" | "image" | "video" | "card";

export interface ContentBlock {
  id: string;
  type: ContentBlockType;
  content?: string;
  level?: 1 | 2 | 3;
  src?: string;
  alt?: string;
  caption?: string;
  title?: string;
  description?: string;
  icon?: string;
}

export type DraftStatus = "draft" | "published" | "archived";

export interface CmsDraft {
  id: string;
  name: string;
  status: DraftStatus;
  blocks: ContentBlock[];
  createdAt: number;
  updatedAt: number;
  publishedAt?: number;
}

interface CmsStore {
  drafts: CmsDraft[];
  publishedId: string | null;
}

const CMS_ID = "singleton";

const DEFAULT_BLOCKS: ContentBlock[] = [
  { id: "b1", type: "heading", level: 1, content: "Sân Pickleball E83" },
  { id: "b2", type: "text", content: "Hệ thống 2 sân Pickleball tiêu chuẩn tại Câu lạc bộ E83. Không gian thể thao chuyên nghiệp, hiện đại tại 01 Nguyễn Phan Vinh, Sơn Trà, Đà Nẵng." },
  { id: "b3", type: "image", src: "", alt: "Sân Pickleball E83", caption: "Sân 1 nhìn từ trên" },
  { id: "b4", type: "card", title: "Sân 1", description: "Mở cửa 05:30 – 21:00 hàng ngày, không giới hạn khung giờ." },
  { id: "b5", type: "card", title: "Sân 2", description: "16:30 – 19:00 hàng ngày & 05:30 – 07:00 cuối tuần dành riêng nội bộ." },
  { id: "b6", type: "heading", level: 2, content: "Bảng giá" },
  { id: "b7", type: "text", content: "05:30 – 16:30: 70.000 VND/giờ\n16:30 – 21:00: 120.000 VND/giờ" },
];

const DEFAULT_STORE: CmsStore = {
  drafts: [{
    id: "dft_default", name: "Phiên bản gốc", status: "published",
    blocks: DEFAULT_BLOCKS, createdAt: Date.now(), updatedAt: Date.now(), publishedAt: Date.now(),
  }],
  publishedId: "dft_default",
};

const genId     = () => `blk_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const genDraftId = () => `dft_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

// ─── In-process cache (same pattern as serverSettings) ───────────────────────

let _cache: CmsStore | null = null;

async function readCms(): Promise<CmsStore> {
  if (_cache) return _cache;
  await ensureSchema();
  const db = getDb();
  const res = await db.execute({ sql: `SELECT data FROM cms WHERE id = ?`, args: [CMS_ID] });
  if (res.rows.length === 0) {
    _cache = DEFAULT_STORE;
    return _cache;
  }
  try {
    const parsed = JSON.parse(String(res.rows[0].data));
    _cache = { drafts: [], publishedId: null, ...parsed };
    return _cache!;
  } catch {
    _cache = DEFAULT_STORE;
    return _cache;
  }
}

async function writeCms(store: CmsStore): Promise<void> {
  await ensureSchema();
  const db = getDb();
  const normalized = deepNormalize(store);
  await db.execute({
    sql: `INSERT INTO cms (id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data`,
    args: [CMS_ID, JSON.stringify(normalized)],
  });
  _cache = normalized;
}

// ─── Public API (all now async) ───────────────────────────────────────────────

export async function listDrafts(): Promise<CmsDraft[]> {
  const store = await readCms();
  return [...store.drafts].sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getDraft(id: string): Promise<CmsDraft | null> {
  const store = await readCms();
  return store.drafts.find((d) => d.id === id) ?? null;
}

export async function getPublishedDraft(): Promise<CmsDraft | null> {
  const store = await readCms();
  if (!store.publishedId) return null;
  return store.drafts.find((d) => d.id === store.publishedId) ?? null;
}

export async function createDraft(name?: string): Promise<CmsDraft> {
  const store = await readCms();
  const draft: CmsDraft = {
    id: genDraftId(),
    name: name ?? `Bản nháp ${new Date().toLocaleDateString("vi-VN")}`,
    status: "draft", blocks: [], createdAt: Date.now(), updatedAt: Date.now(),
  };
  store.drafts.push(draft);
  await writeCms(store);
  return draft;
}

export async function duplicateDraft(sourceId: string, name?: string): Promise<CmsDraft | null> {
  const store = await readCms();
  const source = store.drafts.find((d) => d.id === sourceId);
  if (!source) return null;
  const copy: CmsDraft = {
    ...source, id: genDraftId(), name: name ?? `${source.name} (bản sao)`,
    status: "draft", createdAt: Date.now(), updatedAt: Date.now(), publishedAt: undefined,
  };
  store.drafts.push(copy);
  await writeCms(store);
  return copy;
}

export async function saveDraft(id: string, blocks: ContentBlock[], name?: string): Promise<CmsDraft> {
  const store = await readCms();
  const idx = store.drafts.findIndex((d) => d.id === id);
  if (idx === -1) {
    const draft: CmsDraft = {
      id: id === "new" ? genDraftId() : id,
      name: name ?? `Bản nháp ${new Date().toLocaleDateString("vi-VN")}`,
      status: "draft", blocks: blocks.map((b) => ({ ...b, id: b.id || genId() })),
      createdAt: Date.now(), updatedAt: Date.now(),
    };
    store.drafts.push(draft);
    await writeCms(store);
    return draft;
  }
  const updated: CmsDraft = {
    ...store.drafts[idx],
    blocks: blocks.map((b) => ({ ...b, id: b.id || genId() })),
    updatedAt: Date.now(), ...(name ? { name } : {}),
  };
  store.drafts[idx] = updated;
  await writeCms(store);
  return updated;
}

export async function renameDraft(id: string, name: string): Promise<boolean> {
  const store = await readCms();
  const idx = store.drafts.findIndex((d) => d.id === id);
  if (idx === -1) return false;
  store.drafts[idx] = { ...store.drafts[idx], name, updatedAt: Date.now() };
  await writeCms(store);
  return true;
}

export async function publishDraft(id: string): Promise<boolean> {
  const store = await readCms();
  const idx = store.drafts.findIndex((d) => d.id === id);
  if (idx === -1) return false;
  if (store.publishedId && store.publishedId !== id) {
    const prevIdx = store.drafts.findIndex((d) => d.id === store.publishedId);
    if (prevIdx !== -1) store.drafts[prevIdx] = { ...store.drafts[prevIdx], status: "draft" };
  }
  store.drafts[idx] = { ...store.drafts[idx], status: "published", publishedAt: Date.now(), updatedAt: Date.now() };
  store.publishedId = id;
  await writeCms(store);
  return true;
}

export async function deleteDraft(id: string): Promise<{ ok: boolean; error?: string }> {
  const store = await readCms();
  if (store.publishedId === id) return { ok: false, error: "Không thể xóa phiên bản đang được xuất bản." };
  const before = store.drafts.length;
  store.drafts = store.drafts.filter((d) => d.id !== id);
  if (store.drafts.length === before) return { ok: false, error: "Không tìm thấy bản nháp." };
  await writeCms(store);
  return { ok: true };
}
