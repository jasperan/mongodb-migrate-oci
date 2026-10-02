import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { Search, X } from 'lucide-react'
import { Spinner } from '../ui/Display'
import { useDebouncedValue } from './helpers'

// Server-side search box: local typing state, 350 ms debounce, and the legacy
// >= 2 character gate (the search endpoints regex whatever they are given).
export function SearchInput({
  onChange,
  placeholder = 'Search…',
  minLength = 2,
  delay = 350,
  pending = false,
  className,
  autoFocus = false
}) {
  const [value, setValue] = useState('')
  const debounced = useDebouncedValue(value, delay)
  const emitted = useRef('')

  useEffect(() => {
    const term = debounced.trim()
    if (term === emitted.current) return
    if (term.length === 0 || term.length >= minLength) {
      emitted.current = term
      onChange(term)
    }
  }, [debounced, minLength, onChange])

  return (
    <div className={clsx('relative w-full sm:max-w-xs', className)}>
      <Search size={16} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-400" />
      <input
        type="search"
        value={value}
        autoFocus={autoFocus}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-11 w-full rounded-full border border-ink-300 bg-white pr-10 pl-10 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none"
      />
      <span className="absolute top-1/2 right-3 -translate-y-1/2">
        {pending ? (
          <Spinner className="size-4" />
        ) : (
          value && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setValue('')}
              className="grid size-6 place-items-center rounded-full text-ink-400 hover:bg-ink-100 hover:text-ink-700"
            >
              <X size={14} />
            </button>
          )
        )}
      </span>
    </div>
  )
}

// Same control, but the filtering happens in the browser over an already-loaded list.
export function FilterInput({ value, onChange, placeholder = 'Filter…', className }) {
  return (
    <div className={clsx('relative w-full sm:max-w-xs', className)}>
      <Search size={16} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-400" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-11 w-full rounded-full border border-ink-300 bg-white pr-10 pl-10 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none"
      />
      {value && (
        <button
          type="button"
          aria-label="Clear filter"
          onClick={() => onChange('')}
          className="absolute top-1/2 right-3 grid size-6 -translate-y-1/2 place-items-center rounded-full text-ink-400 hover:bg-ink-100 hover:text-ink-700"
        >
          <X size={14} />
        </button>
      )}
    </div>
  )
}

export function Toolbar({ children, className }) {
  return <div className={clsx('flex flex-wrap items-center gap-3', className)}>{children}</div>
}

export function ResultMeta({ count, label, className }) {
  return (
    <p className={clsx('text-sm text-ink-500', className)}>
      <span className="font-display text-base font-semibold text-ink-900">{count}</span> {label}
    </p>
  )
}

// Segmented filter: a group of toggle buttons (no tabpanel is involved, so the
// tabs pattern would promise keyboard behaviour that does not exist).
export function SegmentedTabs({ value, onChange, options, label, className }) {
  return (
    <div
      role="group"
      aria-label={label}
      className={clsx('inline-flex items-center gap-1 rounded-full border border-ink-200 bg-white p-1', className)}
    >
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={clsx(
              'inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
              selected ? 'bg-ink-900 text-white' : 'text-ink-600 hover:bg-ink-100'
            )}
          >
            {option.label}
            {option.count !== undefined && (
              <span
                className={clsx(
                  'rounded-full px-1.5 py-0.5 text-[0.6875rem] font-semibold',
                  selected ? 'bg-white/20 text-white' : 'bg-ink-100 text-ink-600'
                )}
              >
                {option.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
