import { useEffect, useState } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { previewFixture } from "./previewFixtures";
import { SeatingGuide } from "./SeatingGuide";
import { parseGuide, type GuideData } from "./guideData";
// Public configuration only; no admin session or credentials are used here.
// @ts-expect-error The invitation shares its existing JavaScript configuration.
import { publicBackend } from "../../../public-backend.js";

function GuestPage() {
  const code = new URLSearchParams(window.location.search).get("code")?.trim() ?? "";
  const invitation = new URL("/", window.location.origin);
  if (code) invitation.searchParams.set("code", code);
  const [data, setData] = useState<GuideData | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "unavailable" | "error">("loading");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!code) { setState("unavailable"); return; }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    let active = true;
    setState("loading");
    void fetch(`${publicBackend.url}/rest/v1/rpc/get_seating_guide_for_invite`, {
      method: "POST", headers: { apikey: publicBackend.key, Authorization: `Bearer ${publicBackend.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_code: code }), signal: controller.signal, cache: "no-store",
    }).then(async response => {
      if (!response.ok) throw new Error("Lookup failed");
      const guide = parseGuide(await response.json());
      if (active) { setData(guide); setState(guide ? "ready" : "unavailable"); }
    }).catch(() => { if (active) setState("error"); }).finally(() => clearTimeout(timer));
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [code, retry]);
  return <main><a className="guide-back" href={invitation.toString()}>← Back to your invitation</a>
    {state === "ready" && data ? <SeatingGuide data={data} /> : <section className="seating-guide">
      <header className="guide-heading"><p className="guide-brand">Hannah &amp; Fidel</p><h1>Your place awaits.</h1></header>
      <p role="status">{state === "loading" ? "Finding your seating details…" : state === "error" ? "We couldn’t load your seating details. Please try again." : code ? "Your seating guide isn’t available yet. Please check back closer to the celebration." : "Please open the Seating Guide from your personalized invitation link."}</p>
      {state === "error" && <button onClick={() => setRetry(v => v + 1)}>Try again</button>}
    </section>}
  </main>;
}
const preview = new URLSearchParams(window.location.search).get("preview");
const rootElement = document.getElementById("root") as HTMLElement & { guideRoot?: Root };
const root = rootElement.guideRoot ?? createRoot(rootElement); rootElement.guideRoot = root;
root.render(
  import.meta.env.DEV && (preview === "single" || preview === "split")
    ? <main><a className="guide-back" href="/">← Back to your invitation</a><p className="guide-preview-notice">Private development preview · sample names and table positions</p><SeatingGuide data={previewFixture(preview)} /></main>
    : <GuestPage />,
);
