import { useEffect, useId, useRef } from "react";

export function GuideHelp({ open, onClose, chairsApproved, unavailable }: {
  open: boolean; onClose: () => void; chairsApproved: boolean; unavailable: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
    else if (!open && dialog.current?.open) dialog.current.close();
  }, [open]);

  return <dialog className="guide-help" ref={dialog} aria-labelledby={titleId}
    onClose={onClose} onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => {
      if (event.target !== event.currentTarget) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
    }}>
    <header><h2 id={titleId}>Explore the seating guide</h2>
      <button className="guide-help-close" aria-label="Close seating guide help" onClick={onClose}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" /></svg>
      </button>
    </header>
    <dl>
      <div><dt>Find your place</dt><dd>Choose your name, then select <strong>Show my seat</strong>. Your place is outlined in gold.</dd></div>
      {!unavailable && <div><dt>Look around</dt><dd>Drag to rotate the venue. Pinch or scroll to zoom.</dd></div>}
      <div><dt>See who’s nearby</dt><dd>Tap a table to see its guests, or choose <strong>Explore tables</strong> in Views. {chairsApproved ? "Zoom in and tap a chair for its guest’s name. On a computer, you can also hover over a chair." : "Individual chair locations will appear once their positions are confirmed."}</dd></div>
      <div><dt>Change your view</dt><dd>Open <strong>Views</strong> at the top-right for the overhead plan{unavailable ? "." : ", landmarks and lighting."} {unavailable && "The overhead view is available on this device."}</dd></div>
    </dl>
    <p className="guide-help-note">Venue preview · positions are approximate.</p>
    <button className="guide-help-done" onClick={onClose}>Got it</button>
  </dialog>;
}
