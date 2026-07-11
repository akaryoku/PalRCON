export function Logo() {
  return (
    <div className="logo" aria-label="PalRCON">
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
        <path d="M5 4h12l6 6v14H5z" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M10 10h8M10 14h8M10 18h5" stroke="currentColor" strokeWidth="2" />
        <path d="M17 4v6h6" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
      <span>Pal<strong>RCON</strong></span>
    </div>
  );
}
