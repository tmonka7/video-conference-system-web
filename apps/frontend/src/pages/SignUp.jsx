import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/lib/api';
import { Button, Input } from '@/components/ui';
import { VideoIcon } from '@/components/icons';

export default function SignUp() {
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const update = (field) => (event) =>
    setForm((current) => ({ ...current, [field]: event.target.value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrors({});
    setMessage('');

    if (form.password !== form.confirm) {
      setErrors({ confirm: ['The passwords do not match'] });
      return;
    }

    setSubmitting(true);
    try {
      await signUp({ name: form.name, email: form.email, password: form.password });
      navigate('/app', { replace: true });
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.details ?? {});
        setMessage(error.message);
      } else {
        setMessage('Could not reach the server. Is the API running?');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex h-full items-center justify-center bg-slate-100 px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-white">
            <VideoIcon className="h-6 w-6" />
          </span>
          <span className="text-xl font-bold text-slate-900">Video Conferencing</span>
        </div>

        <div className="card p-8">
          <h1 className="text-3xl font-extrabold text-slate-900">Create account</h1>
          <p className="mt-2 text-slate-500">Start hosting meetings in a minute.</p>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit} noValidate>
            <Input
              label="Full name"
              name="name"
              autoComplete="name"
              placeholder="Alex Chen"
              value={form.name}
              onChange={update('name')}
              error={errors.name?.[0]}
              required
            />
            <Input
              label="Email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="user@company.com"
              value={form.email}
              onChange={update('email')}
              error={errors.email?.[0]}
              required
            />
            <Input
              label="Password"
              name="password"
              type="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              value={form.password}
              onChange={update('password')}
              error={errors.password?.[0]}
              hint="Must contain a letter and a number."
              required
            />
            <Input
              label="Confirm password"
              name="confirm"
              type="password"
              autoComplete="new-password"
              value={form.confirm}
              onChange={update('confirm')}
              error={errors.confirm?.[0]}
              required
            />

            {message && (
              <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                {message}
              </p>
            )}

            <Button type="submit" size="lg" className="w-full" loading={submitting}>
              Create account
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-slate-500">
          Already have an account?{' '}
          <Link to="/signin" className="font-semibold text-brand-600 hover:text-brand-700">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
