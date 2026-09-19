import { useEffect, useRef } from 'react';
import { Avatar } from '@/components/ui';
import { MicOffIcon, HandIcon, ScreenIcon } from '@/components/icons';

/**
 * One participant's video. The element is muted for your own tile, otherwise you
 * would hear yourself with a delay.
 */
export default function VideoTile({
  participant,
  stream,
  isSelf = false,
  mirrored = false,
  contain = false,
  className = '',
  nameClassName = '',
}) {
  const videoRef = useRef(null);

  useEffect(() => {
    const element = videoRef.current;
    if (!element) return;
    if (element.srcObject !== stream) element.srcObject = stream ?? null;
  }, [stream]);

  const media = participant?.media ?? {};
  const showVideo = Boolean(stream) && media.videoEnabled !== false;

  return (
    <div
      className={`relative overflow-hidden rounded-xl bg-navy-900 ${
        media.handRaised ? 'ring-2 ring-amber-400' : ''
      } ${className}`}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isSelf}
        className={`h-full w-full ${contain ? 'video-contain' : 'object-cover'} ${
          showVideo ? '' : 'invisible'
        }`}
        style={mirrored && !media.screenSharing ? { transform: 'scaleX(-1)' } : undefined}
      />

      {!showVideo && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Avatar name={participant?.displayName} user={participant?.user} size="lg" />
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/70 to-transparent px-3 py-2">
        <span className={`truncate text-sm font-semibold text-white ${nameClassName}`}>
          {participant?.displayName ?? 'Participant'}
          {isSelf && ' (You)'}
        </span>

        <span className="ml-auto flex items-center gap-1.5">
          {media.handRaised && <HandIcon className="h-4 w-4 text-amber-300" />}
          {media.screenSharing && <ScreenIcon className="h-4 w-4 text-emerald-300" />}
          {media.audioEnabled === false && <MicOffIcon className="h-4 w-4 text-red-400" />}
        </span>
      </div>
    </div>
  );
}
