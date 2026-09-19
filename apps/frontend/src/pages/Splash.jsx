import { Link } from 'react-router-dom';
import { ArrowRightIcon, VideoIcon } from '@/components/icons';

/** Screen 1: the launch screen, with the wave motif from the mockups. */
export default function Splash() {
  return (
    <div className="relative flex h-full flex-col items-center justify-center overflow-hidden bg-brand-600 px-6 text-center text-white">
      <svg
        className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 w-full"
        viewBox="0 0 1440 320"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          fill="rgba(255,255,255,0.08)"
          d="M0 160 C 240 60, 480 260, 720 180 C 960 100, 1200 220, 1440 140 L1440 320 L0 320 Z"
        />
        <path
          fill="rgba(255,255,255,0.06)"
          d="M0 220 C 300 140, 560 300, 860 230 C 1120 170, 1280 260, 1440 210 L1440 320 L0 320 Z"
        />
      </svg>

      <div className="relative flex flex-col items-center">
        <span className="flex h-24 w-24 items-center justify-center rounded-[28px] bg-white/15 backdrop-blur">
          <VideoIcon className="h-12 w-12" />
        </span>

        <h1 className="mt-10 text-4xl font-extrabold tracking-tight sm:text-5xl">
          Video Conferencing System
        </h1>
        <p className="mt-4 max-w-lg text-base text-white/80 sm:text-lg">
          Connect people. Share ideas. Build the future.
        </p>

        <Link
          to="/signin"
          className="mt-12 inline-flex items-center gap-3 rounded-xl bg-brand-500 px-10 py-4 text-base font-bold shadow-lg transition hover:bg-brand-400"
        >
          Get Started
          <ArrowRightIcon className="h-5 w-5" />
        </Link>

        <Link to="/join" className="mt-6 text-sm font-medium text-white/70 hover:text-white">
          Have a meeting ID? Join without an account
        </Link>
      </div>
    </div>
  );
}
