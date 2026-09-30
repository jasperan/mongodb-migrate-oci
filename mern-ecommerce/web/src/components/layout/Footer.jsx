import { Link } from 'react-router-dom'
import { Code2, Mail, MapPin, Phone } from 'lucide-react'
import { useDispatch } from 'react-redux'
import { useState } from 'react'
import { Button } from '../ui/Button'
import { Input } from '../ui/Field'
import { useSubscribeNewsletterMutation } from '../../features/manager/managerApi'
import { toastShown } from '../../features/ui/uiSlice'

export function Footer() {
  const dispatch = useDispatch()
  const [email, setEmail] = useState('')
  const [subscribe, { isLoading }] = useSubscribeNewsletterMutation()

  const onSubmit = async (event) => {
    event.preventDefault()
    if (!email.trim()) return
    try {
      await subscribe(email.trim()).unwrap()
      dispatch(toastShown({ type: 'success', message: 'Thanks — you are on the list.' }))
      setEmail('')
    } catch {
      dispatch(toastShown({ type: 'error', message: 'Could not subscribe right now.' }))
    }
  }

  return (
    <footer className="mt-20 bg-ink-950 text-ink-300">
      <div className="container-page grid gap-10 py-14 md:grid-cols-4">
        <div className="md:col-span-1">
          <div className="mb-3 flex items-center gap-2 text-white">
            <span className="grid size-9 place-items-center rounded-xl bg-brand-600 font-display text-sm font-bold">M</span>
            <span className="font-display text-lg">MERN Store</span>
          </div>
          <p className="text-sm leading-relaxed text-ink-400">
            Everything you need, at prices you will like — electronics, home, fashion, food and more, shipped free over
            $100 and backed by 30-day returns.
          </p>
        </div>

        <div>
          <h3 className="mb-3 text-xs font-semibold tracking-widest text-white uppercase">Shop</h3>
          <ul className="space-y-2 text-sm">
            <li><Link to="/shop" className="hover:text-white">All products</Link></li>
            <li><Link to="/brands" className="hover:text-white">Brands</Link></li>
            <li><Link to="/sell" className="hover:text-white">Sell with us</Link></li>
            <li><Link to="/support/llm-chat" className="hover:text-white">AI assistant</Link></li>
            <li><Link to="/support" className="hover:text-white">Live support</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="mb-3 text-xs font-semibold tracking-widest text-white uppercase">Support</h3>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center gap-2"><Phone size={14} /> 951-999-9999</li>
            <li className="flex items-center gap-2"><Mail size={14} /> support@mern.store</li>
            <li className="flex items-center gap-2"><MapPin size={14} /> 1 Market Street, San Francisco</li>
            <li>
              <Link to="/contact" className="inline-flex items-center gap-2 hover:text-white">
                <Code2 size={14} /> Contact us
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="mb-3 text-xs font-semibold tracking-widest text-white uppercase">Newsletter</h3>
          <p className="mb-3 text-sm text-ink-400">New arrivals, weekly deals and members-only offers.</p>
          <form onSubmit={onSubmit} className="flex gap-2">
            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className="border-ink-700 bg-ink-900 text-white placeholder:text-ink-500"
              aria-label="Email address"
            />
            <Button type="submit" loading={isLoading} size="md">
              Join
            </Button>
          </form>
        </div>
      </div>

      <div className="border-t border-ink-800 py-5 text-center text-xs text-ink-500">
        © {new Date().getFullYear()} MERN Store · Free shipping over $100 · 30-day returns
      </div>
    </footer>
  )
}
