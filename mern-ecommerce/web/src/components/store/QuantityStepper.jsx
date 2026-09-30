import clsx from 'clsx'
import { Minus, Plus } from 'lucide-react'

const SIZES = {
  sm: { button: 'size-7', icon: 13, value: 'w-8 text-sm' },
  md: { button: 'size-9', icon: 15, value: 'w-10 text-sm' }
}

export function QuantityStepper({ value = 1, onChange, min = 1, max = 99, size = 'md', disabled = false, className }) {
  const clamp = (next) => Math.min(Math.max(next, min), Math.max(min, max))
  const dimensions = SIZES[size] || SIZES.md

  return (
    <div
      className={clsx(
        'inline-flex items-center rounded-full border border-ink-200 bg-white',
        disabled && 'opacity-50',
        className
      )}
    >
      <button
        type="button"
        className={clsx('grid place-items-center rounded-full text-ink-600 disabled:opacity-40', dimensions.button)}
        onClick={() => onChange(clamp(value - 1))}
        disabled={disabled || value <= min}
        aria-label="Decrease quantity"
      >
        <Minus size={dimensions.icon} />
      </button>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        disabled={disabled}
        onChange={(event) => onChange(clamp(Number(event.target.value) || min))}
        aria-label="Quantity"
        className={clsx(
          'border-0 bg-transparent p-0 text-center font-medium text-ink-900 focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none',
          dimensions.value
        )}
      />
      <button
        type="button"
        className={clsx('grid place-items-center rounded-full text-ink-600 disabled:opacity-40', dimensions.button)}
        onClick={() => onChange(clamp(value + 1))}
        disabled={disabled || value >= max}
        aria-label="Increase quantity"
      >
        <Plus size={dimensions.icon} />
      </button>
    </div>
  )
}
