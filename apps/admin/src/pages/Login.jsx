import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button, Card, Input } from '@/components/ui';

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ identifier: '', password: '' });
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage('');
    setSubmitting(true);

    try {
      await signIn(form);
      navigate('/', { replace: true });
    } catch (error) {
      setMessage(error.message ?? 'Could not sign in');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-full items-center justify-center bg-navy-950 px-4 py-12">
      <Card className="w-full max-w-md p-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">Admin Panel</p>
        <h1 className="mt-1 text-2xl font-extrabold text-slate-900">Sign in</h1>
        <p className="mt-2 text-sm text-slate-500">
          Administrator accounts only. Everyone else should use the web app.
        </p>
        {import.meta.env.DEV && (
          <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Demo login: admin@company.com / Password123. Run <code>npm run seed</code> first.
          </p>
        )}

        <form className="mt-8 space-y-5" onSubmit={handleSubmit} noValidate>
          <Input
            label="Email or phone"
            name="identifier"
            type="text"
            autoComplete="username"
            placeholder="admin@company.com"
            value={form.identifier}
            onChange={(event) => setForm({ ...form, identifier: event.target.value })}
            required
          />
          <Input
            label="Password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
            required
          />

          {message && (
            <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {message}
            </p>
          )}

          <Button type="submit" size="lg" className="w-full" loading={submitting}>
            Sign in
          </Button>
        </form>
      </Card>
    </div>
  );
}
