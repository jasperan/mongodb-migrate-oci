import { createContext, useContext, useId } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '../../lib/cn'

const fieldBase =
  'w-full rounded-xl border border-ink-300 bg-white px-3.5 py-2.5 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500 disabled:bg-ink-100'

const INVALID = 'border-brand-500 focus:border-brand-600'

// Field publishes the ids of its hint/error text so the control inside can point
// at them with aria-describedby without every call site wiring it by hand.
const FieldContext = createContext(null)

export function Field({ label, hint, error, required, className, children }) {
  const id = useId()
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined

  return (
    <FieldContext.Provider value={{ describedBy, invalid: Boolean(error), required }}>
      <div className={cn('block', className)}>
        <label className="block">
          {label && (
            <span className="mb-1.5 flex items-center gap-1 text-xs font-semibold tracking-wide text-ink-600 uppercase">
              {label}
              {required && (
                <span className="text-brand-600" aria-hidden>
                  *
                </span>
              )}
            </span>
          )}
          {children}
        </label>
        {hint && !error && (
          <span id={`${id}-hint`} className="mt-1 block text-xs text-ink-500">
            {hint}
          </span>
        )}
        {error && (
          <span id={`${id}-error`} role="alert" className="mt-1 block text-xs font-medium text-brand-700">
            {error}
          </span>
        )}
      </div>
    </FieldContext.Provider>
  )
}

// Explicit props win over the surrounding Field, so standalone inputs still work.
function useControlProps({ invalid, required, 'aria-describedby': describedBy }) {
  const field = useContext(FieldContext)
  const isInvalid = invalid ?? field?.invalid ?? false
  return {
    invalid: isInvalid,
    'aria-invalid': isInvalid || undefined,
    'aria-describedby': describedBy ?? field?.describedBy,
    'aria-required': (required ?? field?.required) || undefined
  }
}

export function Input({ className, invalid, ...props }) {
  const control = useControlProps({ invalid, ...props })
  return (
    <input
      {...props}
      aria-invalid={control['aria-invalid']}
      aria-describedby={control['aria-describedby']}
      aria-required={control['aria-required']}
      className={cn(fieldBase, control.invalid && INVALID, className)}
    />
  )
}

export function Textarea({ className, rows = 4, invalid, ...props }) {
  const control = useControlProps({ invalid, ...props })
  return (
    <textarea
      rows={rows}
      {...props}
      aria-invalid={control['aria-invalid']}
      aria-describedby={control['aria-describedby']}
      aria-required={control['aria-required']}
      className={cn(fieldBase, 'resize-y', control.invalid && INVALID, className)}
    />
  )
}

export function Select({ className, children, invalid, ...props }) {
  const control = useControlProps({ invalid, ...props })
  return (
    <span className="relative block">
      <select
        {...props}
        aria-invalid={control['aria-invalid']}
        aria-describedby={control['aria-describedby']}
        aria-required={control['aria-required']}
        className={cn(fieldBase, 'appearance-none pr-9', control.invalid && INVALID, className)}
      >
        {children}
      </select>
      <ChevronDown
        size={16}
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-ink-500"
      />
    </span>
  )
}

export function Checkbox({ label, className, ...props }) {
  return (
    <label className={cn('inline-flex cursor-pointer items-center gap-2 text-sm text-ink-700', className)}>
      <input
        type="checkbox"
        className="size-4 rounded border-ink-300 text-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        {...props}
      />
      {label}
    </label>
  )
}
