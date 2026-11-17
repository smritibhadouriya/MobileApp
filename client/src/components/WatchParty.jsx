import { useEffect, useRef, useState } from "react";
import { Tv, X } from "lucide-react";

// Loads the YouTube IFrame API once
let apiPromise;
function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  apiPromise ||= new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(window.YT);
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(script);
  });
  return apiPromise;
}

// Where the shared video should be right now, from the last state the server saw
const expectedTime = (video, clockOffset) =>
  video.time + (video.playing ? (Date.now() + clockOffset - video.updatedAt) / 1000 : 0);

// `fill`: full-screen view, the player grows as large as the screen allows
export default function WatchParty({ video, clockOffset, actions, fill = false }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const holderRef = useRef(null);
  const playerRef = useRef(null);
  const applyingRef = useRef(false);
  const videoRef = useRef(video);
  const offsetRef = useRef(clockOffset);

  useEffect(() => {
    videoRef.current = video;
    offsetRef.current = clockOffset;
  });

  const videoId = video?.id;

  // Create the player when a video is set
  useEffect(() => {
    if (!videoId) return;
    let cancelled = false;
    loadYouTubeApi().then((YT) => {
      if (cancelled) return;
      const mount = document.createElement("div");
      holderRef.current.replaceChildren(mount);
      playerRef.current = new YT.Player(mount, {
        videoId,
        width: "100%",
        height: "100%",
        playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
        events: {
          onReady: (e) => {
            const v = videoRef.current;
            e.target.seekTo(expectedTime(v, offsetRef.current), true);
            if (v.playing) e.target.playVideo();
          },
          onStateChange: (e) => {
            // Ignore events caused by applying someone else's play/pause/seek
            if (applyingRef.current) return;
            if (e.data === YT.PlayerState.PLAYING) actions.controlVideo(true, e.target.getCurrentTime());
            else if (e.data === YT.PlayerState.PAUSED) actions.controlVideo(false, e.target.getCurrentTime());
          },
        },
      });
    });
    return () => {
      cancelled = true;
      playerRef.current?.destroy?.();
      playerRef.current = null;
    };
  }, [videoId, actions]);

  // Apply remote changes
  useEffect(() => {
    const player = playerRef.current;
    if (!video || !player?.getPlayerState) return;
    const target = expectedTime(video, clockOffset);
    const state = player.getPlayerState();
    const isPlaying = state === window.YT.PlayerState.PLAYING || state === window.YT.PlayerState.BUFFERING;
    applyingRef.current = true;
    if (Math.abs(player.getCurrentTime() - target) > 2) player.seekTo(target, true);
    if (video.playing && !isPlaying) player.playVideo();
    if (!video.playing && isPlaying) player.pauseVideo();
    const id = setTimeout(() => (applyingRef.current = false), 800);
    return () => clearTimeout(id);
  }, [video, clockOffset]);

  const submit = (e) => {
    e.preventDefault();
    if (!/(youtu\.be\/|youtube\.com\/|^[\w-]{11}$)/.test(url.trim())) return setError("Paste a YouTube link.");
    actions.setVideo(url.trim());
    setUrl("");
    setError("");
  };

  return (
    <div className="space-y-3">
      <form onSubmit={submit} className="flex gap-2">
        <input
          value={url}
          onChange={(e) => { setUrl(e.target.value); setError(""); }}
          placeholder="Paste a YouTube lecture link to watch together"
          className="flex-1 min-w-0 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs focus:outline-none focus:border-indigo-500"
        />
        <button type="submit" className="px-4 py-2 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl">Play for all</button>
      </form>
      {error && <p className="text-[11px] text-rose-400">{error}</p>}

      {video ? (
        <div className="space-y-2">
          <div
            ref={holderRef}
            className="aspect-video w-full mx-auto rounded-xl overflow-hidden bg-black border border-slate-800"
            style={fill ? { maxWidth: "min(100%, calc((100dvh - 12rem) * 16 / 9))" } : undefined}
          />
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span>Play, pause and seek stay in sync for everyone · started by {video.by}</span>
            <button onClick={actions.clearVideo} className="flex items-center gap-1 hover:text-rose-400"><X className="w-3.5 h-3.5" /> Stop</button>
          </div>
        </div>
      ) : (
        <div className="aspect-video w-full rounded-xl border border-dashed border-slate-700 flex flex-col items-center justify-center text-slate-500 text-xs gap-2">
          <Tv className="w-8 h-8" /> No video playing. Paste a link above.
        </div>
      )}
    </div>
  );
}
