import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { formatMeetingId, isValidMeetingId, normalizeMeetingId } from '@vcs/shared';
import { useAuth } from '@/context/AuthContext';
import { meetingsApi } from '@/lib/api';
import { requestUserMedia, stopStream } from '@/lib/webrtc';
import { Button, Input, Toggle } from '@/components/ui';
import { MicIcon, MicOffIcon, VideoIcon, VideoOffIcon } from '@/components/icons';

/** Screen 5: the pre-join screen, with a self preview and device toggles. */
export default function Join() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const [meetingId, setMeetingId] = useState(code ? formatMeetingId(code) : '');
  const [name, setName] = useState(user?.name ?? '');
  const [camera, setCamera] = useState(true);
  const [microphone, setMicrophone] = useState(true);
  const [preview, setPreview] = useState(null);
  const [lookup, setLookup] = useState(null);
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');

  useEffect(() => setName((current) => current || (user?.name ?? '')), [user]);

  // Keep a preview stream alive while the form is open, and release it on exit.
  useEffect(() => {
    let cancelled = false;

    async function openPreview() {
      try {
        const stream = await requestUserMedia({ audio: true, video: true });
        if (cancelled) {
          stopStream(stream);
          return;
        }
        streamRef.current = stream;
        setPreview(stream);
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch {
        setError('We could not reach your camera. You can still join with audio only.');
      }
    }

    openPreview();
    return () => {
      cancelled = true;
      stopStream(streamRef.current);
      streamRef.current = null;
    };
  }, []);

  // Toggling before joining should affect the preview too.
  useEffect(() => {
    preview?.getVideoTracks().forEach((track) => {
      track.enabled = camera;
    });
  }, [camera, preview]);

  useEffect(() => {
    preview?.getAudioTracks().forEach((track) => {
      track.enabled = microphone;
    });
  }, [microphone, preview]);

  // Look the meeting up as soon as a full id is typed, to show its title.
  useEffect(() => {
    const digits = normalizeMeetingId(meetingId);
    if (!isValidMeetingId(digits)) {
      setLookup(null);
      return undefined;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      meetingsApi
        .lookup(digits)
        .then((result) => !cancelled && setLookup(result))
        .catch(() => !cancelled && setLookup(null));
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [meetingId]);

  const handleSubmit = (event) => {
    event.preventDefault();
    const digits = normalizeMeetingId(meetingId);

    if (!isValidMeetingId(digits)) {
      setError('Enter the nine digit meeting ID.');
      return;
    }
    if (!user && name.trim().length < 2) {
      setError('Enter your name so people know who joined.');
      return;
    }

    navigate(`/meeting/${digits}`, {
      state: {
        guestName: user ? undefined : name.trim(),
        passcode: passcode || undefined,
        media: { audioEnabled: microphone, videoEnabled: camera },
      },
    });
  };

  return (
    <div className="flex min-h-full items-center justify-center bg-slate-100 px-4 py-10">
      <div className="card w-full max-w-4xl overflow-hidden">
        <div className="grid gap-8 p-8 lg:grid-cols-2 lg:p-10">
          <form onSubmit={handleSubmit} noValidate>
            <h1 className="text-3xl font-extrabold text-slate-900">Join Meeting</h1>
            {lookup && (
              <p className="mt-2 text-sm text-slate-500">
                {lookup.title}
                {lookup.hostName ? ` · hosted by ${lookup.hostName}` : ''}
              </p>
            )}

            <div className="mt-8 space-y-5">
              <Input
                label="Meeting ID"
                name="meetingId"
                inputMode="numeric"
                placeholder="823 456 789"
                value={meetingId}
                onChange={(event) => setMeetingId(event.target.value)}
                required
              />

              <Input
                label="Your Name"
                name="name"
                placeholder="Alex Chen"
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={Boolean(user)}
                hint={user ? 'Signed in as yourself.' : undefined}
                required={!user}
              />

              {lookup?.hasPasscode && (
                <Input
                  label="Passcode"
                  name="passcode"
                  type="password"
                  placeholder="This meeting is protected"
                  value={passcode}
                  onChange={(event) => setPasscode(event.target.value)}
                  required
                />
              )}

              <div className="divide-y divide-slate-100">
                <Toggle
                  label="Turn on Camera"
                  checked={camera}
                  onChange={setCamera}
                />
                <Toggle
                  label="Turn on Microphone"
                  checked={microphone}
                  onChange={setMicrophone}
                />
              </div>
            </div>

            {error && (
              <p role="alert" className="mt-5 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {error}
              </p>
            )}

            <Button type="submit" size="lg" className="mt-8 w-full">
              Join Meeting
            </Button>

            <p className="mt-5 text-center text-sm text-slate-500">
              {user ? (
                <Link to="/app" className="font-semibold text-brand-600">
                  Back to home
                </Link>
              ) : (
                <>
                  Have an account?{' '}
                  <Link to="/signin" className="font-semibold text-brand-600">
                    Sign in
                  </Link>
                </>
              )}
            </p>
          </form>

          <div className="relative overflow-hidden rounded-2xl bg-navy-900">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`h-full min-h-[280px] w-full object-cover ${camera ? '' : 'invisible'}`}
              style={{ transform: 'scaleX(-1)' }}
            />

            {!camera && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/70">
                <VideoOffIcon className="h-10 w-10" />
                <span className="text-sm">Your camera is off</span>
              </div>
            )}

            <div className="absolute bottom-3 right-3 flex gap-2">
              <span className="rounded-lg bg-black/50 p-2 text-white">
                {microphone ? (
                  <MicIcon className="h-4 w-4" />
                ) : (
                  <MicOffIcon className="h-4 w-4 text-red-400" />
                )}
              </span>
              <span className="rounded-lg bg-black/50 p-2 text-white">
                {camera ? (
                  <VideoIcon className="h-4 w-4" />
                ) : (
                  <VideoOffIcon className="h-4 w-4 text-red-400" />
                )}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
