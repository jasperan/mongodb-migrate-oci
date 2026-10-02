import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { RotateCcw, Star } from 'lucide-react'
import { Field, Input, Select } from '../ui/Field'
import { Button } from '../ui/Button'
import { plural } from '../../lib/format'

// Price bounds are optional: an empty field means "no limit" on that side, so the
// URL only carries what the shopper actually chose.
const PRICE_PRESETS = [
  { label: 'Under $25', max: 25 },
  { label: '$25 – $50', min: 25, max: 50 },
  { label: '$50 – $100', min: 50, max: 100 },
  { label: '$100 – $250', min: 100, max: 250 },
  { label: '$250+', min: 250 }
]

const RATING_OPTIONS = [
  { value: 0, label: 'Any' },
  { value: 1, label: '1★+' },
  { value: 2, label: '2★+' },
  { value: 3, label: '3★+' },
  { value: 4, label: '4★+' },
  { value: 5, label: '5★' }
]

// Two categories can share a name (the demo data has two "Toys"); the option text
// says how they differ so the shopper can tell them apart.
export function categoryLabels(categories = []) {
  const byName = new Map()
  categories.forEach((category) => {
    const key = String(category.name).toLowerCase()
    byName.set(key, [...(byName.get(key) || []), category])
  })

  const labels = new Map()
  byName.forEach((group) => {
    if (group.length === 1) {
      labels.set(group[0].slug, group[0].name)
      return
    }
    const seen = new Map()
    group.forEach((category) => {
      const base = `${category.name} (${plural(category.products?.length ?? 0, 'product')})`
      const repeats = seen.get(base) || 0
      seen.set(base, repeats + 1)
      labels.set(category.slug, repeats ? `${base} #${repeats + 1}` : base)
    })
  })
  return labels
}

const sameBound = (a, b) => (a ?? null) === (b ?? null)

function FilterBlock({ title, children }) {
  return (
    <section className="border-t border-ink-100 px-5 py-4 first:border-t-0">
      <h3 className="eyebrow mb-3">{title}</h3>
      {children}
    </section>
  )
}

// Draft strings are committed on blur / Enter only, so typing "250" is one request, not three.
function PriceInputs({ min, max, onCommit }) {
  const [draft, setDraft] = useState({ min: min ?? '', max: max ?? '' })

  useEffect(() => {
    setDraft({ min: min ?? '', max: max ?? '' })
  }, [min, max])

  const parse = (text) => {
    const trimmed = String(text).trim()
    if (trimmed === '') return undefined
    const value = Number(trimmed)
    return Number.isFinite(value) && value >= 0 ? Math.round(value) : null
  }

  const commit = () => {
    let nextMin = parse(draft.min)
    let nextMax = parse(draft.max)
    // An unreadable entry falls back to what is applied now.
    if (nextMin === null) nextMin = min
    if (nextMax === null) nextMax = max
    if (nextMin !== undefined && nextMax !== undefined && nextMin > nextMax) [nextMin, nextMax] = [nextMax, nextMin]
    setDraft({ min: nextMin ?? '', max: nextMax ?? '' })
    if (!sameBound(nextMin, min) || !sameBound(nextMax, max)) onCommit(nextMin, nextMax)
  }

  const handlers = (field) => ({
    value: draft[field],
    onChange: (event) => setDraft((current) => ({ ...current, [field]: event.target.value })),
    onBlur: commit,
    onKeyDown: (event) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        commit()
      }
    }
  })

  return (
    <div className="flex items-end gap-2">
      <Field label="Min" className="flex-1">
        <Input type="number" inputMode="numeric" min={0} placeholder="0" {...handlers('min')} />
      </Field>
      <span className="pb-3 text-ink-400">–</span>
      <Field label="Max" className="flex-1">
        <Input type="number" inputMode="numeric" min={0} placeholder="Any" {...handlers('max')} />
      </Field>
    </div>
  )
}

export function Filters({
  min,
  max,
  rating = 0,
  category = '',
  brand = '',
  categories = [],
  brands = [],
  onPriceChange,
  onRatingChange,
  onCategoryChange,
  onBrandChange,
  onReset,
  bare = false,
  className
}) {
  const activePreset = PRICE_PRESETS.find((preset) => sameBound(preset.min, min) && sameBound(preset.max, max))
  const labels = categoryLabels(categories)

  return (
    <aside className={clsx(!bare && 'card-surface overflow-hidden', className)}>
      {!bare && (
        <header className="flex items-center justify-between px-5 py-4">
          <h2 className="font-display text-base">Filters</h2>
          <Button variant="ghost" size="sm" onClick={onReset} className="gap-1.5 text-xs">
            <RotateCcw size={13} /> Reset
          </Button>
        </header>
      )}

      <FilterBlock title="Category">
        <Select value={category} onChange={(event) => onCategoryChange(event.target.value)} aria-label="Category">
          <option value="">All categories</option>
          {categories.map((item) => (
            <option key={item._id || item.slug} value={item.slug}>
              {labels.get(item.slug)}
            </option>
          ))}
        </Select>
      </FilterBlock>

      <FilterBlock title="Brand">
        <Select value={brand} onChange={(event) => onBrandChange(event.target.value)} aria-label="Brand">
          <option value="">All brands</option>
          {brands.map((item) => (
            <option key={item._id || item.slug} value={item.slug}>
              {item.name}
            </option>
          ))}
        </Select>
      </FilterBlock>

      <FilterBlock title="Price range">
        <PriceInputs min={min} max={max} onCommit={onPriceChange} />
        <div className="mt-3 flex flex-wrap gap-1.5">
          {PRICE_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => onPriceChange(preset.min, preset.max)}
              aria-pressed={activePreset?.label === preset.label}
              className={clsx(
                'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                activePreset?.label === preset.label
                  ? 'border-brand-300 bg-brand-50 text-brand-700'
                  : 'border-ink-200 text-ink-600 hover:border-ink-300 hover:bg-ink-50'
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </FilterBlock>

      <FilterBlock title="Customer rating">
        <div className="flex flex-wrap gap-1.5">
          {RATING_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onRatingChange(option.value)}
              aria-pressed={Number(rating) === option.value}
              className={clsx(
                'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                Number(rating) === option.value
                  ? 'border-brand-300 bg-brand-50 text-brand-700'
                  : 'border-ink-200 text-ink-600 hover:border-ink-300 hover:bg-ink-50'
              )}
            >
              {option.value > 0 && <Star size={11} className="fill-amber-400 text-amber-400" />}
              {option.label}
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-ink-500">
          Ratings come from approved customer reviews; products without reviews only show under “Any”.
        </p>
      </FilterBlock>
    </aside>
  )
}
