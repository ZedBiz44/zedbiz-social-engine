import { useEffect, useMemo, useState } from "react";
import { Link, useSearch, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, ChevronLeft, Copy, Loader2, LogOut, Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  claimPendingIdeas,
  deleteSavedSet,
  editDraft,
  generateDraftForIdea,
  loadOwnerWork,
  setDraftApproval,
} from "@/lib/save.functions";
import type { Draft, DraftGenResult, OwnerWork, SavedIdeaSet } from "@/lib/save-types";
import type { PostIdea } from "@/lib/sample-data";

export function OwnerDashboard() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { claim?: string };
  const fetchWork = useServerFn(loadOwnerWork);
  const fetchClaim = useServerFn(claimPendingIdeas);
  const fetchDelete = useServerFn(deleteSavedSet);

  const [work, setWork] = useState<OwnerWork | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [claimStatus, setClaimStatus] = useState<string | null>(null);
  const [activeSetId, setActiveSetId] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const w = await fetchWork();
      setWork(w);
    } catch {
      setError("We couldn't load your saved work. Try refreshing.");
    } finally {
      setLoading(false);
    }
  }

  // Load work on mount.
  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Claim-after-sign-in: if a claim token is in the URL, attempt to claim it
  // once. Works across browsers (the token is in the URL, not the session).
  useEffect(() => {
    const token = search.claim;
    if (!token) return;
    let cancelled = false;
    (async () => {
      setClaimStatus("Claiming your saved ideas…");
      try {
        const result = await fetchClaim({ data: { claimToken: token } });
        if (cancelled) return;
        if (result.ok) {
          setClaimStatus("Your ideas were saved to your account.");
          await refresh();
          // Clear the token from the URL.
          navigate({ to: "/_authenticated/", search: {} });
        } else {
          const map: Record<string, string> = {
            not_found:
              "We couldn't find that claim — it may have expired. Please save your ideas again.",
            expired: "That claim link expired. Please save your ideas again.",
            email_mismatch:
              "That claim belongs to a different email. Sign in with the email you used to save.",
            already_claimed: "Those ideas were already claimed.",
          };
          setClaimStatus(map[result.reason] ?? "We couldn't claim your ideas.");
          navigate({ to: "/_authenticated/", search: {} });
        }
      } catch {
        if (!cancelled) setClaimStatus("We couldn't claim your ideas right now.");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.claim]);

  async function onSignOut() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this saved set and its drafts?")) return;
    try {
      await fetchDelete({ data: { savedSetId: id } });
      await refresh();
    } catch {
      setError("We couldn't delete that set.");
    }
  }

  const activeSet = useMemo(
    () => work?.savedSets.find((s) => s.id === activeSetId) ?? null,
    [work, activeSetId],
  );
  const activeDrafts = useMemo(
    () => work?.drafts.filter((d) => d.savedSetId === activeSetId) ?? [],
    [work, activeSetId],
  );

  if (loading) {
    return (
      <div className="mx-auto flex w-full max-w-3xl items-center justify-center px-4 py-20 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin text-primary" /> Loading your saved work…
      </div>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-24 pt-6 sm:pt-10">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-foreground sm:text-xl">My saved ideas & drafts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Everything here is saved to your account.
          </p>
        </div>
        <button
          type="button"
          onClick={onSignOut}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent/30"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>

      {claimStatus && (
        <div className="mt-4 rounded-xl border border-accent/60 bg-accent/15 p-3 text-sm text-foreground">
          {claimStatus}
        </div>
      )}
      {error && (
        <div className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="mt-5">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80"
        >
          <Plus className="h-4 w-4" /> Generate new ideas
        </Link>
      </div>

      {activeSet ? (
        <SetDetail
          set={activeSet}
          drafts={activeDrafts}
          onBack={() => setActiveSetId(null)}
          onChanged={refresh}
        />
      ) : (
        <SetList work={work} onOpen={(id) => setActiveSetId(id)} onDelete={onDelete} />
      )}
    </main>
  );
}

function SetList({
  work,
  onOpen,
  onDelete,
}: {
  work: OwnerWork | null;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const sets = work?.savedSets ?? [];
  if (sets.length === 0) {
    return (
      <div className="mt-6 rounded-2xl border border-dashed border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">
          You haven't saved any ideas yet. Generate ideas and choose “Save my ideas & draft a post.”
        </p>
      </div>
    );
  }
  return (
    <div className="mt-6 space-y-3">
      {sets.map((s) => (
        <div key={s.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <button type="button" onClick={() => onOpen(s.id)} className="text-left">
              <p className="font-semibold text-foreground">{s.businessName}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">Topic: {s.topic}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {new Date(s.createdAt).toLocaleDateString()} · {s.ideas.length} ideas · idea #
                {s.selectedIdeaIndex + 1} selected
              </p>
            </button>
            <button
              type="button"
              onClick={() => onDelete(s.id)}
              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              aria-label="Delete set"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function SetDetail({
  set,
  drafts,
  onBack,
  onChanged,
}: {
  set: SavedIdeaSet;
  drafts: Draft[];
  onBack: () => void;
  onChanged: () => void;
}) {
  const selectedIdea = set.ideas[set.selectedIdeaIndex] ?? set.ideas[0]!;
  return (
    <div className="mt-6 space-y-5">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary"
      >
        <ChevronLeft className="h-4 w-4" /> All saved sets
      </button>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <h2 className="text-base font-bold text-foreground">{set.businessName}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {set.website} · Topic: {set.topic}
          {set.isCustomTopic && " (your topic)"}
        </p>

        <div className="mt-4 space-y-3">
          {set.ideas.map((idea, i) => (
            <div
              key={i}
              className={[
                "rounded-xl border p-4",
                i === set.selectedIdeaIndex
                  ? "border-primary/50 bg-accent/15"
                  : "border-border bg-background",
              ].join(" ")}
            >
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  {i + 1}
                </span>
                {i === set.selectedIdeaIndex && (
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                    Selected for drafting
                  </span>
                )}
              </div>
              <p className="mt-2 text-sm font-medium text-foreground">{idea.hook}</p>
              <p className="mt-1 text-xs text-muted-foreground">{idea.angle}</p>
              <p className="mt-1 text-xs text-muted-foreground">{idea.takeaway}</p>
            </div>
          ))}
        </div>
      </div>

      <DraftEditor
        savedSetId={set.id}
        businessName={set.businessName}
        idea={selectedIdea}
        drafts={drafts}
        onChanged={onChanged}
      />
    </div>
  );
}

function DraftEditor({
  savedSetId,
  businessName,
  idea,
  drafts,
  onChanged,
}: {
  savedSetId: string;
  businessName: string;
  idea: PostIdea;
  drafts: Draft[];
  onChanged: () => void;
}) {
  const fetchGenerate = useServerFn(generateDraftForIdea);
  const fetchEdit = useServerFn(editDraft);
  const fetchApprove = useServerFn(setDraftApproval);

  const [platform, setPlatform] = useState<"facebook" | "instagram">("facebook");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [caption, setCaption] = useState("");
  const [brief, setBrief] = useState("");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<"caption" | "brief" | null>(null);

  // Load the matching draft for the selected platform when one exists.
  useEffect(() => {
    const match = drafts.find((d) => d.platform === platform) ?? null;
    setDraft(match);
    setCaption(match?.caption ?? "");
    setBrief(match?.visualBrief ?? "");
    setGenError(null);
  }, [platform, drafts]);

  async function onGenerate() {
    setGenerating(true);
    setGenError(null);
    try {
      const result: DraftGenResult = await fetchGenerate({
        data: { savedSetId, platform, idea, businessName },
      });
      if (result.ok) {
        setDraft(result.draft);
        setCaption(result.draft.caption);
        setBrief(result.draft.visualBrief);
        await onChanged();
      } else {
        setGenError(result.note ?? "We couldn't draft that right now.");
      }
    } catch {
      setGenError("We couldn't draft that right now.");
    } finally {
      setGenerating(false);
    }
  }

  async function onSaveEdits() {
    if (!draft) return;
    setSaving(true);
    try {
      const updated = await fetchEdit({
        data: { draftId: draft.id, caption, visualBrief: brief },
      });
      setDraft(updated);
      await onChanged();
    } catch {
      setGenError("We couldn't save your edits.");
    } finally {
      setSaving(false);
    }
  }

  async function onToggleApproval() {
    if (!draft) return;
    try {
      const updated = await fetchApprove({
        data: { draftId: draft.id, approved: !draft.approved },
      });
      setDraft(updated);
      await onChanged();
    } catch {
      setGenError("We couldn't change approval.");
    }
  }

  function copy(text: string, which: "caption" | "brief") {
    void navigator.clipboard?.writeText(text);
    setCopied(which);
    window.setTimeout(() => setCopied(null), 1800);
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-bold text-foreground">Draft a post</h3>
        <div className="inline-flex rounded-lg border border-border p-0.5">
          {(["facebook", "instagram"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPlatform(p)}
              className={[
                "rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                platform === p
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {!draft && (
        <div className="mt-4">
          <button
            type="button"
            onClick={onGenerate}
            disabled={generating}
            className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {generating ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Drafting for {platform}…
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <Pencil className="h-4 w-4" /> Generate {platform} draft
              </span>
            )}
          </button>
          {genError && (
            <p className="mt-3 rounded-lg border border-accent/60 bg-accent/15 px-3 py-2 text-sm text-foreground">
              {genError}
            </p>
          )}
        </div>
      )}

      {draft && (
        <div className="mt-4 space-y-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-full bg-muted px-2 py-0.5">Revision {draft.revision}</span>
            {draft.approved ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-accent/20 px-2 py-0.5 font-medium text-primary">
                <Check className="h-3 w-3" /> Approved
              </span>
            ) : (
              <span className="rounded-full border border-border px-2 py-0.5">Not approved</span>
            )}
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="caption" className="text-sm font-medium text-foreground">
                Caption
              </label>
              <button
                type="button"
                onClick={() => copy(caption, "caption")}
                className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-primary"
              >
                {copied === "caption" ? (
                  <Check className="h-3 w-3 text-primary" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
                {copied === "caption" ? "Copied" : "Copy"}
              </button>
            </div>
            <textarea
              id="caption"
              rows={6}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="brief" className="text-sm font-medium text-foreground">
                Visual brief
              </label>
              <button
                type="button"
                onClick={() => copy(brief, "brief")}
                className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-primary"
              >
                {copied === "brief" ? (
                  <Check className="h-3 w-3 text-primary" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
                {copied === "brief" ? "Copied" : "Copy"}
              </button>
            </div>
            <textarea
              id="brief"
              rows={3}
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={onSaveEdits}
              disabled={saving}
              className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save edits"}
            </button>
            <button
              type="button"
              onClick={onToggleApproval}
              className={[
                "flex-1 rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors",
                draft.approved
                  ? "border-border bg-background text-foreground hover:bg-accent/30"
                  : "border-primary bg-accent/20 text-primary hover:bg-accent/30",
              ].join(" ")}
            >
              {draft.approved ? "Clear approval" : "Approve this revision"}
            </button>
          </div>
          {draft.approved && (
            <p className="text-xs text-muted-foreground">
              Approval applies to revision {draft.revision}. Editing the text clears approval.
            </p>
          )}
          {genError && (
            <p className="rounded-lg border border-accent/60 bg-accent/15 px-3 py-2 text-sm text-foreground">
              {genError}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
