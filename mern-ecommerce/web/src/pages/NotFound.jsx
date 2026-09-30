import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { ButtonLink } from '../components/ui/Button'

export default function NotFound() {
  return (
    <div className="container-page flex flex-col items-center gap-4 py-24 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-brand-50 text-brand-700">
        <Compass size={24} />
      </span>
      <h1 className="font-display text-3xl">Page not found</h1>
      <p className="max-w-md text-sm text-ink-500">
        The page you were looking for does not exist or has been moved. The catalogue is still where you left it.
      </p>
      <div className="flex gap-3">
        <ButtonLink to="/">Back to the store</ButtonLink>
        <Link to="/shop" className="inline-flex h-11 items-center rounded-full border border-ink-300 bg-white px-5 text-sm font-medium hover:bg-ink-50">
          Browse products
        </Link>
      </div>
    </div>
  )
}
