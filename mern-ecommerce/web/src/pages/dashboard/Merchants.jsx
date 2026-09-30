import { useState } from 'react'
import { useDispatch } from 'react-redux'
import { CircleCheck, CircleX, Phone, RotateCcw, Store, Trash2 } from 'lucide-react'
import { Badge } from '../../components/ui/Display'
import { Button, IconButton } from '../../components/ui/Button'
import {
  ActiveToggle,
  Avatar,
  ConfirmDialog,
  PageHeader,
  ResultMeta,
  SearchInput,
  StatusBadge,
  TableFooter,
  TableLoading,
  TableMessage,
  TableShell,
  Td,
  Th,
  Toolbar,
  apiErrorMessage
} from '../../components/manager'
import {
  useApproveMerchantMutation,
  useDeleteMerchantMutation,
  useMerchantsQuery,
  useRejectMerchantMutation,
  useSearchMerchantsQuery,
  useSetMerchantActiveMutation
} from '../../features/manager/managerApi'
import { toastShown } from '../../features/ui/uiSlice'
import { shortDate } from '../../lib/format'

const LIMIT = 20

// The legacy merchant list was a per-status state machine; the same rules drive the
// available actions here: Approved → enable/disable + delete, Rejected → re-approve +
// delete, Waiting Approval with email → approve/reject/delete, without email → delete only.
function actionsFor(merchant) {
  if (merchant.status === 'Approved') return ['toggle', 'delete']
  if (merchant.status === 'Rejected') return ['approve', 'delete']
  if (!merchant.email) return ['no-email', 'delete']
  return ['approve', 'reject', 'delete']
}

export default function Merchants() {
  const dispatch = useDispatch()
  const [term, setTerm] = useState('')
  const searching = term.trim().length >= 2
  const [page, setPage] = useState(1)

  const list = useMerchantsQuery({ page, limit: LIMIT }, { skip: searching })
  const search = useSearchMerchantsQuery(term, { skip: !searching })

  const [approveMerchant, approveState] = useApproveMerchantMutation()
  const [rejectMerchant, rejectState] = useRejectMerchantMutation()
  const [setMerchantActive] = useSetMerchantActiveMutation()
  const [deleteMerchant, deleteState] = useDeleteMerchantMutation()

  const [pendingId, setPendingId] = useState(null)
  const [confirming, setConfirming] = useState(null) // { merchant, type }

  const active = searching ? search : list
  const merchants = searching ? search.data?.merchants || [] : list.data?.merchants || []
  const { isLoading, isError, error, refetch, isFetching } = active

  const count = searching ? merchants.length : list.data?.count ?? merchants.length
  const totalPages = searching ? 1 : list.data?.totalPages || 1
  const currentPage = searching ? 1 : list.data?.currentPage || page

  const onSearch = (value) => {
    setTerm(value)
    setPage(1)
  }

  const runAction = async (merchant, type) => {
    setPendingId(merchant._id)
    try {
      if (type === 'approve') {
        await approveMerchant(merchant._id).unwrap()
        dispatch(
          toastShown({
            type: 'success',
            message: `${merchant.name} approved — the merchant account and brand were created`
          })
        )
      } else if (type === 'reject') {
        await rejectMerchant(merchant._id).unwrap()
        dispatch(toastShown({ type: 'success', message: `${merchant.name} rejected` }))
      } else {
        await deleteMerchant(merchant._id).unwrap()
        dispatch(toastShown({ type: 'success', message: `${merchant.name} deleted` }))
      }
      setConfirming(null)
    } catch (requestError) {
      dispatch(toastShown({ type: 'error', message: apiErrorMessage(requestError, 'The action failed.') }))
    } finally {
      setPendingId(null)
    }
  }

  const toggleActive = async (merchant) => {
    setPendingId(merchant._id)
    try {
      await setMerchantActive({ id: merchant._id, isActive: !merchant.isActive }).unwrap()
      dispatch(
        toastShown({
          type: 'success',
          message: merchant.isActive
            ? `${merchant.name} disabled — brand and access revoked`
            : `${merchant.name} enabled`
        })
      )
    } catch (requestError) {
      dispatch(toastShown({ type: 'error', message: apiErrorMessage(requestError, 'Could not change the status.') }))
    } finally {
      setPendingId(null)
    }
  }

  const confirmCopy = {
    approve: {
      title: 'Approve merchant',
      confirmLabel: 'Approve',
      tone: 'primary',
      body: 'Approving creates the merchant account and a brand, sets the account active and emails an invite link so the merchant can set a password.'
    },
    reject: {
      title: 'Reject merchant',
      confirmLabel: 'Reject',
      tone: 'secondary',
      body: 'The application is marked as rejected. The applicant keeps its current active state.'
    },
    delete: {
      title: 'Delete merchant',
      confirmLabel: 'Delete merchant',
      tone: 'danger',
      body: 'The merchant record is deleted and its brand is deactivated. The linked user account stays in the users list.'
    }
  }[confirming?.type] || {}

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="People"
        title="Merchants"
        meta={<ResultMeta count={count} label={count === 1 ? 'merchant' : 'merchants'} />}
        description="Applications and active suppliers. Approving an application creates the login and the brand it sells under."
      />

      <Toolbar className="justify-between">
        <SearchInput
          onChange={onSearch}
          placeholder="Search email, phone, brand or status…"
          pending={searching && isFetching}
        />
        {searching && <p className="text-xs text-ink-500">Server search — results are not paginated.</p>}
      </Toolbar>

      <TableShell tableClassName="min-w-[64rem]">
        <thead>
          <tr>
            <Th>Merchant</Th>
            <Th>Business</Th>
            <Th>Brand</Th>
            <Th>Status</Th>
            <Th>Requested</Th>
            <Th className="text-right">Actions</Th>
          </tr>
        </thead>
        <tbody>
          {isLoading && <TableLoading colSpan={6} />}
          {isError && (
            <TableMessage
              colSpan={6}
              title="Merchants could not be loaded"
              description={apiErrorMessage(error)}
              action={
                <Button variant="outline" size="sm" className="mt-2" onClick={refetch}>
                  Try again
                </Button>
              }
            />
          )}
          {!isLoading && !isError && merchants.length === 0 && (
            <TableMessage
              colSpan={6}
              icon={Store}
              title={searching ? `No merchant matches “${term}”` : 'No merchants found'}
              description={
                searching
                  ? 'Try an email address, phone number, brand or status.'
                  : 'Applications submitted from the “Sell with us” page land here.'
              }
            />
          )}
          {!isLoading &&
            !isError &&
            merchants.map((merchant) => {
              const actions = actionsFor(merchant)
              return (
                <tr key={merchant._id} className="transition-colors hover:bg-ink-50/70">
                  <Td>
                    <div className="flex items-center gap-3">
                      <Avatar name={merchant.name} />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-ink-900">{merchant.name}</p>
                        {merchant.email ? (
                          <p className="truncate text-xs text-ink-500">{merchant.email}</p>
                        ) : (
                          <p className="truncate text-xs text-amber-600">no email on file</p>
                        )}
                        {merchant.phoneNumber && (
                          <p className="truncate font-mono text-xs text-ink-500">{merchant.phoneNumber}</p>
                        )}
                      </div>
                    </div>
                  </Td>
                  <Td className="max-w-xs">
                    <p className="line-clamp-2 text-sm text-ink-600">{merchant.business}</p>
                  </Td>
                  <Td>
                    <p className="text-sm text-ink-700">{merchant.brandName || '—'}</p>
                    {merchant.brand && (
                      <p className="truncate text-xs text-ink-500">
                        linked: {merchant.brand.name}
                        {merchant.brand.isActive === false && ' (inactive)'}
                      </p>
                    )}
                  </Td>
                  <Td>
                    <div className="flex flex-col items-start gap-1.5">
                      <StatusBadge status={merchant.status} />
                      {merchant.status === 'Approved' && (
                        <ActiveToggle
                          active={merchant.isActive !== false}
                          loading={pendingId === merchant._id}
                          onChange={() => toggleActive(merchant)}
                        />
                      )}
                      {merchant.status !== 'Approved' && merchant.isActive === true && (
                        <Badge tone="neutral">account active</Badge>
                      )}
                    </div>
                  </Td>
                  <Td className="text-sm whitespace-nowrap text-ink-500">{shortDate(merchant.created)}</Td>
                  <Td>
                    <div className="flex items-center justify-end gap-1">
                      {actions.includes('approve') && (
                        <IconButton
                          label={merchant.status === 'Rejected' ? `Re-approve ${merchant.name}` : `Approve ${merchant.name}`}
                          className="hover:bg-emerald-50 hover:text-emerald-700"
                          disabled={pendingId === merchant._id}
                          onClick={() => setConfirming({ merchant, type: 'approve' })}
                        >
                          {merchant.status === 'Rejected' ? <RotateCcw size={16} /> : <CircleCheck size={16} />}
                        </IconButton>
                      )}
                      {actions.includes('reject') && (
                        <IconButton
                          label={`Reject ${merchant.name}`}
                          className="hover:bg-amber-50 hover:text-amber-700"
                          disabled={pendingId === merchant._id}
                          onClick={() => setConfirming({ merchant, type: 'reject' })}
                        >
                          <CircleX size={16} />
                        </IconButton>
                      )}
                      {actions.includes('no-email') && (
                        <a
                          href={`tel:${merchant.phoneNumber}`}
                          className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 px-3 py-1.5 text-xs font-medium text-ink-700 hover:bg-ink-50"
                        >
                          <Phone size={13} /> Call applicant
                        </a>
                      )}
                      {actions.includes('delete') && (
                        <IconButton
                          label={`Delete ${merchant.name}`}
                          className="hover:bg-brand-50 hover:text-brand-700"
                          disabled={pendingId === merchant._id}
                          onClick={() => setConfirming({ merchant, type: 'delete' })}
                        >
                          <Trash2 size={16} />
                        </IconButton>
                      )}
                    </div>
                  </Td>
                </tr>
              )
            })}
        </tbody>
      </TableShell>

      {!isLoading && !isError && !searching && (
        <TableFooter
          page={currentPage}
          totalPages={totalPages}
          count={count}
          limit={LIMIT}
          onPage={setPage}
          unit={count === 1 ? 'merchant' : 'merchants'}
        />
      )}

      <ConfirmDialog
        open={Boolean(confirming)}
        onClose={() => setConfirming(null)}
        onConfirm={() => runAction(confirming.merchant, confirming.type)}
        loading={approveState.isLoading || rejectState.isLoading || deleteState.isLoading}
        title={confirmCopy.title}
        confirmLabel={confirmCopy.confirmLabel}
        tone={confirmCopy.tone}
        description={
          <>
            <p>
              <span className="font-medium text-ink-900">{confirming?.merchant?.name}</span>
              {confirming?.merchant?.brandName ? ` — ${confirming.merchant.brandName}` : ''}
            </p>
            <p className="text-xs text-ink-500">{confirmCopy.body}</p>
          </>
        }
      />
    </div>
  )
}
