import { useRef } from 'react'
import { Folder, FolderOpen } from 'lucide-react'

export function FolderButton({ onOpen, label = true }: { onOpen: (rect: DOMRect) => void; label?: boolean }) {
  const ref = useRef<HTMLButtonElement>(null)
  return (
    <button ref={ref} onClick={() => onOpen(ref.current!.getBoundingClientRect())} className="folder-btn group" aria-label="Ouvrir la bibliothèque de cours" title="Bibliothèque (L)">
      <span className="relative grid h-5 w-5 place-items-center">
        <Folder size={20} className="absolute transition-all duration-300 group-hover:scale-75 group-hover:opacity-0" />
        <FolderOpen size={20} className="absolute scale-75 opacity-0 transition-all duration-300 group-hover:scale-100 group-hover:opacity-100" />
      </span>
      {label && <span className="hidden sm:inline">Bibliothèque</span>}
      {label && <kbd className="hidden md:inline">L</kbd>}
    </button>
  )
}
