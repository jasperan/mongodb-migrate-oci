import { useEffect, useMemo, useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { Link } from 'react-router-dom'
import { Store, Pencil, Plus, Trash2 } from 'lucide-react'
import { Badge } from '../../components/ui/Display'
import { Button, IconButton } from '../../components/ui/Button'
import { Checkbox, Field, Input, Textarea } from '../../components/ui/Field'
import {
  ActiveToggle,
  ConfirmDialog,
  FilterInput,
  FormModal,
  FormRow,
  PageHeader,
  ResultMeta,
  TableFooter,
  TableLoading,
  TableMessage,
  TableShell,
  Td,
  Th,
  Toolbar,
  matches,
  useClientPage
} from '../../components/manager'
import {
  useAddBrandMutation,
  useDeleteBrandMutation,
  useManagerBrandsQuery,
  useSetBrandActiveMutation,
  useUpdateBrandMutation
} from '../../features/manager/managerApi'
import { selectRole } from '../../features/auth/authSlice'
import { toastShown } from '../../features/ui/uiSlice'
import { apiErrorMessage } from '../../lib/apiError'
import { shortDate } from '../../lib/format'

const PER_PAGE = 12
const DESCRIPTION_LIMIT = 200

const emptyForm = { name: '', slug: '', description: '', isActive: true }

function BrandFormModal({ open, brand, onClose }) {
  const dispatch = useDispatch()
  const isEdit = Boolean(brand)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const [addBrand, addState] = useAddBrandMutation()
  const [updateBrand, updateState] = useUpdateBrandMutation()
  const [setBrandActive, activeState] = useSetBrandActiveMutation()

  useEffect(() => {
    if (!open) return
    setError('')
    setForm(
      brand
        ? {
            name: brand.name || '',
            slug: brand.slug || '',
            description: brand.description || '',
            isActive: brand.isActive !== false
          }
        : emptyForm
    )
  }, [open, brand])

  const set = (key) => (value) => setForm((prev) => ({ ...prev, [key]: value }))

  const submit = async () => {
    if (!form.name.trim()) return setError('Name is required.')
    if (!form.description.trim()) return setError('Description is required.')
    if (form.description.length > DESCRIPTION_LIMIT) {
      return setError(`Description must be ${DESCRIPTION_LIMIT} characters or fewer.`)
    }
    if (isEdit && !form.slug.trim()) return setError('Slug is required.')
    setError('')

    const fields = { name: form.name.trim(), description: form.description.trim() }
    try {
      if (isEdit) {
        // `/active` is the route that cascades to the brand's products, so a flip
        // of the switch is sent there instead of inside the verbatim update body.
        if (form.isActive !== (brand.isActive !== false)) {
          await setBrandActive({ id: brand._id, isActive: form.isActive }).unwrap()
        }
        await updateBrand({ id: brand._id, brand: { ...fields, slug: form.slug.trim() } }).unwrap()
        dispatch(toastShown({ type: 'success', message: `${fields.name} updated` }))
      } else {
        await addBrand({ ...fields, isActive: form.isActive }).unwrap()
        dispatch(toastShown({ type: 'success', message: `${fields.name} created` }))
      }
      onClose()
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'The brand could not be saved.'))
    }
  }

  return (
    <FormModal
      open={open}
      onClose={onClose}
      onSubmit={submit}
      loading={addState.isLoading || updateState.isLoading || activeState.isLoading}
      error={error}
      title={isEdit ? 'Edit brand' : 'New brand'}
      description={
        isEdit
          ? 'Deactivating a brand also deactivates every product that belongs to it.'
          : 'The brand slug is generated from the name by the API.'
      }
      submitLabel={isEdit ? 'Save changes' : 'Create brand'}
    >
      <Field label="Name" required>
        <Input value={form.name} onChange={(event) => set('name')(event.target.value)} placeholder="e.g. Acme Supply" />
      </Field>
      <Field label="Slug" required={isEdit} hint={isEdit ? 'Storefront address: /shop/brand/slug' : 'Generated automatically'}>
        <Input
          value={form.slug}
          disabled={!isEdit}
          onChange={(event) => set('slug')(event.target.value)}
          placeholder="acme-supply"
        />
      </Field>
      <FormRow>
        <Field label="Description" required hint={`${form.description.length}/${DESCRIPTION_LIMIT} characters`}>
          <Textarea
            rows={3}
            maxLength={DESCRIPTION_LIMIT}
            value={form.description}
            onChange={(event) => set('description')(event.target.value)}
            placeholder="What this brand sells"
          />
        </Field>
      </FormRow>
      <FormRow>
        <Checkbox
          label="Active (visible in the storefront)"
          checked={form.isActive}
          onChange={(event) => set('isActive')(event.target.checked)}
        />
      </FormRow>
    </FormModal>
  )
}

export default function Brands() {
  const dispatch = useDispatch()
  const role = useSelector(selectRole)
  const isAdmin = role === 'ROLE ADMIN'
  const { data, isLoading, isError, error, refetch } = useManagerBrandsQuery()
  const [setBrandActive] = useSetBrandActiveMutation()
  const [deleteBrand, deleteState] = useDeleteBrandMutation()

  const [term, setTerm] = useState('')
  const [dialog, setDialog] = useState(null)
  const [confirming, setConfirming] = useState(null)
  const [pendingId, setPendingId] = useState(null)

  const brands = data?.brands || []
  const owned = brands.filter((brand) => brand.merchant)

  const filtered = useMemo(
    () =>
      brands.filter((brand) =>
        matches(brand, term, (item) => [item.name, item.slug, item.description, item.merchant?.name])
      ),
    [brands, term]
  )

  const { visible, page, totalPages, count, setPage, reset } = useClientPage(filtered, PER_PAGE)

  useEffect(() => {
    reset()
  }, [term, reset])

  const toggleActive = async (brand) => {
    setPendingId(brand._id)
    try {
      await setBrandActive({ id: brand._id, isActive: !brand.isActive }).unwrap()
      dispatch(
        toastShown({
          type: 'success',
          message: brand.isActive
            ? `${brand.name} disabled — its products were deactivated too`
            : `${brand.name} is now active`
        })
      )
    } catch (requestError) {
      dispatch(toastShown({ type: 'error', message: apiErrorMessage(requestError, 'Could not change the status.') }))
    } finally {
      setPendingId(null)
    }
  }

  const remove = async () => {
    const brand = confirming
    if (!brand) return
    try {
      await deleteBrand(brand._id).unwrap()
      dispatch(toastShown({ type: 'success', message: `${brand.name} deleted` }))
      setConfirming(null)
    } catch (requestError) {
      dispatch(toastShown({ type: 'error', message: apiErrorMessage(requestError, 'Could not delete the brand.') }))
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Catalogue"
        title={isAdmin ? 'Brands' : 'Brand'}
        meta={<ResultMeta count={count} label={count === 1 ? 'brand' : 'brands'} />}
        description={
          isAdmin
            ? `Every supplier in the store. ${owned.length} of them belong to a merchant account.`
            : 'The brands you own. A brand must stay active for its products to appear in the store.'
        }
        actions={
          isAdmin ? (
            <Button onClick={() => setDialog({ brand: null })}>
              <Plus size={16} /> Add brand
            </Button>
          ) : null
        }
      />

      <Toolbar>
        <FilterInput value={term} onChange={setTerm} placeholder="Filter by name, slug or owner…" />
      </Toolbar>

      <TableShell tableClassName="min-w-[58rem]">
        <thead>
          <tr>
            <Th>Brand</Th>
            <Th>Description</Th>
            <Th>Owner</Th>
            <Th>Created</Th>
            <Th>Status</Th>
            <Th className="text-right">Actions</Th>
          </tr>
        </thead>
        <tbody>
          {isLoading && <TableLoading colSpan={6} />}
          {isError && (
            <TableMessage
              colSpan={6}
              title="Brands could not be loaded"
              description={apiErrorMessage(error)}
              action={
                <Button variant="outline" size="sm" className="mt-2" onClick={refetch}>
                  Try again
                </Button>
              }
            />
          )}
          {!isLoading && !isError && count === 0 && (
            <TableMessage
              colSpan={6}
              icon={Store}
              title={term ? 'No brand matches that filter' : 'No brands yet'}
              description={
                term
                  ? 'Try a different name, slug or owner.'
                  : 'A product needs a brand — create one before adding products.'
              }
              action={
                term ? (
                  <Button variant="outline" size="sm" className="mt-2" onClick={() => setTerm('')}>
                    Clear filter
                  </Button>
                ) : isAdmin ? (
                  <Button size="sm" className="mt-2" onClick={() => setDialog({ brand: null })}>
                    <Plus size={15} /> Add brand
                  </Button>
                ) : null
              }
            />
          )}
          {!isLoading &&
            !isError &&
            visible.map((brand) => (
              <tr key={brand._id} className="transition-colors hover:bg-ink-50/70">
                <Td>
                  <Link to={`/shop/brand/${brand.slug}`} className="font-medium text-ink-900 hover:text-brand-700">
                    {brand.name}
                  </Link>
                  <p className="text-xs text-ink-500">/{brand.slug}</p>
                </Td>
                <Td className="max-w-sm">
                  <p className="line-clamp-2 text-sm text-ink-600">{brand.description}</p>
                </Td>
                <Td>
                  {brand.merchant ? (
                    <Badge tone="duality">{brand.merchant.name}</Badge>
                  ) : (
                    <span className="text-sm text-ink-500">Platform</span>
                  )}
                </Td>
                <Td className="text-sm whitespace-nowrap text-ink-500">{shortDate(brand.created)}</Td>
                <Td>
                  <ActiveToggle
                    active={brand.isActive !== false}
                    loading={pendingId === brand._id}
                    onChange={() => toggleActive(brand)}
                  />
                </Td>
                <Td>
                  <div className="flex items-center justify-end gap-1">
                    <IconButton label={`Edit ${brand.name}`} onClick={() => setDialog({ brand })}>
                      <Pencil size={16} />
                    </IconButton>
                    {isAdmin && (
                      <IconButton
                        label={`Delete ${brand.name}`}
                        className="hover:bg-brand-50 hover:text-brand-700"
                        onClick={() => setConfirming(brand)}
                      >
                        <Trash2 size={16} />
                      </IconButton>
                    )}
                  </div>
                </Td>
              </tr>
            ))}
        </tbody>
      </TableShell>

      {!isLoading && !isError && count > 0 && (
        <TableFooter
          page={page}
          totalPages={totalPages}
          count={count}
          limit={PER_PAGE}
          onPage={setPage}
          unit={count === 1 ? 'brand' : 'brands'}
        />
      )}

      <BrandFormModal open={Boolean(dialog)} brand={dialog?.brand || null} onClose={() => setDialog(null)} />

      <ConfirmDialog
        open={Boolean(confirming)}
        onClose={() => setConfirming(null)}
        onConfirm={remove}
        loading={deleteState.isLoading}
        title="Delete brand"
        confirmLabel="Delete brand"
        description={
          <>
            <p>
              <span className="font-medium text-ink-900">{confirming?.name}</span> will be deleted.
            </p>
            <p className="text-xs text-ink-500">
              If the brand belongs to a merchant, that merchant is reset to “Waiting Approval” and loses the link. The
              brand’s products are left in the catalogue.
            </p>
          </>
        }
      />
    </div>
  )
}
