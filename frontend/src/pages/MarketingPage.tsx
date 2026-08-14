import { Link, Navigate, useSearchParams } from 'react-router';
import { useAppMode } from '../context/AppModeContext';

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  access_denied: "Your account isn't set up yet. Ask an administrator to add you.",
  login_failed: 'Sign-in failed. Please try again.',
};

const FEATURE_BLOCKS = [
  {
    title: 'Capture every title',
    description: 'Store books, boxes, and expansions with rich metadata that stays easy to filter later.',
    image: '/marketing/item-master.png',
    imageAlt: 'The Item Master screen listing Starfinder rulebooks with publisher, collection, category, and product ID columns',
    span: 'lg:col-span-7',
  },
  {
    title: 'Follow each order',
    description: 'Track store, invoice, and line items from checkout through arrival, with no spreadsheet cleanup.',
    image: '/marketing/order-master.png',
    imageAlt: 'The Order Master screen listing purchase orders with store, status, item count, and total amount',
    span: 'lg:col-span-5',
  },
  {
    title: 'Share with your group',
    description: 'Grant read, update, or admin permissions so everyone can use the same trusted catalog.',
    image: '/marketing/users-setup.png',
    imageAlt: 'The Users setup screen granting an update-level access mode to a new email address',
    span: 'lg:col-span-4',
  },
  {
    title: 'Search on demand',
    description: 'Global search surfaces records fast, even when your collection crosses thousands of entries.',
    image: '/marketing/global-search.png',
    imageAlt: 'The global search results panel showing 23 matches for "dragon" across inventory items',
    span: 'lg:col-span-8',
  },
];

const WORKFLOW_ITEMS = [
  {
    title: 'Add Records',
    description: 'Create entries for items, miniatures, and terrain with consistent fields from day one.',
  },
  {
    title: 'Link Purchases',
    description: 'Connect order details to collection rows to see what arrived and what is still pending.',
  },
  {
    title: 'Review Coverage',
    description: 'Use dashboard totals and breakdowns to spot missing runs, duplicate buys, and gaps.',
  },
];

export default function MarketingPage() {
  const { isLoading, isAuthenticated, name, logout } = useAppMode();
  const [searchParams, setSearchParams] = useSearchParams();
  const authError = searchParams.get('authError');
  const authErrorMessage = authError ? AUTH_ERROR_MESSAGES[authError] ?? 'Sign-in failed. Please try again.' : null;

  const clearAuthError = () => {
    if (authError) {
      const next = new URLSearchParams(searchParams);
      next.delete('authError');
      setSearchParams(next, { replace: true });
    }
  };

  if (!isLoading && isAuthenticated) {
    return <Navigate to="/home" replace />;
  }

  return (
    <div className="theme-dark min-h-[100dvh] bg-[var(--arcane-ink-950)] text-[var(--arcane-ivory)]">
      <header className="sticky top-0 z-40 border-b border-[#3d2e1fcc] bg-[#120f13e6] backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <img src="/favicon.png" alt="Arcane Repository mark" className="h-9 w-9 rounded-md object-contain ring-1 ring-[#9c6a3299]" />
            <span className="text-lg font-semibold tracking-[0.02em] text-[var(--arcane-ivory)]">
              Arcane Repository
            </span>
          </div>

          <nav className="hidden items-center gap-6 text-sm font-medium text-[var(--arcane-sand)] lg:flex">
            <a href="#features" className="transition hover:text-[var(--arcane-ivory)]">
              Features
            </a>
            <a href="#workflow" className="transition hover:text-[var(--arcane-ivory)]">
              Workflow
            </a>
            {!isLoading && isAuthenticated ? (
              <div className="flex items-center gap-3">
                <Link
                  to="/home"
                  className="transition hover:text-[var(--arcane-ivory)]"
                >
                  Open App
                </Link>
                <span className="text-sm font-normal text-[#b9ae9d]/80">
                  Signed in as <span className="font-semibold text-[var(--arcane-ivory)]">{name}</span>
                </span>
                <button
                  type="button"
                  onClick={() => logout()}
                  className="rounded-xl border border-[var(--arcane-line)] bg-[var(--arcane-ink-800)] px-4 py-2 text-sm font-semibold text-[var(--arcane-ivory)] transition hover:border-[var(--arcane-gold-500)] hover:text-[var(--arcane-gold-300)]"
                >
                  Log Out
                </button>
              </div>
            ) : (
              <a
                href="/api/auth/login"
                className="rounded-xl border border-[var(--arcane-gold-500)] bg-[#b886481a] px-4 py-2 text-sm font-semibold text-[var(--arcane-ivory)] transition hover:bg-[var(--arcane-gold-500)] hover:text-[var(--arcane-ink-950)]"
              >
                Sign In
              </a>
            )}
          </nav>

          {!isLoading && isAuthenticated ? (
            <Link
              to="/home"
              className="rounded-xl border border-[var(--arcane-gold-500)] bg-[var(--arcane-gold-500)] px-4 py-2 text-sm font-semibold text-[var(--arcane-ink-950)] transition hover:bg-[var(--arcane-gold-300)] lg:hidden"
            >
              Open App
            </Link>
          ) : null}
        </div>
      </header>

      <main>
        {authErrorMessage ? (
          <section className="border-b border-red-900/60 bg-red-950/50">
            <div className="mx-auto flex w-full max-w-[1400px] items-start justify-between gap-4 px-6 py-4 text-sm text-red-200">
              <span>{authErrorMessage}</span>
              <button
                type="button"
                onClick={clearAuthError}
                className="shrink-0 rounded border border-red-800/80 px-2 py-1 text-red-100 transition hover:border-red-500 hover:text-white"
              >
                Dismiss
              </button>
            </div>
          </section>
        ) : null}

        <section className="relative overflow-hidden border-b border-[#3d2e1fcc] bg-[var(--arcane-ink-900)]">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(circle at 18% 18%, rgba(184,134,72,0.2), transparent 40%), radial-gradient(circle at 82% 8%, rgba(184,134,72,0.12), transparent 34%)',
            }}
            aria-hidden="true"
          />
          <div className="relative mx-auto grid w-full max-w-[1400px] gap-10 px-6 py-16 lg:grid-cols-12 lg:items-center lg:py-20">
            <div className="lg:col-span-6">
              <h1 className="max-w-xl text-4xl font-semibold leading-[1.02] text-[var(--arcane-ivory-bright)] sm:text-5xl lg:text-6xl">
                One place for
                <br />
                every piece you play.
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-[var(--arcane-sand)]">
                Track books, miniatures, terrain, and orders in one searchable hub for every campaign you run.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                {!isLoading && isAuthenticated ? (
                  <Link
                    to="/home"
                    className="inline-flex items-center justify-center rounded-xl border border-[var(--arcane-gold-500)] bg-[var(--arcane-gold-500)] px-6 py-3.5 text-sm font-semibold text-[var(--arcane-ink-950)] transition hover:bg-[var(--arcane-gold-300)]"
                  >
                    Open App
                  </Link>
                ) : (
                  <a
                    href="/api/auth/login"
                    className="inline-flex items-center justify-center rounded-xl border border-[var(--arcane-gold-500)] bg-[var(--arcane-gold-500)] px-6 py-3.5 text-sm font-semibold text-[var(--arcane-ink-950)] transition hover:bg-[var(--arcane-gold-300)]"
                  >
                    Sign In
                  </a>
                )}
                <a
                  href="#features"
                  className="inline-flex items-center justify-center rounded-xl border border-[var(--arcane-line)] bg-[var(--arcane-ink-800)] px-6 py-3.5 text-sm font-semibold text-[var(--arcane-ivory)] transition hover:border-[var(--arcane-gold-500)] hover:text-[var(--arcane-gold-300)]"
                >
                  Explore Features
                </a>
              </div>
            </div>

            <div className="lg:col-span-6">
              <figure className="overflow-hidden rounded-2xl border border-[#4c3926] bg-[var(--arcane-ink-950)]">
                <img
                  src="/marketing/dashboard.png"
                  alt="The Coverage Metrics dashboard showing publisher, collection, and category totals across the repository"
                  className="h-[300px] w-full object-cover object-top sm:h-[360px] lg:h-[460px]"
                  loading="eager"
                />
              </figure>
            </div>
          </div>
        </section>

        <section className="border-b border-[var(--arcane-ink-700)] bg-[var(--arcane-ink-950)] h-3" aria-hidden="true" />

        <section id="features" className="border-b border-[var(--arcane-ink-700)] bg-[var(--arcane-ink-800)]">
          <div className="mx-auto w-full max-w-[1400px] px-6 py-20">
            <h2 className="max-w-2xl text-3xl font-semibold text-[var(--arcane-ivory-bright)] sm:text-4xl">
              Collection management that stays clear as your catalog grows.
            </h2>
            <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-12">
              {FEATURE_BLOCKS.map((feature) => (
                <article
                  key={feature.title}
                  className={`${feature.span} overflow-hidden rounded-2xl border border-[var(--arcane-line)] bg-[var(--arcane-ink-950)]`}
                >
                  <img
                    src={feature.image}
                    alt={feature.imageAlt}
                    className="h-48 w-full object-cover object-top sm:h-56"
                    loading="lazy"
                  />
                  <div className="p-6">
                    <h3 className="text-xl font-semibold text-[var(--arcane-ivory-bright)]">{feature.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-[var(--arcane-sand)]">{feature.description}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="workflow" className="border-b border-[var(--arcane-ink-700)] bg-[var(--arcane-ink-900)]">
          <div className="mx-auto w-full max-w-[1400px] px-6 py-20">
            <div className="grid gap-10 lg:grid-cols-12 lg:items-start">
              <div className="lg:col-span-5">
                <h2 className="text-3xl font-semibold text-[var(--arcane-ivory-bright)] sm:text-4xl">
                  A workflow built for campaign prep.
                </h2>
                <p className="mt-3 max-w-md text-base leading-relaxed text-[var(--arcane-sand)]">
                  Start with fast entry, add purchases as they happen, then review totals before each game night.
                </p>
                <figure className="mt-6 overflow-hidden rounded-2xl border border-[var(--arcane-line)]">
                  <img
                    src="/marketing/miniatures.png"
                    alt="The Miniature Master screen listing painted miniature records with size, rarity, quantity, and location"
                    className="h-60 w-full object-cover object-top"
                    loading="lazy"
                  />
                </figure>
              </div>

              <div className="lg:col-span-7">
                <div className="grid gap-4 sm:grid-cols-2">
                  {WORKFLOW_ITEMS.map((item) => (
                    <article key={item.title} className="rounded-2xl border border-[var(--arcane-line)] bg-[var(--arcane-ink-800)] p-6">
                      <h3 className="text-lg font-semibold text-[var(--arcane-ivory-bright)]">{item.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-[var(--arcane-sand)]">{item.description}</p>
                    </article>
                  ))}
                  <article className="rounded-2xl border border-[var(--arcane-gold-600)] bg-[#b8864817] p-6 sm:col-span-2">
                    <h3 className="text-lg font-semibold text-[var(--arcane-ivory-bright)]">Keep every list in sync</h3>
                    <p className="mt-2 text-sm leading-relaxed text-[var(--arcane-sand)]">
                      With one source of truth, your table stops losing track of what is owned, painted, or still on order.
                    </p>
                  </article>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-[var(--arcane-ink-800)]">
          <div className="mx-auto grid w-full max-w-[1400px] gap-8 px-6 py-16 sm:grid-cols-[1fr_auto] sm:items-center">
            <div>
              <h2 className="text-2xl font-semibold text-[var(--arcane-ivory-bright)] sm:text-3xl">
                Ready to catalog your next haul?
              </h2>
              <p className="mt-2 max-w-xl text-[var(--arcane-sand)]">
                Sign in with Google and start organizing your library in minutes.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {!isLoading && isAuthenticated ? (
                <Link
                  to="/home"
                  className="inline-flex items-center justify-center rounded-xl border border-[var(--arcane-gold-500)] bg-[var(--arcane-gold-500)] px-6 py-3.5 text-sm font-semibold text-[var(--arcane-ink-950)] transition hover:bg-[var(--arcane-gold-300)]"
                >
                  Open App
                </Link>
              ) : null}
              <a
                href="/api/auth/login"
                className="inline-flex items-center justify-center rounded-xl border border-[var(--arcane-line)] bg-[var(--arcane-ink-900)] px-6 py-3.5 text-sm font-semibold text-[var(--arcane-ivory)] transition hover:border-[var(--arcane-gold-500)] hover:text-[var(--arcane-gold-300)]"
              >
                Sign In
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--arcane-ink-700)] bg-[var(--arcane-ink-950)]">
        <div className="mx-auto flex w-full max-w-[1400px] flex-col items-center gap-4 px-6 py-10 text-sm text-[var(--arcane-sand)] sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2">
            <img src="/favicon.png" alt="Arcane Repository mark" className="h-6 w-6 rounded-sm object-contain opacity-80" />
            <span className="font-semibold text-[var(--arcane-ivory)]">Arcane Repository</span>
          </div>
          <span>Catalog your tabletop world with clarity.</span>
        </div>
      </footer>
    </div>
  );
}
