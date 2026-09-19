import VideoTile from './VideoTile';

/** Column count that keeps tiles closest to 16:9 for a given headcount. */
function gridColumns(count) {
  if (count <= 1) return 'grid-cols-1';
  if (count <= 4) return 'grid-cols-1 sm:grid-cols-2';
  if (count <= 9) return 'grid-cols-2 lg:grid-cols-3';
  return 'grid-cols-2 lg:grid-cols-4';
}

/**
 * Screens 6, 7 and 8: gallery, speaker and screen-share are the same tiles in
 * three arrangements, so they live together rather than in three near-copies.
 */
export default function Stage({ layout, tiles, spotlight }) {
  if (tiles.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-slate-400">
        Waiting for others to join…
      </div>
    );
  }

  if (layout === 'gallery' || !spotlight) {
    return (
      <div className={`grid h-full auto-rows-fr gap-3 ${gridColumns(tiles.length)}`}>
        {tiles.map((tile) => (
          <VideoTile key={tile.key} {...tile} />
        ))}
      </div>
    );
  }

  const others = tiles.filter((tile) => tile.key !== spotlight.key);
  const isScreenShare = layout === 'screen';

  return (
    <div className="flex h-full flex-col gap-3 lg:flex-row">
      <div className="min-h-0 flex-1">
        <VideoTile
          {...spotlight}
          contain={isScreenShare}
          className="h-full"
          nameClassName="text-base"
        />
      </div>

      {others.length > 0 && (
        <div className="flex shrink-0 gap-3 overflow-x-auto lg:w-56 lg:flex-col lg:overflow-y-auto lg:overflow-x-visible">
          {others.map((tile) => (
            <VideoTile
              key={tile.key}
              {...tile}
              className="aspect-video w-40 shrink-0 lg:w-full"
            />
          ))}
        </div>
      )}
    </div>
  );
}
