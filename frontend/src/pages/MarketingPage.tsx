import { Link } from 'react-router';
import { BookOpen, Dice5, Mountain, Receipt, Package, ClipboardList, Users, ArrowRight } from 'lucide-react';

const FEATURES = [
  {
    icon: Package,
    title: 'Catalog Everything',
    description:
      'Items, miniatures, terrain, and expansions — organized by publisher, collection, and category, with full-text search across your entire library.',
  },
  {
    icon: ClipboardList,
    title: 'Track Every Order',
    description:
      'Link purchases to the items they contain, keep tabs on stores and spend, and always know what’s still on order.',
  },
  {
    icon: Users,
    title: 'Built for Your Table',
    description:
      'Invite your group with Google sign-in and give each person the right level of access — browse, edit, or administer.',
  },
];

const SHOWCASE = [
  { icon: BookOpen, label: 'Items', description: 'Rulebooks, expansions & digital editions' },
  { icon: Dice5, label: 'Miniatures', description: 'Painted, primed, and everything in between' },
  { icon: Mountain, label: 'Terrain', description: 'Every set piece, mapped and counted' },
  { icon: Receipt, label: 'Orders', description: 'Purchase history across every store' },
];

export default function MarketingPage() {
  return (
    <div className="min-h-screen bg-ink-950 text-neutral-200">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-ink-950/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <img src="/favicon.png" alt="" className="h-9 w-9 rounded-sm object-contain" />
            <span className="font-display text-lg font-bold tracking-wide text-neutral-100">
              Arcane Repository
            </span>
          </div>
          <nav className="flex items-center gap-6 text-sm font-bold uppercase tracking-wide">
            <a href="#features" className="text-gold-300 transition hover:text-gold-500">
              Features
            </a>
            <Link
              to="/home"
              className="border border-gold-500 bg-transparent px-4 py-2 text-gold-300 transition hover:bg-gold-500 hover:text-ink-950"
            >
              Sign In
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-white/10">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(circle at 20% 20%, rgba(159,127,89,0.18), transparent 45%), radial-gradient(circle at 80% 0%, rgba(159,127,89,0.12), transparent 40%)',
            }}
            aria-hidden="true"
          />
          <div className="relative mx-auto flex w-full max-w-[1400px] flex-col items-start gap-6 px-6 py-24 sm:py-32">
            <span className="font-bold uppercase tracking-[0.3em] text-gold-500">
              Your Collection, Cataloged
            </span>
            <h1 className="font-display max-w-3xl text-4xl font-black uppercase leading-tight text-neutral-50 sm:text-5xl lg:text-6xl">
              Catalog Your Arcana.
              <br />
              Master Your Library.
            </h1>
            <p className="max-w-xl text-lg text-neutral-400">
              Track every rulebook, miniature, and terrain piece across your collection —
              organized, searchable, and ready for your next session.
            </p>
            <div className="flex flex-wrap items-center gap-4 pt-4">
              <Link
                to="/home"
                className="inline-flex items-center gap-2 border border-gold-500 bg-gold-500 px-6 py-4 text-sm font-bold uppercase tracking-wide text-ink-950 transition hover:bg-gold-600"
              >
                Enter the Repository
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#features"
                className="border border-white/20 bg-ink-900 px-6 py-4 text-sm font-bold uppercase tracking-wide text-neutral-200 transition hover:border-gold-500 hover:text-gold-300"
              >
                See What&rsquo;s Inside
              </a>
            </div>
          </div>
        </section>

        <section id="features" className="border-b border-white/10 bg-ink-900">
          <div className="mx-auto w-full max-w-[1400px] px-6 py-20">
            <h2 className="font-display max-w-2xl text-3xl font-bold uppercase text-neutral-50 sm:text-4xl">
              Push Your Collection, Without the Spreadsheet
            </h2>
            <div className="mt-12 grid gap-8 md:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, description }) => (
                <div key={title} className="border border-white/10 bg-ink-950 p-8">
                  <Icon className="h-8 w-8 text-gold-500" />
                  <h3 className="font-display mt-5 text-xl font-bold text-neutral-50">{title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-neutral-400">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-white/10">
          <div className="mx-auto w-full max-w-[1400px] px-6 py-20">
            <h2 className="font-display text-3xl font-bold uppercase text-neutral-50 sm:text-4xl">
              Everything, In One Place
            </h2>
            <p className="mt-3 max-w-2xl text-neutral-400">
              From core rulebooks to the terrain on your table — every part of your collection
              lives in one searchable repository.
            </p>
            <div className="mt-12 grid gap-px overflow-hidden border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
              {SHOWCASE.map(({ icon: Icon, label, description }) => (
                <div key={label} className="bg-ink-950 p-8 transition hover:bg-ink-900">
                  <Icon className="h-7 w-7 text-gold-300" />
                  <h3 className="font-display mt-4 text-lg font-bold text-neutral-50">{label}</h3>
                  <p className="mt-2 text-sm text-neutral-400">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-ink-900">
          <div className="mx-auto flex w-full max-w-[1400px] flex-col items-start gap-6 px-6 py-20 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-display text-2xl font-bold uppercase text-neutral-50 sm:text-3xl">
                Ready to Open the Vault?
              </h2>
              <p className="mt-2 max-w-lg text-neutral-400">
                Sign in with Google to view or manage your collection.
              </p>
            </div>
            <Link
              to="/home"
              className="inline-flex shrink-0 items-center gap-2 border border-gold-500 bg-gold-500 px-6 py-4 text-sm font-bold uppercase tracking-wide text-ink-950 transition hover:bg-gold-600"
            >
              Enter the Repository
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-ink-950">
        <div className="mx-auto flex w-full max-w-[1400px] flex-col items-center gap-4 px-6 py-10 text-sm text-neutral-500 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2">
            <img src="/favicon.png" alt="" className="h-6 w-6 rounded-sm object-contain opacity-80" />
            <span className="font-display font-bold text-neutral-300">Arcane Repository</span>
          </div>
          <span>A grimoire of your own making.</span>
        </div>
      </footer>
    </div>
  );
}
