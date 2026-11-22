/** Indicateur de chargement discret (n'apparaît qu'après 160 ms via .delayed-in si `delayed`) */
export function Spinner({ size = 16, delayed = false, className = '' }: { size?: number; delayed?: boolean; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" role="status" aria-label="Chargement" className={`spinner ${delayed ? 'delayed-in' : ''} ${className}`}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".22" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}
