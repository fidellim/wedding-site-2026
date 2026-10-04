import { useCallback, useEffect, useRef, useState } from "react";
import type { SeatingWorkspace } from "../domain/types";
import type { RepositoryCommand } from "../data/seatingRepository";
import { defaultVenueLayout, isVenueLayout, layoutSignature, type VenueLayout } from "./layout";

type Change = { before: VenueLayout; after: VenueLayout };
/** Session-only history; writes replace the shared draft, never append undo records. */
export function useVenueLayout(workspace: SeatingWorkspace | null, execute: (c: RepositoryCommand) => Promise<boolean>) {
  const [past, setPast] = useState<Change[]>([]), [future, setFuture] = useState<Change[]>([]);
  const pending = useRef(false);
  const signature = layoutSignature(workspace?.draft.venueLayout ?? null);
  const seen = useRef(signature), own = useRef<string | null>(null);
  const resetKey = JSON.stringify([workspace?.published?.id, workspace?.draft.baseRevisionNumber, workspace?.draft.tables]);
  useEffect(() => { setPast([]); setFuture([]); }, [resetKey]);
  useEffect(() => {
    if (signature !== seen.current) {
      if (signature !== own.current) { setPast([]); setFuture([]); }
      else own.current = null;
      seen.current = signature;
    }
  }, [signature]);
  const write = useCallback(async (layout: VenueLayout) => {
    if (!workspace || pending.current || !isVenueLayout(layout)) return false;
    pending.current = true;
    own.current = layoutSignature(layout);
    try {
      const ok = await execute({ type: "save_venue_layout", expectedVersion: workspace.draft.version, layout });
      if (!ok) { own.current = null; setPast([]); setFuture([]); }
      return ok;
    } finally { pending.current = false; }
  }, [workspace, execute]);
  const save = async (layout: VenueLayout) => {
    const before = structuredClone(workspace?.draft.venueLayout ?? defaultVenueLayout());
    if (layoutSignature(before) === layoutSignature(layout)) return true;
    if (!await write(layout)) return false;
    setPast(p => [...p, { before, after: structuredClone(layout) }].slice(-50)); setFuture([]);
    return true;
  };
  const undo = async () => {
    const change = past.at(-1); if (!change || !await write(change.before)) return;
    setPast(p => p.slice(0, -1)); setFuture(f => [...f, change]);
  };
  const redo = async () => {
    const change = future.at(-1); if (!change || !await write(change.after)) return;
    setFuture(f => f.slice(0, -1)); setPast(p => [...p, change].slice(-50));
  };
  return { save, undo, redo, canUndo: !!past.length, canRedo: !!future.length };
}
