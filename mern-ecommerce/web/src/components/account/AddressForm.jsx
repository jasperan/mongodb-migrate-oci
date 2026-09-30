import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '../ui/Button'
import { Checkbox, Field, Input } from '../ui/Field'

const EMPTY = { address: '', city: '', state: '', country: '', zipCode: '', isDefault: false }

/**
 * Add/edit form shared by POST /address/add and PUT /address/:id. The API
 * spreads the request body straight into the Address document and only the
 * legacy form validated it, so the checks live here.
 */
export function AddressForm({
  initialValue,
  onSubmit,
  submitLabel = 'Save address',
  submitting = false,
  onCancel,
  onDelete,
  deleting = false
}) {
  const [value, setValue] = useState(() => ({ ...EMPTY, ...initialValue }))
  const [errors, setErrors] = useState({})

  const change = (name) => (event) => {
    const target = event.target
    const next = target.type === 'checkbox' ? target.checked : target.value
    setValue((previous) => ({ ...previous, [name]: next }))
    setErrors((previous) => ({ ...previous, [name]: undefined }))
  }

  const submit = (event) => {
    event.preventDefault()
    const next = {}
    if (!value.address.trim()) next.address = 'Street address is required.'
    if (!value.city.trim()) next.city = 'City is required.'
    if (!value.state.trim()) next.state = 'State is required.'
    if (!value.country.trim()) next.country = 'Country is required.'
    if (!value.zipCode.trim()) next.zipCode = 'Zip code is required.'
    else if (value.zipCode.trim().length < 5) next.zipCode = 'Zip code must be at least 5 characters.'
    setErrors(next)
    if (Object.keys(next).length) return

    onSubmit({
      address: value.address.trim(),
      city: value.city.trim(),
      state: value.state.trim(),
      country: value.country.trim(),
      zipCode: value.zipCode.trim(),
      isDefault: Boolean(value.isDefault)
    })
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Field label="Address" error={errors.address} required>
        <Input
          value={value.address}
          onChange={change('address')}
          placeholder="Street, house / apartment number"
          invalid={Boolean(errors.address)}
        />
      </Field>

      <Field label="City" error={errors.city} required>
        <Input value={value.city} onChange={change('city')} placeholder="City" invalid={Boolean(errors.city)} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="State" error={errors.state} required>
          <Input value={value.state} onChange={change('state')} placeholder="State" invalid={Boolean(errors.state)} />
        </Field>
        <Field label="Country" error={errors.country} required>
          <Input
            value={value.country}
            onChange={change('country')}
            placeholder="Country"
            invalid={Boolean(errors.country)}
          />
        </Field>
      </div>

      <Field label="Zip code" error={errors.zipCode} required>
        <Input
          value={value.zipCode}
          onChange={change('zipCode')}
          placeholder="Zip code"
          inputMode="numeric"
          invalid={Boolean(errors.zipCode)}
        />
      </Field>

      <Checkbox label="Use as my default delivery address" checked={value.isDefault} onChange={change('isDefault')} />

      <div className="flex flex-wrap items-center gap-3 border-t border-ink-200 pt-4">
        <Button type="submit" loading={submitting}>
          {submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
        )}
        {onDelete && (
          <Button
            type="button"
            variant="danger"
            className="ml-auto"
            onClick={onDelete}
            loading={deleting}
            disabled={submitting}
          >
            <Trash2 size={15} /> Delete
          </Button>
        )}
      </div>
    </form>
  )
}
