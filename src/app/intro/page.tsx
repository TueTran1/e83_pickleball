"use client";
import Logo from "@/components/Logo";
import ContactBar from "@/components/ContactBar";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ContentBlock, CmsDraft } from "@/lib/cms";

// ─── Block renderer ────────────────────────────────────────────────────────────

function RenderBlock({ block }: { block: ContentBlock }) {
  switch (block.type) {
    case "heading": {
      const Tag = (`h${block.level ?? 2}`) as "h1" | "h2" | "h3";
      const sizes = { h1: "text-3xl", h2: "text-xl", h3: "text-base" };
      return (
        <Tag className={`${sizes[Tag]} font-black text-white leading-tight`}>
          {block.content}
        </Tag>
      );
    }
    case "text":
      return (
        <p className="text-sm text-slate-400 leading-relaxed whitespace-pre-line">
          {block.content}
        </p>
      );
    case "image":
      return block.src ? (
        <figure className="rounded-2xl overflow-hidden border border-white/8">
          <img src={block.src} alt={block.alt ?? ""} className="w-full object-cover max-h-64" />
          {block.caption && (
            <figcaption className="text-[11px] text-slate-500 text-center px-4 py-2">
              {block.caption}
            </figcaption>
          )}
        </figure>
      ) : (
        <div className="rounded-2xl border border-dashed border-white/10 h-32 flex items-center justify-center text-slate-600 text-xs">
          Chưa có hình ảnh
        </div>
      );
    case "video":
      if (!block.src) return null;
      // Detect YouTube embed
      if (block.src.includes("youtube.com") || block.src.includes("youtu.be")) {
        const embedUrl = block.src
          .replace("watch?v=", "embed/")
          .replace("youtu.be/", "youtube.com/embed/");
        return (
          <figure className="rounded-2xl overflow-hidden border border-white/8">
            <iframe
              src={embedUrl}
              className="w-full aspect-video"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
            {block.caption && (
              <figcaption className="text-[11px] text-slate-500 text-center px-4 py-2">
                {block.caption}
              </figcaption>
            )}
          </figure>
        );
      }
      return (
        <figure className="rounded-2xl overflow-hidden border border-white/8">
          <video src={block.src} controls className="w-full" />
          {block.caption && (
            <figcaption className="text-[11px] text-slate-500 text-center px-4 py-2">{block.caption}</figcaption>
          )}
        </figure>
      );
    case "card":
      return (
        <div className="rounded-2xl border border-white/8 bg-white/4 p-4">
          {block.title && <p className="text-sm font-semibold text-white mb-1">{block.title}</p>}
          {block.description && (
            <p className="text-xs text-slate-400 leading-relaxed whitespace-pre-line">
              {block.description}
            </p>
          )}
        </div>
      );
    default:
      return null;
  }
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function IntroPage() {
  const [draft, setDraft]     = useState<CmsDraft | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/intro")
      .then((r) => r.json())
      .then((d) => setDraft(d.draft ?? null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen bg-[#0E2A21] text-white">
      {/* Nav */}
      <nav className="sticky top-0 z-20 flex items-center justify-between px-5 py-4 border-b border-white/8 bg-[#0E2A21]/90 backdrop-blur-md">
        <Link href="/" className="flex items-center gap-2 text-jade hover:opacity-80 transition">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="text-xs font-semibold">Trang chủ</span>
        </Link>
        <Logo size={26} textSize="sm" />
      </nav>

      <div className="max-w-2xl mx-auto px-5 py-8 pb-32 space-y-6">
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 rounded-full border-2 border-jade/30 border-t-jade animate-spin" />
          </div>
        )}

        {!loading && (!draft || draft.blocks.length === 0) && (
          <div className="text-center py-16 text-slate-500 text-sm">
            Nội dung giới thiệu chưa được cập nhật.
          </div>
        )}

        {!loading && draft && draft.blocks.map((block) => (
          <RenderBlock key={block.id} block={block} />
        ))}
      </div>

      {/* Sticky Book Now button */}
      <div className="fixed bottom-0 left-0 right-0 z-20 px-5 py-4 bg-[#0E2A21]/95 backdrop-blur-md border-t border-white/8">
        <Link
          href="/booking"
          className="flex items-center justify-center gap-2 w-full rounded-full bg-jade py-4 text-sm font-bold uppercase tracking-widest text-[#0E2A21] shadow-jade hover:bg-jade-light active:scale-95 transition"
        >
          Đặt sân ngay
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 7h10M7 2l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </Link>
      </div>
    </main>
  );
}
