import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import type { SeatingWorkspace } from "../domain/types";
import {
  SeatingRepositoryError,
  type RepositoryCommand,
  type SeatingRepository,
} from "./seatingRepository";

type RpcResponse = { data: unknown; error: { message: string; code?: string } | null };

function asWorkspace(value: unknown): SeatingWorkspace {
  if (!value || typeof value !== "object" || !("draft" in value)) {
    throw new SeatingRepositoryError("Supabase returned an invalid seating workspace.");
  }
  return value as SeatingWorkspace;
}

function rpcForCommand(command: RepositoryCommand): [string, Record<string, unknown>] {
  switch (command.type) {
    case "move_invitee":
      return ["admin_move_seating_invitee", {
        p_expected_version: command.expectedVersion,
        p_invitee_id: command.inviteeId,
        p_to_seat_id: command.toSeatId,
      }];
    case "undo_move":
      return ["admin_undo_seating_move", {
        p_expected_version: command.expectedVersion,
        p_audit_id: command.auditId,
      }];
    case "upsert_invitee":
      return ["admin_upsert_seating_invitee", {
        p_expected_version: command.expectedVersion,
        p_invitee: command.invitee,
      }];
    case "resolve_roster":
      return ["admin_resolve_attendance_roster", {
        p_expected_version: command.expectedVersion,
        p_invite_code: command.invitationPartyId,
        p_confirmed_invitee_ids: command.confirmedInviteeIds,
        p_reason: command.reason ?? null,
      }];
    case "amend_rsvp":
      return ["admin_amend_seating_rsvp", {
        p_expected_version: command.expectedVersion,
        p_invite_code: command.invitationPartyId,
        p_next_status: command.nextStatus,
        p_next_attending_count: command.nextAttendingCount,
        p_reason: command.reason,
      }];
    case "upsert_table":
      return ["admin_upsert_seating_table", {
        p_expected_version: command.expectedVersion,
        p_table: command.table,
      }];
    case "publish":
      return ["admin_publish_seating_plan", { p_expected_version: command.expectedVersion }];
    case "restore_revision":
      return ["admin_restore_seating_revision", {
        p_expected_version: command.expectedVersion,
        p_revision_id: command.revisionId,
      }];
    case "set_guest_lookup":
      return ["admin_set_guest_lookup_enabled", { p_enabled: command.enabled }];
  }
}

function friendlyError(error: { message: string; code?: string }) {
  const message = error.message || "The seating planner request failed.";
  if (message.includes("STALE_VERSION")) {
    return new SeatingRepositoryError(
      "The plan changed on another device. The latest plan has been loaded.",
      "stale_version",
    );
  }
  if (message.includes("SEAT_OCCUPIED") || error.code === "23505") {
    const occupiedBy = message.match(/SEAT_OCCUPIED:([^\n]+)/)?.[1]?.trim();
    return new SeatingRepositoryError(
      occupiedBy
        ? `That seat was just occupied by ${occupiedBy}. The latest plan has been loaded.`
        : "That seat was just occupied by the other administrator. The latest plan has been loaded.",
      "seat_occupied",
    );
  }
  if (message.includes("PUBLICATION_BLOCKED")) {
    return new SeatingRepositoryError(
      "Resolve every publishing error before publishing.",
      "publication_blocked",
    );
  }
  return new SeatingRepositoryError(message, error.code);
}

function createSecureToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function createSupabaseSeatingRepository(client: SupabaseClient): SeatingRepository {
  let channel: RealtimeChannel | null = null;

  const executeRpc = async (name: string, args: Record<string, unknown>) => {
    const response = (await client.rpc(name, args)) as RpcResponse;
    if (response.error) throw friendlyError(response.error);
    return asWorkspace(response.data);
  };

  return {
    async load() {
      return executeRpc("admin_get_seating_workspace", {});
    },

    async execute(command) {
      const [name, args] = rpcForCommand(command);
      return executeRpc(name, args);
    },

    async provisionGuestAccess(invitationPartyId) {
      const token = createSecureToken();
      const { error } = await client.rpc("admin_set_guest_seating_token", {
        p_invite_code: invitationPartyId,
        p_plain_token: token,
      });
      if (error) throw friendlyError(error);
      return token;
    },

    subscribe(onChange) {
      channel = client
        .channel("seating-admin-live")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "seating_plan_state" },
          onChange,
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "seating_assignments" },
          onChange,
        )
        .subscribe();

      return () => {
        if (channel) void client.removeChannel(channel);
        channel = null;
      };
    },
  };
}
