import { StrictMode, useMemo } from "react";
import type { Session } from "@supabase/supabase-js";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { AuthGate } from "./auth/AuthGate";
import { App } from "./App";
import { createMemorySeatingRepository } from "./data/memoryRepository";
import { createSupabaseSeatingRepository } from "./data/supabaseRepository";
import { getSupabaseConfiguration } from "./lib/supabase";
import "./styles.css";

function ConnectedApp({
  client,
  session,
  signOut,
}: {
  client: NonNullable<ReturnType<typeof getSupabaseConfiguration>["client"]>;
  session: Session;
  signOut: () => Promise<void>;
}) {
  const repository = useMemo(() => createSupabaseSeatingRepository(client), [client]);

  return (
    <App
      repository={repository}
      adminName={session.user.user_metadata.display_name ?? session.user.email?.split("@")[0] ?? "Admin"}
      onSignOut={signOut}
    />
  );
}

function EntryPoint() {
  const configuration = useMemo(getSupabaseConfiguration, []);
  const demoRepository = useMemo(() => createMemorySeatingRepository(), []);

  if (!configuration.client) {
    if (import.meta.env.DEV) {
      return <App repository={demoRepository} adminName="Fidel" demo />;
    }
    return (
      <main className="configuration-screen">
        <div className="surface-card">
          <p className="eyebrow">Configuration required</p>
          <h1>The private seating studio is not connected.</h1>
          <p>Set {configuration.missing.join(" and ")} in the Netlify environment before deployment.</p>
        </div>
      </main>
    );
  }

  return (
    <AuthGate client={configuration.client}>
      {(session, signOut) => (
        <ConnectedApp client={configuration.client!} session={session} signOut={signOut} />
      )}
    </AuthGate>
  );
}

const rootElement = document.getElementById("root") as HTMLElement & { seatingRoot?: Root };
const root = rootElement.seatingRoot ?? createRoot(rootElement);
rootElement.seatingRoot = root;
root.render(
  <StrictMode><EntryPoint /></StrictMode>,
);
