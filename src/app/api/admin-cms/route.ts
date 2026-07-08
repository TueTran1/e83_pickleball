import { NextRequest, NextResponse } from "next/server";
import { isAdminSession } from "@/lib/adminSession";
import { listDrafts, getDraft, getPublishedDraft, createDraft, saveDraft, renameDraft, publishDraft, deleteDraft, duplicateDraft } from "@/lib/cms";

// Prevent Next.js from statically caching this route at build time.
// All these routes read live data from Turso — caching would serve stale responses.
export const dynamic = "force-dynamic";

function auth() {
  if (!isAdminSession()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return null;
}

export async function GET(request: NextRequest) {
  const deny = auth(); if (deny) return deny;
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action") ?? "list";
  const id     = searchParams.get("id") ?? "";

  if (action === "list")      return NextResponse.json({ drafts: await listDrafts() });
  if (action === "published") return NextResponse.json({ draft: await getPublishedDraft() });
  if (action === "get" && id) {
    const draft = await getDraft(id);
    return draft ? NextResponse.json({ draft }) : NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

export async function POST(request: NextRequest) {
  const deny = auth(); if (deny) return deny;
  const body = await request.json();
  const { action } = body;

  switch (action) {
    case "create":    return NextResponse.json({ draft: await createDraft(body.name) });
    case "save": {
      if (!body.id || !Array.isArray(body.blocks))
        return NextResponse.json({ error: "Missing id or blocks" }, { status: 400 });
      return NextResponse.json({ draft: await saveDraft(body.id, body.blocks, body.name) });
    }
    case "rename": {
      if (!body.id || !body.name)
        return NextResponse.json({ error: "Missing id or name" }, { status: 400 });
      return NextResponse.json({ ok: await renameDraft(body.id, body.name) });
    }
    case "publish": {
      if (!body.id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
      return NextResponse.json({ ok: await publishDraft(body.id) });
    }
    case "duplicate": {
      if (!body.id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
      return NextResponse.json({ draft: await duplicateDraft(body.id, body.name) });
    }
    case "delete": {
      if (!body.id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
      return NextResponse.json(await deleteDraft(body.id));
    }
    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}
