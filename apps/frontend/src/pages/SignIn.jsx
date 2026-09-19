import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/lib/api';
import { Button, Input } from '@/components/ui';
import { EyeIcon, EyeOffIcon, VideoIcon } from '@/components/icons';

/** Screen 2: "Welcome Back" — the split sign-in with the office photo. */
export default function SignIn() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState({ identifier: '', password: '', rememberMe: false });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const update = (field) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrors({});
    setMessage('');
    setSubmitting(true);

    try {
      await signIn(form);
      // Send people back to whatever they were trying to reach.
      navigate(location.state?.from ?? '/app', { replace: true });
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
    <div className="grid h-full lg:grid-cols-2">
      <div className="flex items-center justify-center bg-white px-6 py-12 sm:px-12">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-white">
              <VideoIcon className="h-6 w-6" />
            </span>
            <span>
              <span className="block text-xl font-bold text-slate-900">Video Conferencing</span>
              <span className="block text-sm text-slate-500">&amp; Audio</span>
            </span>
          </div>

          <h1 className="mt-10 text-4xl font-extrabold text-slate-900">Welcome Back</h1>
          <p className="mt-2 text-slate-500">Sign in to your account</p>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit} noValidate>
            <Input
              label="Email or phone number"
              name="identifier"
              autoComplete="username"
              placeholder="user@company.com"
              value={form.identifier}
              onChange={update('identifier')}
              error={errors.identifier?.[0]}
              required
            />

            <div>
              <label className="label" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  className="field pr-12"
                  value={form.password}
                  onChange={update('password')}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-600"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1.5 text-sm text-red-600">{errors.password[0]}</p>
              )}
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  checked={form.rememberMe}
                  onChange={update('rememberMe')}
                />
                Remember me
              </label>
              <Link
                to="/forgot-password"
                className="text-sm font-semibold text-brand-600 hover:text-brand-700"
              >
                Forgot password?
              </Link>
            </div>

            {message && (
              <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                {message}
              </p>
            )}

            <Button type="submit" size="lg" className="w-full" loading={submitting}>
              Sign In
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-slate-500">
            Don&apos;t have an account?{' '}
            <Link to="/signup" className="font-semibold text-brand-600 hover:text-brand-700">
              Sign Up
            </Link>
          </p>
        </div>
      </div>

      {/* Decorative panel; hidden on small screens where the form needs the room. */}
      <div className="relative hidden bg-gradient-to-br from-brand-600 to-navy-900 lg:block">
        <svg
          className="absolute inset-0 h-full w-full opacity-20"
          viewBox="0 0 400 400"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
        >
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M40 0H0v40" fill="none" stroke="white" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="400" height="400" fill="url(#grid)" />
        </svg>
        <div className="relative flex h-full flex-col justify-end p-14 text-white">
          <blockquote className="max-w-md text-2xl font-semibold leading-snug">
            “Every meeting starts in one click, and ends with everyone on the same page.”
          </blockquote>
          <p className="mt-4 text-white/70">Built for teams that work anywhere.</p>
        </div>
      </div>
    </div>
  );
}
