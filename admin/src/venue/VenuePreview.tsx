import type { SeatingWorkspace } from "../domain/types";
import { defaultVenueLayout } from "./layout";
import { LayoutEditor } from "./LayoutEditor";
import { TableFurniture } from "./TableFurniture";
import { ceremonyChairCount, ceremonyLayout } from "./ceremonyLayout";
import type { useVenueLayout } from "./useVenueLayout";
import { useCallback, useEffect, useMemo, useState } from "react";
import { VenueCanvas, VenuePlan } from "./VenueCanvas";
import { defaultParameters, ledLayout, normalizeParameters, parameterDefinitions, parameterKeys, stageLayout, viewPresets, type ParameterKey, type ViewPreset } from "./venueModel";
import "./venue.css";

export default function VenuePreview({ workspace, disabled, history }: { workspace: SeatingWorkspace; disabled: boolean; history: ReturnType<typeof useVenueLayout> }) {
  const layout = useMemo(() => workspace.draft.venueLayout ?? defaultVenueLayout(), [workspace.draft.venueLayout]);
  const [setup, setSetup] = useState(layout);
  const [editing, setEditing] = useState(false);
  const parameters = layout.parameters, led = setup.led;
  const chairCount = ceremonyChairCount(workspace.draft);
  const ceremony = ceremonyLayout(parameters, chairCount);
  useEffect(() => { setSetup(layout); }, [workspace.draft.venueLayout]);
  const [preset, setPreset] = useState<ViewPreset>("overview");
  const [resetKey, setResetKey] = useState(0);
  const [labels, setLabels] = useState(true);
  const [dusk, setDusk] = useState(false);
  const [plan, setPlan] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [dimensions, setDimensions] = useState(false);
  const [status, setStatus] = useState("Shared draft · publish with seating assignments");
  const handleUnavailable = useCallback(() => { setUnavailable(true); setPlan(true); }, []);
  const setView = (next: ViewPreset) => { setPreset(next); setResetKey(key => key + 1); if (!unavailable) setPlan(false); };
  const updateParameter = (key: ParameterKey, value: number) => {
    setSetup(current => ({ ...current, parameters: normalizeParameters({ ...current.parameters, [key]: value }) }));
    setStatus("Venue setup has unsaved adjustments");
  };
  async function save() {
    if (disabled) return;
    const ok = await history.save({ ...setup, tables: layout.tables });
    setStatus(ok ? "Venue setup saved to shared draft · not published" : "Venue setup could not be saved. Review the message above.");
  }
  return <section className="venue-preview" aria-labelledby="venue-title">
    <div className="page-heading venue-heading">
      <div><p className="eyebrow">The setting for our celebration</p><h1 id="venue-title">A place by the water.</h1><p className="venue-subtitle">Plaza Beach · Shangri-La Qaryat Al Beri</p></div>
      <span className="venue-private-badge"><i />Private venue preview</span>
    </div>
    <div className="venue-workspace">
      <div className="layout-toolbar"><p>Table positions and dimensions are shared drafts. Existing seats and assignments are preserved.</p><button className="primary-button" aria-pressed={editing} disabled={disabled} onClick={() => setEditing(v => !v)}>{editing ? "Close table editor" : "Edit table layout"}</button></div>
      {disabled && <p className="venue-notice">Layout editing requires a desktop or laptop with an online connection. The preview remains available.</p>}
      {editing && <LayoutEditor snapshot={workspace.draft} layout={layout} disabled={disabled} {...history} />}

      <div className="venue-scene-card">
        <div className="venue-led-options" role="group" aria-label="LED screen layout">
          <span>5 × 3 m LED screen</span>
          <button aria-pressed={led === "center"} onClick={() => { setSetup(current => ({ ...current, led: "center" })); setStatus("Center LED preview selected · save venue setup to keep"); }} disabled={disabled}>Center LED</button>
          <button aria-pressed={led === "side"} onClick={() => { setSetup(current => ({ ...current, led: "side" })); setStatus("Side LED preview selected · save venue setup to keep"); }} disabled={disabled}>Side LED</button>
        </div>
        {led === "center" && <p className="venue-led-note">Floral surround: {ledLayout(parameters, led).width} m wide · {ledLayout(parameters, led).height} m high above the platform.</p>}
        {led === "side" && <p className="venue-led-note">Pavilion side · angled 30° toward reception seating · stage faces inland from the beach edge.</p>}
        <p className="venue-led-note">Ceremony: {chairCount} {chairCount === 1 ? "chair" : "chairs"} · accepted RSVPs, excluding guests needing no separate seat · no assigned seats.</p>
        {!ceremony.fits && <p className="venue-notice" role="status">The {chairCount} ceremony chairs extend beyond the estimated plaza seating space. Adjust the plaza dimensions to review their fit.</p>}
        {!ledLayout(parameters, led).fits && <p className="venue-notice" role="status">This arrangement needs a deeper lawn to keep the stage and dance floor inside its edges. Increase lawn depth before using this layout.</p>}
        <div className="venue-viewbar" role="group" aria-label="Venue viewpoints">
          {viewPresets.map(view => <button key={view.id} aria-pressed={!plan && preset === view.id} disabled={unavailable} onClick={() => setView(view.id)}>{view.label}</button>)}
          <button aria-pressed={plan} onClick={() => setPlan(current => unavailable || !current)}>2D plan</button>
        </div>
        <div className={`venue-stage${dusk && !plan ? " is-dusk" : ""}`}>
          {plan ? <VenuePlan parameters={parameters} led={led} landmarks={layout.landmarks} ceremonyChairs={chairCount}><TableFurniture snapshot={workspace.draft} layout={layout} /></VenuePlan> : <VenueCanvas parameters={parameters} led={led} preset={preset} resetKey={resetKey} labels={labels} dusk={dusk} snapshot={workspace.draft} layout={layout} onUnavailable={handleUnavailable} />}
          <div className="venue-scene-caption"><span>HANNAH &amp; FIDEL</span><strong>Where it all comes together.</strong></div>
          <div className="venue-approximate">Approximate venue · dimensions unverified</div>
          {!plan && <button className="venue-light-toggle" aria-pressed={dusk} onClick={() => setDusk(current => !current)}>{dusk ? "Dusk · switch to daylight" : "Daylight · preview dusk"}</button>}
          {!plan && <button className="venue-label-toggle" aria-pressed={labels} onClick={() => setLabels(current => !current)}>{labels ? "Hide labels" : "Show labels"}</button>}
        </div>
        <div className="venue-scene-footer"><span>{plan ? "Overhead orientation · same venue dimensions" : "Drag or swipe to orbit 360° · scroll or pinch to zoom · two fingers to pan"}</span><button onClick={() => { if (unavailable) setPlan(true); else setView("overview"); }}>Reset view ↗</button></div>
      </div>
      {unavailable && <p className="venue-notice" role="status">3D is unavailable on this device. The overhead plan remains available.</p>}
      <div className="venue-bottom-row">
        <div className="venue-story"><p className="eyebrow">From arrival to celebration</p><div><span>01</span><p><strong>The approach</strong><small>The resort walkway towards the ceremony.</small></p><i>→</i><span>02</span><p><strong>The reception lawn</strong><small>An open gathering beside the waterfront.</small></p></div></div>
        <button className={`secondary-button venue-dimensions-button${dimensions ? " is-active" : ""}`} aria-expanded={dimensions} aria-controls="venue-dimensions" disabled={disabled} onClick={() => { setDimensions(current => !current); }}>{dimensions ? "Close dimensions" : "Adjust dimensions"}<span aria-hidden="true">{dimensions ? "−" : "+"}</span></button>
      </div>
      {dimensions && <section id="venue-dimensions" className="venue-dimensions" aria-label="Approximate venue dimensions">
        <div className="panel-heading"><div><p className="eyebrow">Shape the preview</p><h2>Room to refine.</h2><p>These dimensions are approximate. Setup changes are saved to the shared draft and published with seating assignments. Table positions and sizes stay fixed when the room changes.</p></div><button className="text-button" disabled={disabled} onClick={() => { setSetup({ ...setup, parameters: { ...defaultParameters } }); setStatus("Default estimates restored · save to keep"); }}>Restore estimates</button></div>
        <div className="venue-parameter-groups">
          {[...new Set(parameterKeys.map(key => parameterDefinitions[key].group))].map(group => <fieldset key={group}><legend>{group}</legend>{parameterKeys.filter(key => parameterDefinitions[key].group === group).map(key => {
            const d = parameterDefinitions[key];
            return <label className="venue-parameter" key={key}><span>{d.label}<output>{setup.parameters[key]}{d.unit && ` ${d.unit}`}</output></span><input aria-label={d.label} type="range" min={d.min} max={d.max} step={d.step} value={setup.parameters[key]} disabled={disabled} onChange={event => updateParameter(key, Number(event.target.value))} /></label>;
          })}</fieldset>)}
        </div>
        <div className="layout-landmarks"><h3>Landmark positions</h3><button className="text-button" disabled={disabled} onClick={() => {
          const stage = stageLayout(setup.parameters);
          setSetup({ ...setup, landmarks: { ...setup.landmarks, stage: { x: stage.centerX, y: stage.centerY }, danceFloor: { x: stage.danceX, y: stage.danceY } } });
          setStatus("Stage and dance floor centered at the beach edge · save to keep");
        }}>Center stage at beach edge</button><p className="helper-text">Stage and dance floor move in setup only. The entrance marker identifies the approach; venue structures remain fixed.</p>
          {(["stage", "danceFloor", "entrance"] as const).map(key => <fieldset key={key}><legend>{{ stage: "Stage", danceFloor: "Dance floor", entrance: "Entrance marker" }[key]}</legend>{(["x", "y"] as const).map(axis => <label key={axis}>{axis.toUpperCase()} (m)<input aria-label={`${key} ${axis} position`} type="number" min="-200" max="200" step=".1" disabled={disabled} value={setup.landmarks[key][axis]} onChange={e => { const value = e.target.valueAsNumber; if (Number.isFinite(value)) setSetup({ ...setup, landmarks: { ...setup.landmarks, [key]: { ...setup.landmarks[key], [axis]: value } } }); }} /></label>)}</fieldset>)}
          <label>LED arrangement<select aria-label="Saved LED arrangement" value={setup.led} disabled={disabled} onChange={e => setSetup({ ...setup, led: e.target.value === "side" ? "side" : "center" })}><option value="center">Center LED</option><option value="side">Side LED</option></select></label>
        </div>
        <div className="venue-save-row"><p>Save estimates to the shared draft. Review table boundaries before publishing.</p><button className="primary-button" disabled={disabled} onClick={() => void save()}>Save venue setup</button></div>
      </section>}
      <p className="venue-preview-status" role="status">{status}</p>
    </div>
  </section>;
}
