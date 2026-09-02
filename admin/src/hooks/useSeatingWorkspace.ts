import { useCallback, useEffect, useState } from "react";
import type { SeatingWorkspace } from "../domain/types";
import {
  SeatingRepositoryError,
  type RepositoryCommand,
  type SeatingRepository,
} from "../data/seatingRepository";

export function useSeatingWorkspace(repository: SeatingRepository) {
  const [workspace, setWorkspace] = useState<SeatingWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [message, setMessage] = useState("");
  const [lastMoveAuditId, setLastMoveAuditId] = useState<string | null>(null);

  const reload = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      setWorkspace(await repository.load());
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load the seating plan.");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [repository]);

  useEffect(() => {
    void reload();
    const unsubscribe = repository.subscribe(() => void reload(true));
    const onOnline = () => {
      setOnline(true);
      void reload(true);
    };
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      unsubscribe();
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [reload, repository]);

  const execute = useCallback(async (command: RepositoryCommand) => {
    if (!online) {
      setMessage("The planner is read-only while this device is offline.");
      return false;
    }
    setBusy(true);
    setMessage("");
    try {
      const nextWorkspace = await repository.execute(command);
      setWorkspace(nextWorkspace);
      if (command.type === "move_invitee") {
        const moveAudit = [...nextWorkspace.auditLog].reverse().find((entry) => entry.kind === "seat_moved");
        setLastMoveAuditId(moveAudit?.id ?? null);
      } else if (command.type === "undo_move") {
        setLastMoveAuditId(null);
      }
      return true;
    } catch (error) {
      const repositoryError = error instanceof SeatingRepositoryError ? error : null;
      setMessage(error instanceof Error ? error.message : "The change could not be saved.");
      if (repositoryError?.code === "stale_version" || repositoryError?.code === "seat_occupied") {
        await reload(true);
      }
      return false;
    } finally {
      setBusy(false);
    }
  }, [online, reload, repository]);

  const provisionGuestAccess = useCallback(async (invitationPartyId: string) => {
    if (!online) {
      setMessage("Guest links cannot be created while this device is offline.");
      return null;
    }
    setBusy(true);
    setMessage("");
    try {
      return await repository.provisionGuestAccess(invitationPartyId);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The secure guest link could not be created.");
      return null;
    } finally {
      setBusy(false);
    }
  }, [online, repository]);

  return {
    workspace,
    loading,
    busy,
    online,
    message,
    setMessage,
    execute,
    reload,
    lastMoveAuditId,
    provisionGuestAccess,
  };
}
