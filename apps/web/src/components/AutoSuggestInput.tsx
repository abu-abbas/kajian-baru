import { useState, useEffect, useRef } from 'react'
import { ChevronsUpDown, Check, Loader2 } from 'lucide-react'

type AutoSuggestInputProps = {
  value: string
  onChange: (val: string) => void
  onSearch: (query: string) => Promise<string[]>
  placeholder?: string
  icon?: React.ReactNode
  className?: string
}

export function AutoSuggestInput({
  value,
  onChange,
  onSearch,
  placeholder,
  icon,
  className,
}: AutoSuggestInputProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [filtered, setFiltered] = useState<string[]>([])
  const [activeIndex, setActiveIndex] = useState(-1)
  const [isLoading, setIsLoading] = useState(false)
  const [typedValue, setTypedValue] = useState(value)
  
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Sinkronisasi typedValue ketika value di luar berubah (misalnya di-reset)
  useEffect(() => {
    setTypedValue(value)
  }, [value])

  // 🛸 DEBOUNCE SEARCH: Hanya picu API request setelah user berhenti mengetik selama 400ms!
  useEffect(() => {
    const query = typedValue.trim()

    // Batasan Minimum 3 Karakter
    if (query.length < 3) {
      setFiltered([])
      return
    }

    // Hindari request jika typedValue persis sama dengan item yang baru saja dipilih
    const alreadySelected = filtered.some(item => item.toLowerCase() === query.toLowerCase())
    if (alreadySelected && !isOpen) return

    setIsLoading(true)
    const timer = setTimeout(async () => {
      try {
        const results = await onSearch(query)
        // Filter out item yang persis sama dengan pencarian
        const matched = results.filter(item => item.toLowerCase() !== query.toLowerCase())
        setFiltered(matched)
        if (matched.length > 0) {
          setIsOpen(true)
        }
      } catch (err) {
        console.warn('Debounce search error:', err)
      } finally {
        setIsLoading(false)
      }
    }, 400) // ⏱️ 400ms Debounce

    return () => clearTimeout(timer)
  }, [typedValue, onSearch])

  // Deteksi klik di luar untuk menutup dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' && filtered.length > 0) setIsOpen(true)
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(prev => (prev < filtered.length - 1 ? prev + 1 : prev))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(prev => (prev > 0 ? prev - 1 : -1))
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0 && activeIndex < filtered.length) {
        e.preventDefault()
        const selected = filtered[activeIndex]
        if (selected) {
          onChange(selected)
          setTypedValue(selected)
          setIsOpen(false)
        }
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false)
    }
  }

  const handleSelect = (val: string) => {
    onChange(val)
    setTypedValue(val)
    setIsOpen(false)
  }

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div className="relative flex items-center">
        {icon && (
          <div className="absolute left-3 text-muted-foreground pointer-events-none">
            {icon}
          </div>
        )}
        <input
          type="text"
          value={typedValue}
          onChange={(e) => {
            const val = e.target.value
            setTypedValue(val)
            onChange(val) // Update state form secara langsung saat diketik
            setActiveIndex(-1)
          }}
          onFocus={() => {
            if (filtered.length > 0) setIsOpen(true)
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`w-full h-10 px-3.5 ${icon ? 'pl-9' : ''} text-xs font-semibold rounded-xl border border-border bg-background/50 focus:outline-none focus:ring-1 focus:ring-primary focus:bg-background transition-all ${className || ''}`}
        />
        <div className="absolute right-2.5 flex items-center pointer-events-none">
          {isLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          ) : (
            <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground/40" />
          )}
        </div>
      </div>

      {/* 🛸 Dropdown Suggestion Floating Panel */}
      {isOpen && filtered.length > 0 && (
        <div className="absolute z-50 w-full mt-1.5 bg-card/95 border border-border/60 rounded-2xl shadow-2xl backdrop-blur-md overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
          <div className="p-1 max-h-[220px] overflow-y-auto overflow-x-hidden custom-scrollbar">
            <div className="px-2 py-1.5 text-[8px] font-black text-muted-foreground/60 tracking-wider uppercase flex justify-between items-center">
              <span>Rekomendasi Data Master</span>
              {typedValue.length >= 3 && <span className="text-[7px] font-medium normal-case">"{typedValue}"</span>}
            </div>
            {filtered.map((item, idx) => (
              <button
                key={item}
                type="button"
                onClick={() => handleSelect(item)}
                onMouseEnter={() => setActiveIndex(idx)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs font-bold rounded-xl transition-colors duration-150
                  ${activeIndex === idx 
                    ? 'bg-primary/10 text-primary' 
                    : 'text-foreground hover:bg-secondary/50'
                  }
                `}
              >
                <Check className={`h-3.5 w-3.5 shrink-0 text-primary transition-opacity ${value.toLowerCase() === item.toLowerCase() ? 'opacity-100' : 'opacity-0'}`} />
                <span className="truncate">{item}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
