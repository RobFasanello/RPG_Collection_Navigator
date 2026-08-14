import { Link } from 'react-router';
import AdminLayout from '../components/AdminLayout';
import { SETUP_GROUPS } from '../home/setupGroups';

export default function SetupLandingPage() {
  return (
    <AdminLayout title="Setup" subtitle="Setup section mirrors your database schema, not your mental model.">
      <div className="mx-auto max-w-6xl space-y-5 p-6">
        <div className="grid gap-4 lg:grid-cols-2">
          {SETUP_GROUPS.map((group) => (
            <section key={group.title} className="rounded-xl border border-[var(--arcane-border-light)] bg-[var(--arcane-paper)] p-5 shadow-sm">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-[var(--arcane-ink-900)]">{group.title}</h2>
                <p className="text-sm text-[var(--arcane-ink-soft)]">{group.description}</p>
              </div>

              <div className="space-y-2">
                {group.items.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className="block rounded-lg border border-transparent bg-[var(--arcane-paper-raised)] px-4 py-3 shadow-sm transition hover:border-[var(--arcane-gold-500)]/50 hover:bg-[var(--arcane-gold-soft)]"
                  >
                    <div className="text-sm font-semibold text-[var(--arcane-ink-900)]">{item.label}</div>
                    <div className="text-sm text-[var(--arcane-ink-soft)]">{item.description}</div>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}
