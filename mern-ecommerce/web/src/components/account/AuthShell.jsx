import { BadgeCheck, Headphones, Truck } from 'lucide-react'

const POINTS = [
  { Icon: Truck, text: 'Free shipping on every order over $100' },
  { Icon: BadgeCheck, text: '30-day returns and a two-year warranty on electronics' },
  { Icon: Headphones, text: 'Live support, seven days a week' }
]

/**
 * Two-column frame shared by sign-in, sign-up and password flows. On mobile the
 * marketing panel drops below the form so the first screen stays actionable.
 */
export function AuthShell({ eyebrow = 'Your account', title, subtitle, children, footer }) {
  return (
    <div className="container-page py-10 lg:py-16">
      <div className="grid items-start gap-8 lg:grid-cols-[1fr_1.15fr] lg:gap-14">
        <aside className="order-2 lg:order-1">
          <div className="relative overflow-hidden rounded-2xl bg-ink-950 p-7 text-white sm:p-9">
            <div className="pointer-events-none absolute -top-20 -right-16 size-56 rounded-full bg-brand-600/30 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -left-10 size-56 rounded-full bg-duality-600/30 blur-3xl" />
            <div className="relative">
              <span className="eyebrow text-white/60">{eyebrow}</span>
              <h2 className="mt-3 font-display text-2xl leading-tight">
                Shop smarter with MERN Store
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-white/70">
                Millions of products, honest prices and fast delivery — save your favourites and track every order.
              </p>
              <ul className="mt-7 space-y-4">
                {POINTS.map(({ Icon, text }) => (
                  <li key={text} className="flex items-start gap-3 text-sm text-white/80">
                    <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl bg-white/10 text-white">
                      <Icon size={16} />
                    </span>
                    <span className="leading-relaxed">{text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </aside>

        <section className="order-1 card-surface p-6 sm:p-8 lg:order-2">
          <header>
            <h1 className="font-display text-2xl">{title}</h1>
            {subtitle && <p className="mt-1.5 text-sm text-ink-500">{subtitle}</p>}
          </header>
          <div className="mt-6">{children}</div>
          {footer && <div className="mt-6 border-t border-ink-200 pt-5 text-sm text-ink-600">{footer}</div>}
        </section>
      </div>
    </div>
  )
}
