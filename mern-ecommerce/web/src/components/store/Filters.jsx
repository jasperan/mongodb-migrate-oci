import clsx from 'clsx'
import { RotateCcw, Star } from 'lucide-react'
import { Field, Input, Select } from '../ui/Field'
import { Button } from '../ui/Button'

// The list aggregation only applies the price window when BOTH bounds are
// truthy, so the lower bound never drops below 1.
export const PRICE_BOUNDS = { min: 1, max: 5000 }
export const DEFAULT_PRICE = { min: 1, max: 5000 }

export const PRICE_PRESETS = [
  { label: 'Under $25', min: 1, max: 25 },
  { label: '$25 – $50', min: 25, max: 50 },
  { label: '$50 – $100', min: 50, max: 100 },
  { label: '$100 – $250', min: 100, max: 250 },
  { label: '$250+', min: 250, max: PRICE_BOUNDS.max }
]

export const RATING_OPTIONS = [
  { value: 0, label: 'Any' },
  { value: 1, label: '1★+' },
  { value: 2, label: '2★+' },
  { value: 3, label: '3★+' },
  { value: 4, label: '4★+' },
  { value: 5, label: '5★' }
]

const clampPrice = (value, fallback) => {
  const parsed = Number(value)
  if (Number.isNaN(parsed)) return fallback
  return Math.min(Math.max(Math.round(parsed), PRICE_BOUNDS.min), PRICE_BOUNDS.max)
}

function FilterBlock({ title, children }) {
  return (
    <section className="border-t border-ink-100 px-5 py-4 first:border-t-0">
      <h3 className="eyebrow mb-3">{title}</h3>
      {children}
    </section>
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
  className
}) {
  const activePreset = PRICE_PRESETS.find((preset) => preset.min === Number(min) && preset.max === Number(max))

  return (
    <aside className={clsx('card-surface overflow-hidden', className)}>
      <header className="flex items-center justify-between px-5 py-4">
        <h2 className="font-display text-base">Filters</h2>
        <Button variant="ghost" size="sm" onClick={onReset} className="gap-1.5 text-xs">
          <RotateCcw size={13} /> Reset
        </Button>
      </header>

      <FilterBlock title="Category">
        <Select value={category} onChange={(event) => onCategoryChange(event.target.value)} aria-label="Category">
          <option value="">All categories</option>
          {categories.map((item) => (
            <option key={item._id || item.slug} value={item.slug}>
              {item.name}
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
        <div className="flex items-end gap-2">
          <Field label="Min" className="flex-1">
            <Input
              type="number"
              inputMode="numeric"
              min={PRICE_BOUNDS.min}
              max={Number(max) || PRICE_BOUNDS.max}
              value={min}
              onChange={(event) => onPriceChange(clampPrice(event.target.value, min), Number(max) || PRICE_BOUNDS.max)}
            />
          </Field>
          <span className="pb-3 text-ink-400">–</span>
          <Field label="Max" className="flex-1">
            <Input
              type="number"
              inputMode="numeric"
              min={Number(min) || PRICE_BOUNDS.min}
              max={PRICE_BOUNDS.max}
              value={max}
              onChange={(event) => onPriceChange(Number(min) || PRICE_BOUNDS.min, clampPrice(event.target.value, max))}
            />
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {PRICE_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => onPriceChange(preset.min, preset.max)}
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
          Ratings come from approved customer reviews; products with no approved reviews are only
          visible under “Any”.
        </p>
      </FilterBlock>
    </aside>
  )
}
