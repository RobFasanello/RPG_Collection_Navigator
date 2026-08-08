import { useSearchParams } from 'react-router';

const ERROR_MESSAGES: Record<string, string> = {
  access_denied: "Your account isn't set up yet — ask an administrator to add you.",
  login_failed: 'Sign-in failed. Please try again.',
};

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const authError = searchParams.get('authError');
  const errorMessage = authError ? ERROR_MESSAGES[authError] ?? 'Sign-in failed. Please try again.' : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-300 bg-white p-8 text-center shadow-sm">
        <img src="/favicon.png" alt="Arcane Library" className="mx-auto h-16 w-16 rounded-md object-contain" />
        <h1 className="mt-4 text-xl font-bold text-slate-900">Arcane Repository</h1>
        <p className="mt-1 text-sm text-slate-500">Sign in to view your collection.</p>

        {errorMessage && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {errorMessage}
          </div>
        )}

        <a
          href="/api/auth/login"
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700"
        >
          Sign in with Google
        </a>
      </div>
    </div>
  );
}
