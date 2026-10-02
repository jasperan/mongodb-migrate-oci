import { useState } from 'react'
import { Users as UsersIcon } from 'lucide-react'
import { Badge } from '../../components/ui/Display'
import { Button } from '../../components/ui/Button'
import {
  Avatar,
  PageHeader,
  ResultMeta,
  RoleBadge,
  SearchInput,
  TableFooter,
  TableLoading,
  TableMessage,
  TableShell,
  Td,
  Th,
  Toolbar,
  useClampPage
} from '../../components/manager'
import { useSearchUsersQuery, useUsersQuery } from '../../features/manager/managerApi'
import { apiErrorMessage } from '../../lib/apiError'
import { shortDate } from '../../lib/format'
import { useDocumentTitle } from '../../lib/useDocumentTitle'

const LIMIT = 20

// `GET /api/user` projects `_id` out of the response, so rows are keyed by email —
// which the User model also treats as unique.
const keyOf = (user, index) => user.email || `user-${index}`

function UserRow({ user }) {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Unnamed user'
  return (
    <tr className="transition-colors hover:bg-ink-50/70">
      <Td>
        <div className="flex items-center gap-3">
          <Avatar name={name} />
          <div className="min-w-0">
            <p className="truncate font-medium text-ink-900">{name}</p>
            <p className="truncate text-xs text-ink-500">{user.email || 'no email on file'}</p>
          </div>
        </div>
      </Td>
      <Td>
        <RoleBadge role={user.role} />
      </Td>
      <Td>
        {user.merchant?.name ? (
          <Badge tone="duality">{user.merchant.name}</Badge>
        ) : (
          <span className="text-ink-400">—</span>
        )}
      </Td>
      <Td className="text-sm text-ink-600">{user.provider || 'Email'}</Td>
      <Td className="text-sm whitespace-nowrap text-ink-500">{shortDate(user.created)}</Td>
    </tr>
  )
}

export default function Users() {
  useDocumentTitle('Users')
  const [term, setTerm] = useState('')
  const searching = term.trim().length >= 2
  const [page, setPage] = useState(1)

  const list = useUsersQuery({ page, limit: LIMIT }, { skip: searching })
  const search = useSearchUsersQuery(term, { skip: !searching })
  useClampPage(page, list.data?.totalPages, setPage)

  const active = searching ? search : list
  const users = searching ? search.data?.users || [] : list.data?.users || []
  const { isLoading, isError, error, refetch, isFetching } = active

  const count = searching ? users.length : list.data?.count ?? users.length
  const totalPages = searching ? 1 : list.data?.totalPages || 1
  const currentPage = searching ? 1 : Math.min(page, totalPages)

  const onSearch = (value) => {
    setTerm(value)
    setPage(1)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="People"
        title="Users"
        meta={<ResultMeta count={count} label={count === 1 ? 'account' : 'accounts'} />}
        description="Every account in the store, newest first. Roles are assigned by the merchant approval flow — this API has no role editor."
      />

      <Toolbar className="justify-between">
        <SearchInput onChange={onSearch} placeholder="Search by name or email…" pending={searching && isFetching} />
        {searching && <p className="text-xs text-ink-500">Server search — results are not paginated.</p>}
      </Toolbar>

      <TableShell tableClassName="min-w-[54rem]">
        <thead>
          <tr>
            <Th>User</Th>
            <Th>Role</Th>
            <Th>Merchant</Th>
            <Th>Provider</Th>
            <Th>Joined</Th>
          </tr>
        </thead>
        <tbody>
          {isLoading && <TableLoading colSpan={5} />}
          {isError && (
            <TableMessage
              colSpan={5}
              title="Users could not be loaded"
              description={apiErrorMessage(error)}
              action={
                <Button variant="outline" size="sm" className="mt-2" onClick={refetch}>
                  Try again
                </Button>
              }
            />
          )}
          {!isLoading && !isError && users.length === 0 && (
            <TableMessage
              colSpan={5}
              icon={UsersIcon}
              title={searching ? `No user matches “${term}”` : 'No users found'}
              description={searching ? 'Try a different name or email address.' : 'Nobody has registered yet.'}
            />
          )}
          {!isLoading && !isError && users.map((user, index) => <UserRow key={keyOf(user, index)} user={user} />)}
        </tbody>
      </TableShell>

      {!isLoading && !isError && !searching && (
        <TableFooter
          page={currentPage}
          totalPages={totalPages}
          count={count}
          limit={LIMIT}
          onPage={setPage}
          unit={count === 1 ? 'account' : 'accounts'}
        />
      )}
    </div>
  )
}
