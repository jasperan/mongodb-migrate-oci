import clsx from 'clsx'
import { Select } from '../ui/Field'

// The list endpoint takes a raw $sort object serialised as JSON.
export const SORT_OPTIONS = [
  { key: 'newest', label: 'Newest', sortOrder: { created: -1 } },
  { key: 'price-desc', label: 'Price: high to low', sortOrder: { price: -1 } },
  { key: 'price-asc', label: 'Price: low to high', sortOrder: { price: 1 } },
  { key: 'name', label: 'Name: A–Z', sortOrder: { name: 1 } }
]

export const DEFAULT_SORT = SORT_OPTIONS[0].key

export const sortOrderFor = (key) =>
  SORT_OPTIONS.find((option) => option.key === key)?.sortOrder || SORT_OPTIONS[0].sortOrder

export function SortSelect({ value = DEFAULT_SORT, onChange, className }) {
  return (
    <label className={clsx('inline-flex items-center gap-2 text-sm', className)}>
      <span className="text-ink-500">Sort</span>
      <Select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-52 py-0"
        aria-label="Sort products"
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.key} value={option.key}>
            {option.label}
          </option>
        ))}
      </Select>
    </label>
  )
}
