import { Link } from 'react-router-dom'
import { Database, Search } from 'lucide-react'
import { Badge } from '../../../components/ui/Display'
import { currency } from '../../../lib/format'

const MAX_CHIPS = 8

// `retrieval.source` names the path that found the semantic matches.
function retrievalMode(source) {
  if (source?.startsWith('in-database:')) {
    return { icon: Database, tone: 'duality', label: `In-database vector search · ${source.slice('in-database:'.length)}` }
  }
  if (source?.startsWith('remote:')) {
    return { icon: Database, tone: 'duality', label: `Vector search · ${source.slice('remote:'.length)} embeddings` }
  }
  return { icon: Search, tone: 'warning', label: 'Keyword fallback · no embeddings available' }
}

/**
 * Under an answer: the products it names (each links to its page) and how the
 * catalogue was searched.
 */
export function SourceChips({ retrieval }) {
  if (!retrieval) return null
  const mode = retrievalMode(retrieval.source)
  const products = retrieval.documents.slice(0, MAX_CHIPS)
  const hidden = retrieval.documents.length - products.length
  // The catalogue repeats product names across brands (three "Enamel Mug"s);
  // those chips also name the brand so they can be told apart.
  const repeated = new Set(products.map((product) => product.name).filter((name, index, names) => names.indexOf(name) !== index))

  return (
    <div className="flex flex-col gap-1.5 px-1">
      {products.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Products in this answer">
          {products.map((product) => (
            <li key={product.id}>
              <Link
                to={`/product/${product.slug}`}
                title={[product.brand, product.category, product.inStock ? 'in stock' : 'out of stock'].filter(Boolean).join(' · ')}
                className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-ink-200 bg-white px-2.5 py-1 text-xs text-ink-700 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
              >
                <span className="truncate font-medium">{product.name}</span>
                {repeated.has(product.name) && product.brand && <span className="truncate text-ink-500">{product.brand}</span>}
                <span className="shrink-0 text-ink-500 tabular-nums">{currency(product.price)}</span>
              </Link>
            </li>
          ))}
          {hidden > 0 && <li className="self-center text-xs text-ink-500">+{hidden} more</li>}
        </ul>
      )}
      <Badge tone={mode.tone} className="w-fit max-w-full text-[11px] font-medium">
        <mode.icon size={11} aria-hidden /> <span className="truncate">{mode.label}</span>
      </Badge>
    </div>
  )
}
