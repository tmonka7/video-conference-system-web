import { VideoIcon } from '@/components/icons';

/** Screen 15: the About panel. */
export default function About() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-8">
      <h1 className="text-3xl font-extrabold text-slate-900">About</h1>

      <div className="card mt-6 px-6 py-14 text-center">
        <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-brand-600 text-white">
          <VideoIcon className="h-10 w-10" />
        </span>

        <h2 className="mt-8 text-2xl font-bold text-slate-900">Video Conferencing System</h2>
        <p className="mt-1 text-slate-500">Version 1.0.0</p>

        <p className="mx-auto mt-8 max-w-md text-slate-600">
          A simple and powerful video conferencing solution for teams and businesses.
        </p>

        <dl className="mx-auto mt-10 grid max-w-sm gap-3 text-left text-sm">
          <div className="flex justify-between border-b border-slate-100 pb-2">
            <dt className="text-slate-500">Media</dt>
            <dd className="font-medium text-slate-800">Peer-to-peer WebRTC mesh</dd>
          </div>
          <div className="flex justify-between border-b border-slate-100 pb-2">
            <dt className="text-slate-500">Signaling</dt>
            <dd className="font-medium text-slate-800">Socket.IO</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Room size</dt>
            <dd className="font-medium text-slate-800">Up to 8 participants</dd>
          </div>
        </dl>

        <p className="mt-12 text-xs text-slate-400">
          © {new Date().getFullYear()} Video Conferencing System. All rights reserved.
        </p>
      </div>
    </div>
  );
}
