import { useEffect, useRef, useState } from "react";
import { Room, RoomEvent, Track } from "livekit-client";
import {
  Mic, MicOff, Video, VideoOff, MonitorUp, PhoneOff, Maximize2, Minimize2, GraduationCap, VolumeX, Hand, Loader2,
} from "lucide-react";

const ROOM_EVENTS = [
  RoomEvent.ParticipantConnected, RoomEvent.ParticipantDisconnected, RoomEvent.TrackSubscribed, RoomEvent.TrackUnsubscribed,
  RoomEvent.TrackMuted, RoomEvent.TrackUnmuted, RoomEvent.LocalTrackPublished, RoomEvent.LocalTrackUnpublished,
  RoomEvent.ActiveSpeakersChanged, RoomEvent.ParticipantPermissionsChanged, RoomEvent.ConnectionStateChanged,
];
const canShareScreen = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia;

const avatarOf = (participant) => {
  try {
    return JSON.parse(participant.metadata || "{}").avatar || "🙂";
  } catch {
    return "🙂";
  }
};

function Tile({ participant, source = Track.Source.Camera, isHost, compact = false, children }) {
  const videoRef = useRef(null);
  const publication = participant.getTrackPublication(source);
  const track = publication?.track;
  const showVideo = !!track && !publication.isMuted;
  const micMuted = !participant.isMicrophoneEnabled;

  useEffect(() => {
    const el = videoRef.current;
    if (!track || !el) return;
    track.attach(el);
    return () => track.detach(el);
  }, [track, showVideo]);

  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-slate-800 aspect-video ${
        participant.isSpeaking ? "ring-4 ring-emerald-400" : "ring-1 ring-slate-700"
      }`}
    >
      {showVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={participant.isLocal}
          className={`w-full h-full ${source === Track.Source.ScreenShare ? "object-contain bg-black" : "object-cover"} ${
            participant.isLocal && source === Track.Source.Camera ? "-scale-x-100" : ""
          }`}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <span className={compact ? "text-2xl" : "text-5xl"}>{avatarOf(participant)}</span>
        </div>
      )}
      <div className="absolute left-1.5 bottom-1.5 right-1.5 flex items-center gap-1">
        <span className={`max-w-full truncate px-2 py-0.5 rounded-full bg-black/60 text-white ${compact ? "text-[9px]" : "text-[11px]"} font-semibold`}>
          {isHost && "🎓 "}
          {participant.name || "Guest"}
          {participant.isLocal && " (you)"}
          {source === Track.Source.ScreenShare && " · screen"}
        </span>
        {micMuted && source === Track.Source.Camera && (
          <span className="shrink-0 p-0.5 rounded-full bg-rose-500 text-white"><MicOff className="w-3 h-3" /></span>
        )}
      </div>
      {children}
    </div>
  );
}

// Plays a remote participant's microphone (and screen-share audio)
function ParticipantAudio({ participant }) {
  const micRef = useRef(null);
  const screenRef = useRef(null);
  const mic = participant.getTrackPublication(Track.Source.Microphone)?.track;
  const screen = participant.getTrackPublication(Track.Source.ScreenShareAudio)?.track;
  useEffect(() => {
    const el = micRef.current;
    if (!mic || !el) return;
    mic.attach(el);
    return () => mic.detach(el);
  }, [mic]);
  useEffect(() => {
    const el = screenRef.current;
    if (!screen || !el) return;
    screen.attach(el);
    return () => screen.detach(el);
  }, [screen]);
  return (
    <>
      <audio ref={micRef} autoPlay />
      <audio ref={screenRef} autoPlay />
    </>
  );
}

export default function CallView({ url, token, hostId, myClientId, call, hands, actions, onLeave }) {
  const [lk, setLk] = useState(null);
  const [, setVersion] = useState(0);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const iAmHost = myClientId === hostId;

  // Connect once per token; every LiveKit event just re-renders from the room's live state
  useEffect(() => {
    const room = new Room({ adaptiveStream: true, dynacast: true });
    let cancelled = false;
    let connected = false;
    const bump = () => setVersion((v) => v + 1);
    for (const event of ROOM_EVENTS) room.on(event, bump);
    room.on(RoomEvent.AudioPlaybackStatusChanged, () => setAudioBlocked(!room.canPlaybackAudio));
    room.on(RoomEvent.MediaDevicesError, () => setError("Camera/mic blocked — allow them in your browser or phone settings."));
    // Only a drop after a successful connect ends the call; a failed connect shows the error instead
    room.on(RoomEvent.Disconnected, () => !cancelled && connected && onLeave());

    room
      .connect(url, token)
      .then(async () => {
        if (cancelled) return;
        connected = true;
        setLk(room);
        setAudioBlocked(!room.canPlaybackAudio);
        // The teacher starts with camera + mic on; everyone else joins quietly and turns them on when needed
        if (iAmHost) {
          await room.localParticipant.setMicrophoneEnabled(true).catch(() => {});
          await room.localParticipant.setCameraEnabled(true).catch(() => {});
        }
        bump();
      })
      .catch(() => !cancelled && setError("Couldn't connect to the call. Check your internet and try again."));

    return () => {
      cancelled = true;
      room.disconnect();
    };
    // onLeave/iAmHost are read once at connect time
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, token]);

  const local = lk?.localParticipant;
  const remotes = lk ? [...lk.remoteParticipants.values()] : [];
  const everyone = local ? [local, ...remotes] : [];
  const canPublish = local?.permissions ? local.permissions.canPublish : true;
  const micOn = !!local?.isMicrophoneEnabled;
  const camOn = !!local?.isCameraEnabled;
  const screenOn = !!local?.isScreenShareEnabled;

  // Big tile: a shared screen, else the teacher, else whoever is talking
  const sharer = everyone.find((p) => p.getTrackPublication(Track.Source.ScreenShare)?.track);
  const host = everyone.find((p) => p.identity === hostId);
  const speaker = everyone.find((p) => p.isSpeaking && !p.isLocal);
  const spotlight = sharer
    ? { participant: sharer, source: Track.Source.ScreenShare }
    : { participant: host || speaker || remotes[0] || local, source: Track.Source.Camera };

  const run = async (fn) => {
    setError("");
    try {
      await fn();
    } catch {
      setError("That didn't work — check camera/mic permissions.");
    }
    setVersion((v) => v + 1);
  };

  const raisedHand = hands.some((h) => h.clientId === myClientId);
  const btn = (active, danger) =>
    `w-11 h-11 rounded-full flex items-center justify-center transition disabled:opacity-40 ${
      danger ? "bg-rose-500 text-white hover:bg-rose-600" : active ? "bg-slate-100 text-slate-950" : "bg-slate-800 text-slate-200 hover:bg-slate-700"
    }`;

  const controls = (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <button onClick={() => run(() => local.setMicrophoneEnabled(!micOn))} disabled={!local || !canPublish} title={micOn ? "Mute" : "Unmute"} className={btn(micOn)}>
        {micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
      </button>
      <button onClick={() => run(() => local.setCameraEnabled(!camOn))} disabled={!local || !canPublish} title={camOn ? "Camera off" : "Camera on"} className={btn(camOn)}>
        {camOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
      </button>
      {canShareScreen && (
        <button onClick={() => run(() => local.setScreenShareEnabled(!screenOn, { audio: true }))} disabled={!local || !canPublish} title="Share screen" className={btn(screenOn)}>
          <MonitorUp className="w-5 h-5" />
        </button>
      )}
      {!canPublish && (
        <button onClick={actions.toggleHand} className={`h-11 px-4 rounded-full flex items-center gap-1.5 text-sm font-bold ${raisedHand ? "bg-amber-400 text-slate-950" : "bg-slate-800 text-slate-200"}`}>
          <Hand className="w-4 h-4" /> {raisedHand ? "hand raised" : "raise hand to speak"}
        </button>
      )}
      <button onClick={() => setExpanded(!expanded)} title={expanded ? "Small window" : "Full screen"} className={btn(false)}>
        {expanded ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
      </button>
      <button onClick={onLeave} title="Leave call" className={btn(false, true)}>
        <PhoneOff className="w-5 h-5" />
      </button>
    </div>
  );

  const notices = (
    <>
      {!lk && !error && <div className="flex items-center justify-center gap-2 text-xs text-slate-400 py-2"><Loader2 className="w-4 h-4 animate-spin" /> joining call…</div>}
      {error && <p className="text-xs text-rose-400 text-center">{error}</p>}
      {audioBlocked && lk && (
        <button onClick={() => lk.startAudio().then(() => setAudioBlocked(false))} className="w-full py-2 rounded-xl bg-amber-400 text-slate-950 text-xs font-bold">
          🔊 tap to turn on call audio
        </button>
      )}
      {call.lectureMode && !iAmHost && (
        <p className="text-[11px] text-center text-slate-400">🎓 lecture mode — {canPublish ? "the teacher let you speak 🎙️" : "only the teacher can talk"}</p>
      )}
    </>
  );

  const audio = remotes.map((p) => <ParticipantAudio key={p.identity} participant={p} />);

  if (!expanded) {
    const others = everyone.filter((p) => p !== spotlight.participant || spotlight.source === Track.Source.ScreenShare);
    return (
      <div className="fixed z-[44] top-20 right-3 w-[min(21rem,calc(100vw-1.5rem))] paper-card rounded-3xl p-2.5 space-y-2 safe-top">
        {audio}
        {spotlight.participant && <Tile participant={spotlight.participant} source={spotlight.source} isHost={spotlight.participant.identity === hostId} />}
        {others.length > 0 && (
          <div className="grid grid-cols-4 gap-1.5">
            {others.slice(0, 3).map((p) => <Tile key={p.identity} participant={p} isHost={p.identity === hostId} compact />)}
            {others.length > 3 && (
              <button onClick={() => setExpanded(true)} className="aspect-video rounded-2xl bg-slate-800 text-xs font-bold text-slate-200">+{others.length - 3}</button>
            )}
          </div>
        )}
        {notices}
        {controls}
      </div>
    );
  }

  const handIds = new Set(hands.map((h) => h.clientId));
  return (
    <div className="fixed inset-0 z-[44] bg-slate-950 flex flex-col safe-top safe-bottom">
      {audio}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b-2 border-slate-800">
        <div className="font-display font-bold text-slate-100">📹 live class · {everyone.length} {everyone.length === 1 ? "person" : "people"}</div>
        {iAmHost && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => actions.setLecture(!call.lectureMode)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${call.lectureMode ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-200"}`}
            >
              <GraduationCap className="w-4 h-4" /> lecture mode {call.lectureMode ? "on" : "off"}
            </button>
            <button onClick={actions.muteAll} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-800 text-slate-200 text-xs font-bold">
              <VolumeX className="w-4 h-4" /> mute everyone
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 space-y-3">
        {iAmHost && call.lectureMode && hands.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 p-3 rounded-2xl bg-amber-400/10 border border-amber-400/30">
            <span className="text-xs font-bold text-amber-500">✋ wants to speak:</span>
            {hands.map((h) => (
              <button key={h.clientId} onClick={() => actions.allowSpeak(h.clientId, true)} className="px-3 py-1 rounded-full bg-amber-400 text-slate-950 text-xs font-bold">
                {h.avatar} {h.name} · allow
              </button>
            ))}
          </div>
        )}
        {sharer && (
          <div className="max-w-5xl mx-auto"><Tile participant={sharer} source={Track.Source.ScreenShare} isHost={sharer.identity === hostId} /></div>
        )}
        <div className="grid gap-2 sm:gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {everyone.map((p) => {
            const isStudent = p.identity !== hostId;
            const allowed = call.speakers.includes(p.identity);
            return (
              <Tile key={p.identity} participant={p} isHost={!isStudent}>
                {iAmHost && call.lectureMode && isStudent && !p.isLocal && (
                  <button
                    onClick={() => actions.allowSpeak(p.identity, !allowed)}
                    className={`absolute top-1.5 right-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${allowed ? "bg-emerald-500 text-white" : "bg-black/60 text-white"}`}
                  >
                    {handIds.has(p.identity) && "✋ "}{allowed ? "speaking · stop" : "allow to speak"}
                  </button>
                )}
              </Tile>
            );
          })}
        </div>
      </div>

      <div className="shrink-0 border-t-2 border-slate-800 p-3 space-y-2">
        {notices}
        {controls}
      </div>
    </div>
  );
}
