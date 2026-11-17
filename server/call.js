import { AccessToken, RoomServiceClient, TrackType } from "livekit-server-sdk";

// Video calls run through LiveKit (an SFU): each person uploads one stream and the server fans it out,
// which keeps 10-15+ person classes smooth. Works with LiveKit Cloud or a self-hosted LiveKit server.
const LIVEKIT_URL = process.env.LIVEKIT_URL || "";
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || "";
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || "";

export const callsEnabled = Boolean(LIVEKIT_URL && LIVEKIT_API_KEY && LIVEKIT_API_SECRET);
export const callUrl = LIVEKIT_URL;

const service = callsEnabled
  ? new RoomServiceClient(LIVEKIT_URL.replace(/^ws/, "http"), LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
  : null;

const livekitRoom = (code) => `studygroup-${code}`;
const permission = (canPublish) => ({ canPublish, canSubscribe: true, canPublishData: false });

export async function createCallToken({ code, identity, name, metadata, canPublish }) {
  const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, { identity, name, metadata, ttl: "3h" });
  token.addGrant({ roomJoin: true, room: livekitRoom(code), ...permission(canPublish) });
  return token.toJwt();
}

// Enforced by LiveKit, so a student can't unmute themselves in lecture mode by editing the app
export async function setCanPublish(code, identity, canPublish) {
  try {
    await service.updateParticipant(livekitRoom(code), identity, { permission: permission(canPublish) });
  } catch {
    // Not connected to the call right now; their next token carries the right permission
  }
}

export async function muteAllMics(code, exceptIdentity) {
  try {
    const participants = await service.listParticipants(livekitRoom(code));
    await Promise.all(
      participants
        .filter((p) => p.identity !== exceptIdentity)
        .flatMap((p) => p.tracks.filter((t) => t.type === TrackType.AUDIO && !t.muted).map((t) => ({ identity: p.identity, sid: t.sid })))
        .map(({ identity, sid }) => service.mutePublishedTrack(livekitRoom(code), identity, sid, true))
    );
    return true;
  } catch (err) {
    console.error("Mute all failed:", err.message);
    return false;
  }
}
