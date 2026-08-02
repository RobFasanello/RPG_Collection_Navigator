import { Link } from 'react-router';
import AdminLayout from '../components/AdminLayout';
import { SETUP_GROUPS } from '../home/setupGroups';

export default function SetupLandingPage() {
  return (
    <AdminLayout title="Setup" subtitle="Setup section mirrors your database schema, not your mental model.">
      <div className="mx-auto max-w-6xl space-y-5 p-6">
        <div className="grid gap-4 lg:grid-cols-2">
          {SETUP_GROUPS.map((group) => (
            <section key={group.title} className="rounded-xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-slate-900">{group.title}</h2>
                <p className="text-sm text-slate-500">{group.description}</p>
              </div>

              <div className="space-y-2">
                {group.items.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className="block rounded-lg border border-transparent bg-white px-4 py-3 shadow-sm transition hover:border-sky-200 hover:bg-sky-50"
                  >
                    <div className="text-sm font-semibold text-slate-900">{item.label}</div>
                    <div className="text-sm text-slate-500">{item.description}</div>
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
