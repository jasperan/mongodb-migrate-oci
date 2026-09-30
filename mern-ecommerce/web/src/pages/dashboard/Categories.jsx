import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { Layers, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { Button, IconButton } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Display'
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
  apiErrorMessage,
  matches,
  useClientPage
} from '../../components/manager'
import {
  useAddCategoryMutation,
  useDeleteCategoryMutation,
  useSetCategoryActiveMutation,
  useUpdateCategoryMutation
} from '../../features/manager/managerApi'
import { useAllCategoriesQuery, useProductOptionsQuery } from '../../features/catalog/catalogApi'
import { toastShown } from '../../features/ui/uiSlice'
import clsx from 'clsx'

const PER_PAGE = 12
const DESCRIPTION_LIMIT = 200

const emptyForm = { name: '', slug: '', description: '', isActive: true, products: [] }

// Multi-select over the full product catalogue (112 rows),
// with a local filter so an admin can find a product without scrolling.
function ProductPicker({ products, selected, onChange, loading = false }) {
  const [term, setTerm] = useState('')
  const selectedSet = useMemo(() => new Set(selected), [selected])

  const visible = useMemo(
    () => products.filter((product) => matches(product, term, (item) => [item.name])),
    [products, term]
  )

  const toggle = (id) => {
    onChange(selectedSet.has(id) ? selected.filter((value) => value !== id) : [...selected, id])
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold tracking-wide text-ink-600 uppercase">
          Products{' '}
          <span className="font-normal normal-case">
            ({selected.length} selected{loading ? '' : ` of ${products.length}`})
          </span>
        </span>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={loading}
            onClick={() => onChange(Array.from(new Set([...selected, ...visible.map((p) => p._id)])))}
          >
            Select {term ? 'matching' : 'all'}
          </Button>
          <Button type="button" size="sm" variant="ghost" disabled={loading} onClick={() => onChange([])}>
            Clear
          </Button>
        </div>
      </div>
      <div className="relative">
        <Search size={15} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-400" />
        <input
          type="search"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Find a product…"
          aria-label="Find a product"
          className="h-10 w-full rounded-xl border border-ink-300 bg-white pr-3 pl-10 text-sm placeholder:text-ink-400 focus:border-brand-500 focus:outline-none"
        />
      </div>
      <div className="max-h-56 overflow-y-auto rounded-xl border border-ink-200 bg-white p-1.5">
        {loading && (
          <p className="flex items-center justify-center gap-2 px-3 py-6 text-sm text-ink-500">
            <Spinner className="size-4" /> Loading the catalogue…
          </p>
        )}
        {!loading && visible.length === 0 && (
          <p className="px-3 py-6 text-center text-sm text-ink-500">
            {products.length === 0 ? 'No products in the catalogue yet.' : `No product matches “${term}”.`}
          </p>
        )}
        {!loading &&
          visible.map((product) => (
            <label
              key={product._id}
              className={clsx(
                'flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm',
                selectedSet.has(product._id) ? 'bg-brand-50 text-ink-900' : 'hover:bg-ink-50'
              )}
            >
              <input
                type="checkbox"
                checked={selectedSet.has(product._id)}
                onChange={() => toggle(product._id)}
                className="size-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
              />
              <span className="truncate">{product.name}</span>
            </label>
          ))}
      </div>
      <p className="text-xs text-ink-500">
        Assigning products is what makes the category filter work — products created through the product form are never
        attached to a category automatically.
      </p>
    </div>
  )
}

function CategoryFormModal({ open, category, products, productsLoading = false, onClose }) {
  const dispatch = useDispatch()
  const isEdit = Boolean(category)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const [addCategory, addState] = useAddCategoryMutation()
  const [updateCategory, updateState] = useUpdateCategoryMutation()
  const [setCategoryActive, activeState] = useSetCategoryActiveMutation()

  useEffect(() => {
    if (!open) return
    setError('')
    setForm(
      category
        ? {
            name: category.name || '',
            slug: category.slug || '',
            description: category.description || '',
            isActive: category.isActive !== false,
            products: Array.isArray(category.products)
              ? category.products.map((entry) => (typeof entry === 'object' ? entry._id : entry))
              : []
          }
        : emptyForm
    )
  }, [open, category])

  const set = (key) => (value) => setForm((prev) => ({ ...prev, [key]: value }))

  const submit = async () => {
    if (!form.name.trim()) return setError('Name is required.')
    if (!form.description.trim()) return setError('Description is required.')
    if (form.description.length > DESCRIPTION_LIMIT) return setError(`Description must be ${DESCRIPTION_LIMIT} characters or fewer.`)
    if (isEdit && !form.slug.trim()) return setError('Slug is required.')
    setError('')

    const fields = {
      name: form.name.trim(),
      description: form.description.trim(),
      products: form.products
    }
    try {
      if (isEdit) {
        // The status endpoint is the only one that cascades a deactivation to the
        // category's products, so a changed switch goes through it explicitly.
        if (form.isActive !== (category.isActive !== false)) {
          await setCategoryActive({ id: category._id, isActive: form.isActive }).unwrap()
        }
        await updateCategory({ id: category._id, category: { ...fields, slug: form.slug.trim() } }).unwrap()
        dispatch(toastShown({ type: 'success', message: `${fields.name} updated` }))
      } else {
        await addCategory({ ...fields, isActive: form.isActive }).unwrap()
        dispatch(toastShown({ type: 'success', message: `${fields.name} created` }))
      }
      onClose()
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'The category could not be saved.'))
    }
  }

  return (
    <FormModal
      open={open}
      onClose={onClose}
      onSubmit={submit}
      loading={addState.isLoading || updateState.isLoading || activeState.isLoading}
      error={error}
      title={isEdit ? 'Edit category' : 'New category'}
      description={
        isEdit
          ? 'Saving also replaces the category’s product list. Deactivating a category cascades to its products.'
          : 'The category slug is generated from the name by the API.'
      }
      submitLabel={isEdit ? 'Save changes' : 'Create category'}
    >
      <Field label="Name" required>
        <Input value={form.name} onChange={(event) => set('name')(event.target.value)} placeholder="e.g. Outdoor" />
      </Field>
      <Field label="Slug" required={isEdit} hint={isEdit ? 'Storefront address: /shop/category/slug' : 'Generated automatically'} >
        <Input
          value={form.slug}
          disabled={!isEdit}
          onChange={(event) => set('slug')(event.target.value)}
          placeholder="outdoor"
        />
      </Field>
      <FormRow>
        <Field label="Description" required hint={`${form.description.length}/${DESCRIPTION_LIMIT} characters`}>
          <Textarea
            rows={3}
            maxLength={DESCRIPTION_LIMIT}
            value={form.description}
            onChange={(event) => set('description')(event.target.value)}
            placeholder="How this collection is presented in the store"
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
      <FormRow>
        <ProductPicker
          products={products}
          selected={form.products}
          onChange={set('products')}
          loading={productsLoading}
        />
      </FormRow>
    </FormModal>
  )
}

export default function Categories() {
  const dispatch = useDispatch()
  const { data, isLoading, isError, error, refetch } = useAllCategoriesQuery()
  const { data: productOptions, isLoading: productsLoading } = useProductOptionsQuery()
  const [setCategoryActive] = useSetCategoryActiveMutation()
  const [deleteCategory, deleteState] = useDeleteCategoryMutation()

  const [term, setTerm] = useState('')
  const [dialog, setDialog] = useState(null)
  const [confirming, setConfirming] = useState(null)
  const [pendingId, setPendingId] = useState(null)

  const products = productOptions?.products || []
  const categories = data?.categories || []

  const filtered = useMemo(
    () => categories.filter((category) => matches(category, term, (item) => [item.name, item.slug, item.description])),
    [categories, term]
  )

  const { visible, page, totalPages, count, setPage, reset } = useClientPage(filtered, PER_PAGE)

  useEffect(() => {
    reset()
  }, [term, reset])

  const toggleActive = async (category) => {
    setPendingId(category._id)
    try {
      await setCategoryActive({ id: category._id, isActive: !category.isActive }).unwrap()
      dispatch(
        toastShown({
          type: 'success',
          message: `${category.name} is now ${category.isActive ? 'inactive' : 'active'}`
        })
      )
    } catch (requestError) {
      dispatch(toastShown({ type: 'error', message: apiErrorMessage(requestError, 'Could not change the status.') }))
    } finally {
      setPendingId(null)
    }
  }

  const remove = async () => {
    const category = confirming
    if (!category) return
    try {
      await deleteCategory(category._id).unwrap()
      dispatch(toastShown({ type: 'success', message: `${category.name} deleted` }))
      setConfirming(null)
    } catch (requestError) {
      dispatch(toastShown({ type: 'error', message: apiErrorMessage(requestError, 'Could not delete the category.') }))
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Catalogue"
        title="Categories"
        meta={<ResultMeta count={count} label={count === 1 ? 'category' : 'categories'} />}
        description="Collections drive the storefront filters. Each category owns the list of products it exposes."
        actions={
          <Button onClick={() => setDialog({ category: null })}>
            <Plus size={16} /> Add category
          </Button>
        }
      />

      <Toolbar>
        <FilterInput value={term} onChange={setTerm} placeholder="Filter by name or slug…" />
      </Toolbar>

      <TableShell tableClassName="min-w-[56rem]">
        <thead>
          <tr>
            <Th>Category</Th>
            <Th>Description</Th>
            <Th className="text-right">Products</Th>
            <Th>Status</Th>
            <Th className="text-right">Actions</Th>
          </tr>
        </thead>
        <tbody>
          {isLoading && <TableLoading colSpan={5} />}
          {isError && (
            <TableMessage
              colSpan={5}
              title="Categories could not be loaded"
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
              colSpan={5}
              icon={Layers}
              title={term ? 'No category matches that filter' : 'No categories yet'}
              description={term ? 'Try a different name or slug.' : 'Create a category and give it products to sell.'}
              action={
                term ? (
                  <Button variant="outline" size="sm" className="mt-2" onClick={() => setTerm('')}>
                    Clear filter
                  </Button>
                ) : (
                  <Button size="sm" className="mt-2" onClick={() => setDialog({ category: null })}>
                    <Plus size={15} /> Add category
                  </Button>
                )
              }
            />
          )}
          {!isLoading &&
            !isError &&
            visible.map((category) => (
              <tr key={category._id} className="transition-colors hover:bg-ink-50/70">
                <Td>
                  <Link
                    to={`/shop/category/${category.slug}`}
                    className="font-medium text-ink-900 hover:text-brand-700"
                  >
                    {category.name}
                  </Link>
                  <p className="text-xs text-ink-500">/{category.slug}</p>
                </Td>
                <Td className="max-w-md">
                  <p className="line-clamp-2 text-sm text-ink-600">{category.description}</p>
                </Td>
                <Td className="text-right font-medium text-ink-900">{category.products?.length || 0}</Td>
                <Td>
                  <ActiveToggle
                    active={category.isActive !== false}
                    loading={pendingId === category._id}
                    onChange={() => toggleActive(category)}
                  />
                </Td>
                <Td>
                  <div className="flex items-center justify-end gap-1">
                    <IconButton label={`Edit ${category.name}`} onClick={() => setDialog({ category })}>
                      <Pencil size={16} />
                    </IconButton>
                    <IconButton
                      label={`Delete ${category.name}`}
                      className="hover:bg-brand-50 hover:text-brand-700"
                      onClick={() => setConfirming(category)}
                    >
                      <Trash2 size={16} />
                    </IconButton>
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
          unit={count === 1 ? 'category' : 'categories'}
        />
      )}

      <CategoryFormModal
        open={Boolean(dialog)}
        category={dialog?.category || null}
        products={products}
        productsLoading={productsLoading}
        onClose={() => setDialog(null)}
      />

      <ConfirmDialog
        open={Boolean(confirming)}
        onClose={() => setConfirming(null)}
        onConfirm={remove}
        loading={deleteState.isLoading}
        title="Delete category"
        confirmLabel="Delete category"
        description={
          <>
            <p>
              <span className="font-medium text-ink-900">{confirming?.name}</span> will be deleted. Its{' '}
              {confirming?.products?.length || 0} product links disappear with it.
            </p>
            <p className="text-xs text-ink-500">The products themselves are kept in the catalogue.</p>
          </>
        }
      />
    </div>
  )
}
