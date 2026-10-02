import { useState } from 'react'
import { CheckCircle2, MapPin, Pencil, Plus, Trash2 } from 'lucide-react'
import { PageHeader } from '../../components/account/PageHeader'
import { AddressForm } from '../../components/account/AddressForm'
import { FormAlert } from '../../components/account/FormAlert'
import { apiErrorMessage } from '../../lib/apiError'
import { useDocumentTitle } from '../../lib/useDocumentTitle'
import { Badge, EmptyState, LoadingBlock } from '../../components/ui/Display'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import {
  useAddAddressMutation,
  useAddressesQuery,
  useDeleteAddressMutation,
  useUpdateAddressMutation
} from '../../features/address/addressApi'
import { toastShown } from '../../features/ui/uiSlice'
import { useDispatch } from 'react-redux'

const formatAddress = (address) =>
  [address.address, address.city, address.state, address.country, address.zipCode].filter(Boolean).join(', ')

export default function Addresses() {
  useDocumentTitle('Addresses')
  const dispatch = useDispatch()
  const { data, isLoading, isError, error } = useAddressesQuery()
  const [addAddress, { isLoading: isAdding }] = useAddAddressMutation()
  const [updateAddress, { isLoading: isUpdating }] = useUpdateAddressMutation()
  const [deleteAddress, { isLoading: isDeleting }] = useDeleteAddressMutation()

  const [editor, setEditor] = useState(null) // null | { mode: 'add' | 'edit', address? }
  const [pendingDelete, setPendingDelete] = useState(null)

  const addresses = data?.addresses || []

  // The API does not enforce a single default address, so demote the others
  // right after a default is saved.
  const demoteOtherDefaults = async (savedId, saved) => {
    if (!saved.isDefault) return
    const others = addresses.filter((item) => item._id !== savedId && item.isDefault)
    await Promise.all(
      others.map((item) =>
        updateAddress({
          id: item._id,
          address: item.address,
          city: item.city,
          state: item.state,
          country: item.country,
          zipCode: item.zipCode,
          isDefault: false
        }).unwrap()
      )
    )
  }

  const save = async (payload) => {
    try {
      if (editor?.mode === 'edit') {
        const result = await updateAddress({ id: editor.address._id, ...payload }).unwrap()
        await demoteOtherDefaults(editor.address._id, payload)
        dispatch(toastShown({ type: 'success', message: result?.message || 'Address has been updated successfully!' }))
      } else {
        const result = await addAddress(payload).unwrap()
        await demoteOtherDefaults(result?.address?._id, payload)
        dispatch(toastShown({ type: 'success', message: result?.message || 'Address has been added successfully!' }))
      }
      setEditor(null)
    } catch (requestError) {
      dispatch(toastShown({ type: 'error', message: apiErrorMessage(requestError, 'The address could not be saved.') }))
    }
  }

  const remove = async () => {
    if (!pendingDelete) return
    try {
      const result = await deleteAddress(pendingDelete._id).unwrap()
      dispatch(toastShown({ type: 'success', message: result?.message || 'Address has been deleted successfully!' }))
      setPendingDelete(null)
      setEditor(null)
    } catch (requestError) {
      dispatch(toastShown({ type: 'error', message: apiErrorMessage(requestError, 'The address could not be deleted.') }))
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Account"
        title="Address"
        description="Delivery addresses stored on your account. The default one is offered first at checkout."
        action={
          <Button onClick={() => setEditor({ mode: 'add' })}>
            <Plus size={16} /> Add address
          </Button>
        }
      />

      {isLoading && <LoadingBlock label="Loading addresses…" />}

      {isError && !isLoading && (
        <FormAlert>{apiErrorMessage(error, 'Your addresses could not be loaded.')}</FormAlert>
      )}

      {!isLoading && !isError && addresses.length === 0 && (
        <EmptyState
          icon={MapPin}
          title="No addresses found."
          description="Add a delivery address so checkout can pre-fill your details."
          action={
            <Button onClick={() => setEditor({ mode: 'add' })}>
              <Plus size={16} /> Add your first address
            </Button>
          }
        />
      )}

      {addresses.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {addresses.map((address) => (
            <article key={address._id} className="card-surface flex flex-col p-4">
              <div className="flex items-start justify-between gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-ink-100 text-ink-600">
                  <MapPin size={18} />
                </span>
                {address.isDefault ? (
                  <Badge tone="success">
                    <CheckCircle2 size={13} /> Default
                  </Badge>
                ) : (
                  <Badge tone="neutral">Delivery</Badge>
                )}
              </div>

              <p className="mt-3 text-sm leading-relaxed text-ink-700">{formatAddress(address) || '—'}</p>

              <div className="mt-auto flex items-center gap-2 pt-4">
                <Button size="sm" variant="outline" onClick={() => setEditor({ mode: 'edit', address })}>
                  <Pencil size={14} /> Edit
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setPendingDelete(address)}>
                  <Trash2 size={14} /> Delete
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal
        open={Boolean(editor)}
        onClose={() => setEditor(null)}
        title={editor?.mode === 'edit' ? 'Edit address' : 'Add address'}
      >
        {editor && (
          <AddressForm
            key={editor.address?._id || 'new'}
            initialValue={editor.address}
            submitting={isAdding || isUpdating}
            submitLabel={editor.mode === 'edit' ? 'Save changes' : 'Add address'}
            onSubmit={save}
            onCancel={() => setEditor(null)}
            onDelete={editor.mode === 'edit' ? () => setPendingDelete(editor.address) : undefined}
            deleting={isDeleting}
          />
        )}
      </Modal>

      <Modal
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        title="Delete address"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button variant="danger" loading={isDeleting} onClick={remove}>
              <Trash2 size={15} /> Delete address
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-600">
          Delete the address <span className="font-medium text-ink-800">{formatAddress(pendingDelete || {})}</span>?
          This cannot be undone.
        </p>
      </Modal>
    </>
  )
}
