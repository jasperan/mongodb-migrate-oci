import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { Button, IconButton } from '../../components/ui/Button'
import { Checkbox, Field, Input, Select, Textarea } from '../../components/ui/Field'
import { ProductArt } from '../../components/catalog/ProductCard'
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
  useCreateProductMutation,
  useDeleteProductMutation,
  useManagerProductsQuery,
  useSetProductActiveMutation,
  useUpdateProductMutation
} from '../../features/manager/managerApi'
import { useBrandOptionsQuery } from '../../features/catalog/catalogApi'
import { toastShown } from '../../features/ui/uiSlice'
import { apiErrorMessage } from '../../lib/apiError'
import { currency } from '../../lib/format'

const PER_PAGE = 12

const emptyForm = {
  sku: '',
  name: '',
  slug: '',
  description: '',
  price: '',
  quantity: '',
  taxable: false,
  isActive: true,
  brand: ''
}

const brandId = (brand) => (brand && typeof brand === 'object' ? brand._id || '' : brand || '')

const brandName = (brand) => {
  if (!brand) return 'No brand'
  return typeof brand === 'object' ? brand.name || 'No brand' : String(brand)
}

function ProductFormModal({ open, product, brands, onClose }) {
  const dispatch = useDispatch()
  const isEdit = Boolean(product)
  const [form, setForm] = useState(emptyForm)
  const [image, setImage] = useState(null)
  const [error, setError] = useState('')
  const [createProduct, createState] = useCreateProductMutation()
  const [updateProduct, updateState] = useUpdateProductMutation()

  useEffect(() => {
    if (!open) return
    setError('')
    setImage(null)
    setForm(
      product
        ? {
            sku: product.sku || '',
            name: product.name || '',
            slug: product.slug || '',
            description: product.description || '',
            price: product.price ?? '',
            quantity: product.quantity ?? '',
            taxable: Boolean(product.taxable),
            isActive: product.isActive !== false,
            brand: brandId(product.brand)
          }
        : emptyForm
    )
  }, [open, product])

  const set = (key) => (value) => setForm((prev) => ({ ...prev, [key]: value }))

  const validate = () => {
    if (!form.sku.trim()) return 'SKU is required.'
    if (!form.name.trim()) return 'Name is required.'
    if (!form.description.trim()) return 'Description is required.'
    if (!(Number(form.price) > 0)) return 'Price must be a number greater than 0.'
    if (!(Number(form.quantity) >= 1)) return 'Quantity must be at least 1.'
    if (!form.brand) return 'Select a brand — products without one never appear in the store.'
    if (isEdit && !form.slug.trim()) return 'Slug is required.'
    return ''
  }

  const submit = async () => {
    const problem = validate()
    if (problem) {
      setError(problem)
      return
    }
    setError('')
    const fields = {
      sku: form.sku.trim(),
      name: form.name.trim(),
      description: form.description.trim(),
      price: Number(form.price),
      quantity: Number(form.quantity),
      taxable: form.taxable,
      isActive: form.isActive,
      brand: form.brand
    }
    try {
      if (isEdit) {
        await updateProduct({ id: product._id, product: { ...fields, slug: form.slug.trim() } }).unwrap()
        dispatch(toastShown({ type: 'success', message: `${fields.name} updated` }))
      } else {
        // multipart/form-data: only attach the file when one was actually chosen.
        await createProduct(image ? { ...fields, image } : fields).unwrap()
        dispatch(toastShown({ type: 'success', message: `${fields.name} added` }))
      }
      onClose()
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'The product could not be saved.'))
    }
  }

  const submitting = createState.isLoading || updateState.isLoading

  return (
    <FormModal
      open={open}
      onClose={onClose}
      onSubmit={submit}
      loading={submitting}
      error={error}
      title={isEdit ? 'Edit product' : 'New product'}
      description={
        isEdit
          ? 'Saving updates name, SKU, slug, description, price, stock, tax and brand.'
          : 'The API accepts multipart/form-data — the optional image is uploaded as the `image` file field.'
      }
      submitLabel={isEdit ? 'Save changes' : 'Add product'}
    >
      <Field label="SKU" required hint="Letters, digits and dashes; must be unique.">
        <Input value={form.sku} onChange={(event) => set('sku')(event.target.value)} placeholder="e.g. ORC-TSHIRT-01" />
      </Field>
      <Field label="Name" required>
        <Input value={form.name} onChange={(event) => set('name')(event.target.value)} placeholder="Product name" />
      </Field>
      <FormRow>
        <Field label="Description" required>
          <Textarea
            rows={3}
            value={form.description}
            onChange={(event) => set('description')(event.target.value)}
            placeholder="What the customer reads on the product page"
          />
        </Field>
      </FormRow>
      <Field label="Price (USD)" required>
        <Input
          type="number"
          min="0.01"
          step="0.01"
          value={form.price}
          onChange={(event) => set('price')(event.target.value)}
          placeholder="49.99"
        />
      </Field>
      <Field label="Quantity in stock" required hint="The API rejects 0 — deactivate the product instead.">
        <Input
          type="number"
          min="1"
          step="1"
          value={form.quantity}
          onChange={(event) => set('quantity')(event.target.value)}
          placeholder="25"
        />
      </Field>
      <Field label="Brand" required>
        <Select value={form.brand} onChange={(event) => set('brand')(event.target.value)}>
          <option value="">Select a brand…</option>
          {brands.map((brand) => (
            <option key={brand._id} value={brand._id}>
              {brand.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Taxable" hint="California tax (5%) is applied at checkout when yes.">
        <Select value={form.taxable ? 'yes' : 'no'} onChange={(event) => set('taxable')(event.target.value === 'yes')}>
          <option value="no">No</option>
          <option value="yes">Yes</option>
        </Select>
      </Field>
      {isEdit && (
        <Field label="Slug" required hint="The storefront address of this product.">
          <Input value={form.slug} onChange={(event) => set('slug')(event.target.value)} />
        </Field>
      )}
      {!isEdit && (
        <Field label="Image" hint="Optional. JPG or PNG — this API records the file name, not the bytes.">
          <input
            type="file"
            accept="image/png,image/jpeg"
            onChange={(event) => setImage(event.target.files?.[0] || null)}
            className="w-full rounded-xl border border-ink-300 bg-white px-3.5 py-2.5 text-sm text-ink-700 file:mr-3 file:rounded-full file:border-0 file:bg-ink-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-ink-700"
          />
        </Field>
      )}
      <FormRow className="flex flex-wrap items-center gap-6">
        <Checkbox
          label="Active (visible in the store)"
          checked={form.isActive}
          onChange={(event) => set('isActive')(event.target.checked)}
        />
      </FormRow>
    </FormModal>
  )
}

export default function Products() {
  const dispatch = useDispatch()
  const { data, isLoading, isError, error, refetch, isFetching } = useManagerProductsQuery()
  const { data: brandOptions } = useBrandOptionsQuery()
  const [setProductActive] = useSetProductActiveMutation()
  const [deleteProduct, deleteState] = useDeleteProductMutation()

  const [term, setTerm] = useState('')
  const [dialog, setDialog] = useState(null) // { product } | { product: null }
  const [confirming, setConfirming] = useState(null)
  const [pendingId, setPendingId] = useState(null)

  const brands = brandOptions?.brands || []
  const products = data?.products || []

  const filtered = useMemo(
    () =>
      products.filter((product) =>
        matches(product, term, (item) => [item.name, item.sku, item.slug, brandName(item.brand)])
      ),
    [products, term]
  )

  const { visible, page, totalPages, count, setPage, reset } = useClientPage(filtered, PER_PAGE)

  useEffect(() => {
    reset()
  }, [term, reset])

  const toggleActive = async (product) => {
    setPendingId(product._id)
    try {
      await setProductActive({ id: product._id, isActive: !product.isActive }).unwrap()
      dispatch(
        toastShown({
          type: 'success',
          message: `${product.name} is now ${product.isActive ? 'inactive' : 'active'}`
        })
      )
    } catch (requestError) {
      dispatch(toastShown({ type: 'error', message: apiErrorMessage(requestError, 'Could not change the status.') }))
    } finally {
      setPendingId(null)
    }
  }

  const remove = async () => {
    const product = confirming
    if (!product) return
    try {
      await deleteProduct(product._id).unwrap()
      dispatch(toastShown({ type: 'success', message: `${product.name} deleted` }))
      setConfirming(null)
    } catch (requestError) {
      dispatch(toastShown({ type: 'error', message: apiErrorMessage(requestError, 'Could not delete the product.') }))
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Catalogue"
        title="Products"
        meta={<ResultMeta count={count} label={count === 1 ? 'product' : 'products'} />}
        description="Everything the store sells. Inactive products stay in the catalogue but disappear from the storefront."
        actions={
          <Button onClick={() => setDialog({ product: null })}>
            <Plus size={16} /> Add product
          </Button>
        }
      />

      <Toolbar className="justify-between">
        <FilterInput value={term} onChange={setTerm} placeholder="Filter by name, SKU or brand…" />
        {isFetching && !isLoading && <p className="text-xs text-ink-500">Refreshing…</p>}
      </Toolbar>

      <TableShell tableClassName="min-w-[62rem]">
        <thead>
          <tr>
            <Th>Product</Th>
            <Th>SKU</Th>
            <Th>Brand</Th>
            <Th className="text-right">Price</Th>
            <Th className="text-right">Stock</Th>
            <Th>Taxable</Th>
            <Th>Status</Th>
            <Th className="text-right">Actions</Th>
          </tr>
        </thead>
        <tbody>
          {isLoading && <TableLoading colSpan={8} />}
          {isError && (
            <TableMessage
              colSpan={8}
              title="Products could not be loaded"
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
              colSpan={8}
              title={term ? 'No product matches that filter' : 'No products yet'}
              description={
                term
                  ? 'Try a different name, SKU or brand.'
                  : 'Add the first product — you will need to create a brand first.'
              }
              action={
                term ? (
                  <Button variant="outline" size="sm" className="mt-2" onClick={() => setTerm('')}>
                    Clear filter
                  </Button>
                ) : (
                  <Button size="sm" className="mt-2" onClick={() => setDialog({ product: null })}>
                    <Plus size={15} /> Add product
                  </Button>
                )
              }
            />
          )}
          {!isLoading &&
            !isError &&
            visible.map((product) => (
              <tr key={product._id} className="transition-colors hover:bg-ink-50/70">
                <Td>
                  <div className="flex items-center gap-3">
                    <ProductArt product={product} className="size-11 shrink-0 rounded-xl" />
                    <div className="min-w-0">
                      <Link
                        to={`/product/${product.slug}`}
                        className="block truncate font-medium text-ink-900 hover:text-brand-700"
                      >
                        {product.name}
                      </Link>
                      <p className="truncate text-xs text-ink-500">/{product.slug}</p>
                    </div>
                  </div>
                </Td>
                <Td className="font-mono text-xs text-ink-600">{product.sku || '—'}</Td>
                <Td>
                  <span className="text-sm text-ink-700">{brandName(product.brand)}</span>
                  {product.brand && typeof product.brand === 'object' && product.brand.isActive === false && (
                    <p className="text-xs text-brand-600">brand inactive</p>
                  )}
                </Td>
                <Td className="text-right font-medium text-ink-900">{currency(product.price)}</Td>
                <Td className="text-right">
                  <span className={product.quantity > 10 ? 'text-ink-700' : 'font-semibold text-amber-600'}>
                    {product.quantity}
                  </span>
                </Td>
                <Td>{product.taxable ? 'Yes' : 'No'}</Td>
                <Td>
                  <ActiveToggle
                    active={product.isActive !== false}
                    loading={pendingId === product._id}
                    onChange={() => toggleActive(product)}
                  />
                </Td>
                <Td>
                  <div className="flex items-center justify-end gap-1">
                    <IconButton label={`Edit ${product.name}`} onClick={() => setDialog({ product })}>
                      <Pencil size={16} />
                    </IconButton>
                    <IconButton
                      label={`Delete ${product.name}`}
                      className="hover:bg-brand-50 hover:text-brand-700"
                      onClick={() => setConfirming(product)}
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
          unit={count === 1 ? 'product' : 'products'}
        />
      )}

      <ProductFormModal
        open={Boolean(dialog)}
        product={dialog?.product || null}
        brands={brands}
        onClose={() => setDialog(null)}
      />

      <ConfirmDialog
        open={Boolean(confirming)}
        onClose={() => setConfirming(null)}
        onConfirm={remove}
        loading={deleteState.isLoading}
        title="Delete product"
        confirmLabel="Delete product"
        description={
          <>
            <p>
              <span className="font-medium text-ink-900">{confirming?.name}</span> will be removed from the catalogue
              permanently.
            </p>
            <p className="text-xs text-ink-500">
              The API hard-deletes it and leaves the id inside any category that lists it.
            </p>
          </>
        }
      />
    </div>
  )
}
