import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '@/lib/api';
import { Button, Input } from '@/components/ui';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const result = await authApi.forgotPassword(email);
      setSent(result);
    } catch {
      // The endpoint answers the same way either way; treat failures as sent.
      setSent({ message: 'If an account exists for that email, a reset link has been sent.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex h-full items-center justify-center bg-slate-100 px-6">
      <div className="card w-full max-w-md p-8">
        <h1 className="text-2xl font-extrabold text-slate-900">Reset your password</h1>

        {sent ? (
          <div className="mt-6 space-y-4">
            <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {sent.message}
            </p>
            {sent.token && (
              <p className="break-all rounded-xl bg-slate-100 px-4 py-3 text-xs text-slate-600">
                Development only — no mail is sent yet, so here is the token:
                <br />
                <code className="font-mono">{sent.token}</code>
              </p>
            )}
            <Link to="/signin" className="text-sm font-semibold text-brand-600">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
            <p className="text-sm text-slate-500">
              Enter the email on your account and we will send a reset link.
            </p>
            <Input
              label="Email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <Button type="submit" className="w-full" loading={submitting}>
              Send reset link
            </Button>
            <Link to="/signin" className="block text-center text-sm font-semibold text-brand-600">
              Back to sign in
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
