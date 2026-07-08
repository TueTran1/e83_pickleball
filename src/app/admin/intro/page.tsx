"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CmsDraft, ContentBlock, ContentBlockType } from "@/lib/cms";
import { useToast } from "@/app/admin/layout";

// ─── Block type labels & icons ────────────────────────────────────────────────

const BLOCK_LABELS: Record<ContentBlockType, string> = {
  heading: "Tiêu đề",
  text: "Đoạn văn",
  image: "Hình ảnh",
  video: "Video",
  card: "Thẻ thông tin",
};

const genId = () => `b_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

// ─── Preview Block Renderer ───────────────────────────────────────────────────

function PreviewBlock({ block }: { block: ContentBlock }) {
  switch (block.type) {
    case "heading": {
      const Tag = (`h${block.level ?? 2}`) as "h1" | "h2" | "h3";
      const sizes: Record<string, string> = { h1: "text-2xl", h2: "text-xl", h3: "text-base" };
      return <Tag className={`${sizes[Tag]} font-black text-white leading-tight`}>{block.content}</Tag>;
    }
    case "text":
      return <p className="text-sm text-slate-400 leading-relaxed whitespace-pre-line">{block.content}</p>;
    case "image":
      return block.src ? (
        <figure className="rounded-2xl overflow-hidden border border-white/8">
          <img src={block.src} alt={block.alt ?? ""} className="w-full object-cover max-h-52" />
          {block.caption && <figcaption className="text-[11px] text-slate-500 text-center px-4 py-2">{block.caption}</figcaption>}
        </figure>
      ) : (
        <div className="rounded-2xl border border-dashed border-white/10 h-24 flex items-center justify-center text-slate-600 text-xs">Chưa có hình ảnh</div>
      );
    case "video":
      if (!block.src) return null;
      if (block.src.includes("youtube") || block.src.includes("youtu.be")) {
        const embedUrl = block.src.replace("watch?v=", "embed/").replace("youtu.be/", "youtube.com/embed/");
        return (
          <figure className="rounded-2xl overflow-hidden border border-white/8">
            <iframe src={embedUrl} className="w-full aspect-video" allowFullScreen />
            {block.caption && <figcaption className="text-[11px] text-slate-500 text-center px-4 py-2">{block.caption}</figcaption>}
          </figure>
        );
      }
      return <figure className="rounded-2xl overflow-hidden border border-white/8"><video src={block.src} controls className="w-full" /></figure>;
    case "card":
      return (
        <div className="rounded-2xl border border-white/8 bg-white/4 p-4">
          {block.title && <p className="text-sm font-semibold text-white mb-1">{block.title}</p>}
          {block.description && <p className="text-xs text-slate-400 leading-relaxed whitespace-pre-line">{block.description}</p>}
        </div>
      );
    default:
      return null;
  }
}

function PreviewPane({ blocks }: { blocks: ContentBlock[] }) {
  return (
    <div className="flex flex-col h-full">
      {/* Mobile-sized preview frame */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-white/8 bg-[#15392C]">
        <div className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500/60" />
          <span className="w-2.5 h-2.5 rounded-full bg-jade/60" />
        </div>
        <span className="text-[10px] text-slate-500 mx-auto">Xem trước — không ảnh hưởng đến trang đã xuất bản</span>
      </div>
      <div className="flex-1 overflow-y-auto bg-[#0E2A21]">
        <div className="max-w-sm mx-auto px-5 py-8 space-y-6">
          {blocks.length === 0 ? (
            <p className="text-slate-600 text-xs text-center py-8">Bản nháp trống</p>
          ) : (
            blocks.map((b) => <PreviewBlock key={b.id} block={b} />)
          )}
        </div>
      </div>
    </div>
  );
}

function BlockEditor({
  block,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  block: ContentBlock;
  onChange: (b: ContentBlock) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const upd = (patch: Partial<ContentBlock>) => onChange({ ...block, ...patch });

  return (
    <div className="rounded-2xl border border-white/8 bg-white/4 p-4 space-y-3 group">
      {/* Block header */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-widest text-jade/60 font-bold">
          {BLOCK_LABELS[block.type]}
        </span>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
          <button type="button" onClick={onMoveUp} title="Lên"
            className="w-6 h-6 rounded-lg bg-white/6 text-slate-400 hover:text-jade flex items-center justify-center text-xs">↑</button>
          <button type="button" onClick={onMoveDown} title="Xuống"
            className="w-6 h-6 rounded-lg bg-white/6 text-slate-400 hover:text-jade flex items-center justify-center text-xs">↓</button>
          <button type="button" onClick={onDelete} title="Xóa block"
            className="w-6 h-6 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 flex items-center justify-center text-xs">×</button>
        </div>
      </div>

      {/* Heading */}
      {block.type === "heading" && (
        <div className="space-y-2">
          <div className="flex gap-1">
            {([1, 2, 3] as const).map((l) => (
              <button key={l} type="button" onClick={() => upd({ level: l })}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${block.level === l ? "bg-jade text-[#0E2A21]" : "bg-white/6 text-slate-400 hover:text-jade"}`}>
                H{l}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={block.content ?? ""}
            onChange={(e) => upd({ content: e.target.value })}
            placeholder="Tiêu đề..."
            className="w-full bg-[#0E2A21] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-jade"
          />
        </div>
      )}

      {/* Text */}
      {block.type === "text" && (
        <textarea
          value={block.content ?? ""}
          onChange={(e) => upd({ content: e.target.value })}
          placeholder="Nội dung đoạn văn..."
          rows={4}
          className="w-full bg-[#0E2A21] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-jade resize-none"
        />
      )}

      {/* Image */}
      {block.type === "image" && (
        <div className="space-y-2">
          {/* File picker */}
          <div>
            <label className="text-[9px] text-slate-500 uppercase tracking-wide pl-1 block mb-1">
              Tải ảnh từ máy
            </label>
            <label className="flex items-center gap-2 w-full cursor-pointer rounded-xl border border-dashed border-white/20 bg-white/4 hover:border-jade/40 hover:bg-jade/5 px-3 py-2.5 transition group">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0 text-jade/70 group-hover:text-jade transition">
                <path d="M7 1v8M4 4l3-3 3 3M1 10.5h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="text-xs text-slate-400 group-hover:text-slate-200 transition truncate">
                Chọn hình ảnh...
              </span>
              <input
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  if (files.length === 0) return;
                  // For the first file, update this block's src directly
                  const reader = new FileReader();
                  reader.onload = () => upd({ src: reader.result as string });
                  reader.readAsDataURL(files[0]);
                  // Reset input so same file can be picked again
                  e.target.value = "";
                }}
              />
            </label>
            <p className="text-[9px] text-slate-600 mt-1 pl-1">
              Hỗ trợ JPG, PNG, WebP. Ảnh được nhúng trực tiếp dưới dạng base64 — chỉ dùng để xem trước và xuất bản trên trang giới thiệu.
            </p>
          </div>

          {/* URL input (alternative) */}
          <div>
            <label className="text-[9px] text-slate-500 uppercase tracking-wide pl-1 block mb-1">
              Hoặc nhập URL hình ảnh
            </label>
            <input
              type="text"
              value={block.src?.startsWith("data:") ? "" : (block.src ?? "")}
              onChange={(e) => upd({ src: e.target.value })}
              placeholder="/photos/court1.jpg hoặc https://..."
              className="w-full bg-[#0E2A21] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-jade"
            />
          </div>

          {/* Alt + Caption */}
          <input
            type="text"
            value={block.alt ?? ""}
            onChange={(e) => upd({ alt: e.target.value })}
            placeholder="Mô tả hình ảnh (alt text)"
            className="w-full bg-[#0E2A21] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-jade"
          />
          <input
            type="text"
            value={block.caption ?? ""}
            onChange={(e) => upd({ caption: e.target.value })}
            placeholder="Chú thích hình (tuỳ chọn)"
            className="w-full bg-[#0E2A21] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-jade"
          />

          {/* Preview */}
          {block.src && (
            <div className="rounded-xl overflow-hidden bg-black/20 border border-white/8 relative group">
              <img
                src={block.src}
                alt={block.alt ?? ""}
                className="w-full max-h-48 object-cover"
                onError={(e) => (e.currentTarget.style.display = "none")}
              />
              <button
                type="button"
                onClick={() => upd({ src: "" })}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition w-6 h-6 rounded-full bg-black/70 text-white/80 hover:text-white flex items-center justify-center text-xs"
                title="Xóa ảnh"
              >
                ×
              </button>
            </div>
          )}
        </div>
      )}

      {/* Video */}
      {block.type === "video" && (
        <div className="space-y-2">
          <input
            type="text"
            value={block.src ?? ""}
            onChange={(e) => upd({ src: e.target.value })}
            placeholder="URL video hoặc YouTube embed URL"
            className="w-full bg-[#0E2A21] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-jade"
          />
          <input
            type="text"
            value={block.caption ?? ""}
            onChange={(e) => upd({ caption: e.target.value })}
            placeholder="Chú thích video (tuỳ chọn)"
            className="w-full bg-[#0E2A21] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-jade"
          />
        </div>
      )}

      {/* Card */}
      {block.type === "card" && (
        <div className="space-y-2">
          <input
            type="text"
            value={block.title ?? ""}
            onChange={(e) => upd({ title: e.target.value })}
            placeholder="Tiêu đề thẻ..."
            className="w-full bg-[#0E2A21] border border-white/10 rounded-xl px-3 py-2.5 text-sm font-semibold text-white outline-none focus:border-jade"
          />
          <textarea
            value={block.description ?? ""}
            onChange={(e) => upd({ description: e.target.value })}
            placeholder="Nội dung thẻ..."
            rows={2}
            className="w-full bg-[#0E2A21] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-jade resize-none"
          />
        </div>
      )}
    </div>
  );
}

// ─── Draft List Sidebar ───────────────────────────────────────────────────────

function DraftSidebar({
  drafts,
  currentId,
  onSelect,
  onNew,
  onPublish,
  onDuplicate,
  onDelete,
  onRename,
  publishedId,
}: {
  drafts: CmsDraft[];
  currentId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onPublish: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
  publishedId: string | null;
}) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameVal, setRenameVal]   = useState("");

  return (
    <div className="flex flex-col h-full bg-[#15392C] border-r border-white/8">
      <div className="p-3 border-b border-white/8">
        <p className="text-[10px] uppercase tracking-widest text-jade/70 font-bold mb-2">Bản nháp</p>
        <button type="button" onClick={onNew}
          className="w-full rounded-xl border border-dashed border-white/15 py-2 text-xs text-slate-400 hover:border-jade/50 hover:text-jade transition">
          + Tạo bản nháp mới
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {drafts.map((d) => (
          <div key={d.id}
            className={`rounded-xl border p-2.5 cursor-pointer transition group ${
              currentId === d.id
                ? "border-jade bg-jade/10"
                : "border-white/6 bg-white/3 hover:border-white/15"
            }`}
            onClick={() => onSelect(d.id)}>
            {renamingId === d.id ? (
              <input
                type="text"
                value={renameVal}
                autoFocus
                onChange={(e) => setRenameVal(e.target.value)}
                onBlur={() => { onRename(d.id, renameVal || d.name); setRenamingId(null); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { onRename(d.id, renameVal || d.name); setRenamingId(null); }
                  if (e.key === "Escape") setRenamingId(null);
                }}
                className="w-full bg-[#0E2A21] rounded-lg px-2 py-1 text-xs text-white outline-none border border-jade"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <p className={`text-xs font-semibold truncate leading-none mb-1 ${currentId === d.id ? "text-jade" : "text-white"}`}>
                {d.name}
                {d.id === publishedId && (
                  <span className="ml-1.5 text-[9px] bg-jade/20 text-jade px-1.5 py-0.5 rounded-full">Live</span>
                )}
              </p>
            )}
            <p className="text-[10px] text-slate-600">
              {new Date(d.updatedAt).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })}
            </p>
            {/* Action buttons — shown on hover */}
            <div className="flex gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition" onClick={(e) => e.stopPropagation()}>
              <button type="button" onClick={() => onPublish(d.id)}
                disabled={d.id === publishedId}
                className="flex-1 text-[9px] py-1 rounded-lg bg-jade/15 text-jade hover:bg-jade/25 transition disabled:opacity-30 disabled:cursor-not-allowed">
                {d.id === publishedId ? "Đang live" : "Xuất bản"}
              </button>
              <button type="button" onClick={() => { setRenamingId(d.id); setRenameVal(d.name); }}
                className="px-2 py-1 rounded-lg bg-white/6 text-slate-400 hover:text-jade text-[9px] transition">
                Đổi tên
              </button>
              <button type="button" onClick={() => onDuplicate(d.id)}
                className="px-2 py-1 rounded-lg bg-white/6 text-slate-400 hover:text-jade text-[9px] transition">
                Sao chép
              </button>
              <button type="button" onClick={() => onDelete(d.id)}
                disabled={d.id === publishedId}
                className="px-2 py-1 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 text-[9px] transition disabled:opacity-30 disabled:cursor-not-allowed">
                Xóa
              </button>
            </div>
          </div>
        ))}
        {drafts.length === 0 && (
          <p className="text-xs text-slate-600 text-center py-6">Chưa có bản nháp nào.</p>
        )}
      </div>
    </div>
  );
}

// ─── Main CMS Page ────────────────────────────────────────────────────────────

interface CmsDraftWithPublishedId extends CmsDraft {
  _publishedId?: string;
}

export default function AdminIntroPage() {
  const { showToast } = useToast();

  const [drafts, setDrafts]           = useState<CmsDraft[]>([]);
  const [publishedId, setPublishedId] = useState<string | null>(null);
  const [currentId, setCurrentId]     = useState<string | null>(null);
  const [blocks, setBlocks]           = useState<ContentBlock[]>([]);
  const [draftName, setDraftName]     = useState("");
  const [saving, setSaving]           = useState(false);
  const [autoSaved, setAutoSaved]     = useState<Date | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showPreview, setShowPreview] = useState(false);

  const autoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadDrafts = async () => {
    const res = await fetch("/api/admin-cms?action=list");
    const data = await res.json();
    const list: CmsDraft[] = data.drafts ?? [];
    setDrafts(list);
    const liveId = list.find((d) => d.status === "published")?.id ?? null;
    setPublishedId(liveId);
  };

  const loadDraft = async (id: string) => {
    const res = await fetch(`/api/admin-cms?action=get&id=${id}`);
    const data = await res.json();
    if (data.draft) {
      setBlocks(data.draft.blocks ?? []);
      setDraftName(data.draft.name);
      setCurrentId(id);
    }
  };

  useEffect(() => { loadDrafts(); }, []);
  useEffect(() => {
    if (currentId === null && drafts.length > 0) {
      const live = drafts.find((d) => d.status === "published") ?? drafts[0];
      loadDraft(live.id);
    }
  }, [drafts]);

  // Auto-save 3 seconds after last change
  const scheduleAutoSave = useCallback((newBlocks: ContentBlock[]) => {
    if (!currentId) return;
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(async () => {
      await fetch("/api/admin-cms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save", id: currentId, blocks: newBlocks }),
      });
      setAutoSaved(new Date());
    }, 3000);
  }, [currentId]);

  const handleBlockChange = (idx: number, updated: ContentBlock) => {
    const next = [...blocks];
    next[idx] = updated;
    setBlocks(next);
    scheduleAutoSave(next);
  };

  const handleDeleteBlock = (idx: number) => {
    const next = blocks.filter((_, i) => i !== idx);
    setBlocks(next);
    scheduleAutoSave(next);
  };

  const handleMoveUp = (idx: number) => {
    if (idx === 0) return;
    const next = [...blocks];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    setBlocks(next);
    scheduleAutoSave(next);
  };

  const handleMoveDown = (idx: number) => {
    if (idx === blocks.length - 1) return;
    const next = [...blocks];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    setBlocks(next);
    scheduleAutoSave(next);
  };

  const addBlock = (type: ContentBlockType) => {
    const newBlock: ContentBlock = {
      id: genId(),
      type,
      ...(type === "heading" ? { level: 2, content: "" } : {}),
      ...(type === "text"    ? { content: "" } : {}),
    };
    const next = [...blocks, newBlock];
    setBlocks(next);
    scheduleAutoSave(next);
  };

  const handleSave = async () => {
    if (!currentId) return;
    setSaving(true);
    await fetch("/api/admin-cms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save", id: currentId, blocks, name: draftName }),
    });
    setAutoSaved(new Date());
    setSaving(false);
    loadDrafts();
    showToast("Đã lưu bản nháp", "success");
  };

  const handlePublish = async (id: string) => {
    await fetch("/api/admin-cms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "publish", id }),
    });
    loadDrafts();
    showToast("Đã xuất bản trang Giới thiệu", "success");
  };

  const handleNewDraft = async () => {
    const res = await fetch("/api/admin-cms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create" }),
    });
    const data = await res.json();
    if (data.draft) {
      await loadDrafts();
      setBlocks([]);
      setDraftName(data.draft.name);
      setCurrentId(data.draft.id);
    }
  };

  const handleDuplicate = async (id: string) => {
    await fetch("/api/admin-cms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "duplicate", id }),
    });
    loadDrafts();
  };

  const handleDelete = async (id: string) => {
    const res = await fetch("/api/admin-cms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });
    const data = await res.json();
    if (!data.ok) { alert(data.error ?? "Không thể xóa"); return; }
    await loadDrafts();
    if (currentId === id) { setCurrentId(null); setBlocks([]); }
  };

  const handleRename = async (id: string, name: string) => {
    await fetch("/api/admin-cms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "rename", id, name }),
    });
    loadDrafts();
    if (currentId === id) setDraftName(name);
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Draft sidebar ── */}
      {showSidebar && (
        <div className="w-52 sm:w-60 shrink-0">
          <DraftSidebar
            drafts={drafts}
            currentId={currentId}
            publishedId={publishedId}
            onSelect={(id) => loadDraft(id)}
            onNew={handleNewDraft}
            onPublish={handlePublish}
            onDuplicate={handleDuplicate}
            onDelete={handleDelete}
            onRename={handleRename}
          />
        </div>
      )}

      {/* ── Editor pane ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/8 bg-[#0E2A21]">
          <button type="button" onClick={() => setShowSidebar((v) => !v)}
            className="w-7 h-7 rounded-lg bg-white/6 text-slate-400 hover:text-jade flex items-center justify-center transition shrink-0">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M1.5 3.5h11M1.5 7h11M1.5 10.5h11" strokeLinecap="round"/>
            </svg>
          </button>
          <input
            type="text"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            className="flex-1 bg-transparent text-sm font-semibold text-white outline-none placeholder-slate-600"
            placeholder="Tên bản nháp..."
          />
          {autoSaved && (
            <span className="text-[10px] text-slate-600 shrink-0">
              Lưu lúc {autoSaved.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          {/* Preview toggle */}
          <button type="button" onClick={() => setShowPreview((v) => !v)}
            className={["shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold transition border",
              showPreview
                ? "bg-jade/20 border-jade/40 text-jade"
                : "border-white/10 bg-white/6 text-slate-300 hover:border-jade/40 hover:text-jade",
            ].join(" ")}>
            {showPreview ? "Ẩn xem trước" : "Xem trước"}
          </button>
          <button type="button" onClick={handleSave} disabled={saving || !currentId}
            className="shrink-0 rounded-xl border border-white/10 bg-white/6 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-jade/40 hover:text-jade transition disabled:opacity-40">
            {saving ? "Đang lưu..." : "Lưu nháp"}
          </button>
          <button type="button" onClick={() => currentId && handlePublish(currentId)} disabled={!currentId || currentId === publishedId}
            className="shrink-0 rounded-xl bg-jade px-3 py-1.5 text-xs font-bold text-[#0E2A21] hover:bg-jade-light active:scale-95 transition disabled:opacity-40">
            {currentId === publishedId ? "Đang live" : "Xuất bản"}
          </button>
        </div>

        {/* Editor + Preview split */}
        <div className="flex-1 flex overflow-hidden">
          {/* Block editor */}
          <div className={`flex flex-col overflow-hidden ${showPreview ? "w-1/2 border-r border-white/8" : "flex-1"}`}>
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {blocks.length === 0 && (
                <div className="text-center py-12 text-slate-600 text-xs">
                  Bản nháp trống. Thêm block nội dung bên dưới.
                </div>
              )}
              {blocks.map((block, idx) => (
                <BlockEditor
                  key={block.id}
                  block={block}
                  onChange={(b) => handleBlockChange(idx, b)}
                  onDelete={() => handleDeleteBlock(idx)}
                  onMoveUp={() => handleMoveUp(idx)}
                  onMoveDown={() => handleMoveDown(idx)}
                />
              ))}
              {/* Add block buttons */}
              <div className="pt-2 pb-4">
                <p className="text-[10px] uppercase tracking-widest text-slate-600 mb-2">Thêm block</p>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(BLOCK_LABELS) as ContentBlockType[]).map((type) => (
                    <button key={type} type="button" onClick={() => addBlock(type)}
                      className="rounded-xl border border-dashed border-white/15 px-3 py-1.5 text-xs text-slate-500 hover:border-jade/50 hover:text-jade transition">
                      + {BLOCK_LABELS[type]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Live preview pane */}
          {showPreview && (
            <div className="w-1/2 overflow-hidden">
              <PreviewPane blocks={blocks} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
