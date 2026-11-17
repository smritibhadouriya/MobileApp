import { useEffect, useRef, useState } from "react";
import { SmilePlus, Reply, Pin, PinOff, BarChart2, X, Plus } from "lucide-react";
import MathText from "./ui/MathText";
import { mentionsName } from "../lib/chat";

const REACTIONS = ["👍", "❤️", "😂", "🔥"];
const PRESENCE = /^(.+) (joined|left) the room$/;

// Runs of 2+ "X joined / left the room" lines become one collapsible row so they don't flood the chat
function groupPresence(messages) {
  const items = [];
  for (const msg of messages) {
    const presence = msg.senderId === "system" && PRESENCE.test(msg.text);
    const last = items.at(-1);
    if (presence && last?.kind === "presence") last.messages.push(msg);
    else if (presence) items.push({ kind: "presence", id: msg.id, messages: [msg] });
    else items.push({ kind: "message", msg });
  }
  // A single join/leave stays a normal line
  return items.flatMap((item) => (item.kind === "presence" && item.messages.length === 1 ? [{ kind: "message", msg: item.messages[0] }] : [item]));
}

function presenceSummary(messages) {
  const latest = new Map(); // name -> last action
  for (const m of messages) {
    const [, name, action] = m.text.match(PRESENCE);
    latest.set(name, action);
  }
  const names = [...latest.keys()];
  const shown = names.slice(0, 3).join(", ") + (names.length > 3 ? ` +${names.length - 3}` : "");
  return `${shown} · ${messages.length} join/leave updates`;
}
const formatTime = (ts) => new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

function typingText(names) {
  if (names.length === 0) return "";
  if (names.length === 1) return `${names[0]} is typing…`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;
  return "Several people are typing…";
}

function PollComposer({ onCreate, onClose }) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const inputClass = "w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs focus:outline-none focus:border-indigo-500";

  const submit = (e) => {
    e.preventDefault();
    const filled = options.map((o) => o.trim()).filter(Boolean);
    if (!question.trim() || filled.length < 2) return;
    onCreate(question.trim(), filled);
    onClose();
  };

  return (
    <form onSubmit={submit} className="p-3 border-t border-slate-800/80 bg-slate-900/80 space-y-2">
      <div className="flex items-center justify-between text-[11px] text-slate-400">
        <span className="font-semibold uppercase tracking-wider">New poll</span>
        <button type="button" onClick={onClose} className="hover:text-slate-100"><X className="w-3.5 h-3.5" /></button>
      </div>
      <input autoFocus value={question} maxLength={150} onChange={(e) => setQuestion(e.target.value)} placeholder="Question (e.g. Kal kaunsa chapter karein?)" className={inputClass} />
      {options.map((o, i) => (
        <input
          key={i} value={o} maxLength={60} placeholder={`Option ${i + 1}`} className={inputClass}
          onChange={(e) => setOptions(options.map((x, j) => (j === i ? e.target.value : x)))}
        />
      ))}
      <div className="flex justify-between">
        {options.length < 5 ? (
          <button type="button" onClick={() => setOptions([...options, ""])} className="text-[11px] text-slate-400 hover:text-slate-100 flex items-center gap-1">
            <Plus className="w-3 h-3" /> Add option
          </button>
        ) : <span />}
        <button type="submit" className="px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg">Post poll</button>
      </div>
    </form>
  );
}

function Poll({ msg, clientId, onVote }) {
  const total = msg.poll.options.reduce((s, o) => s + o.votes.length, 0);
  return (
    <div className="space-y-1.5 min-w-52">
      <div className="font-medium flex items-center gap-1.5"><BarChart2 className="w-3.5 h-3.5" /> {msg.text}</div>
      {msg.poll.options.map((o, i) => {
        const pct = total ? Math.round((o.votes.length / total) * 100) : 0;
        const mine = o.votes.includes(clientId);
        return (
          <button
            key={i}
            onClick={() => onVote(msg.id, i)}
            className={`relative w-full text-left px-2.5 py-1.5 rounded-lg border overflow-hidden ${mine ? "border-indigo-400" : "border-slate-600/60 hover:border-slate-500"}`}
          >
            <span className="absolute inset-y-0 left-0 bg-indigo-500/25" style={{ width: `${pct}%` }} />
            <span className="relative flex justify-between gap-2">
              <span>{mine && "✓ "}{o.text}</span>
              <span className="tabular-nums opacity-80">{pct}%</span>
            </span>
          </button>
        );
      })}
      <div className="text-[10px] opacity-70">{total} vote{total === 1 ? "" : "s"} · tap to vote</div>
    </div>
  );
}

export default function RoomChat({ messages, pinnedId, clientId, myName, typingNames, blocked, aiEnabled, actions, onUpgrade, onOpenNote }) {
  const [inputMsg, setInputMsg] = useState("");
  const [pickerFor, setPickerFor] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [polling, setPolling] = useState(false);
  const [openGroups, setOpenGroups] = useState(() => new Set());
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimeout = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages.length]);

  useEffect(() => () => clearTimeout(typingTimeout.current), []);

  const pinned = messages.find((m) => m.id === pinnedId);

  const handleInput = (value) => {
    setInputMsg(value);
    if (!typingTimeout.current) actions.setTyping(true);
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      actions.setTyping(false);
      typingTimeout.current = null;
    }, 2000);
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (!inputMsg.trim()) return;
    actions.sendMessage(inputMsg.trim(), replyTo?.id);
    setInputMsg("");
    setReplyTo(null);
    clearTimeout(typingTimeout.current);
    typingTimeout.current = null;
    actions.setTyping(false);
  };

  const startReply = (msg) => {
    setReplyTo(msg);
    inputRef.current?.focus();
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {pinned && (
        <div className="flex items-start gap-2 px-4 py-2 border-b border-slate-800/80 bg-indigo-600/10 text-xs">
          <Pin className="w-3.5 h-3.5 text-indigo-300 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <span className="font-semibold text-indigo-200">{pinned.sender}: </span>
            <span className="text-slate-300 line-clamp-2">{pinned.text}</span>
          </div>
          <button onClick={() => actions.pin(null)} title="Unpin" className="text-slate-500 hover:text-slate-200 shrink-0"><PinOff className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* Chat Messages Log */}
      <div className="flex-1 p-4 space-y-3 overflow-y-auto">
        {groupPresence(messages).map((item) => {
          if (item.kind === "presence") {
            const open = openGroups.has(item.id);
            return (
              <div key={item.id} className="text-center text-[10px] text-slate-500">
                <button
                  onClick={() => setOpenGroups((g) => {
                    const next = new Set(g);
                    if (next.has(item.id)) next.delete(item.id);
                    else next.add(item.id);
                    return next;
                  })}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-800/60 hover:bg-slate-800 hover:text-slate-300"
                >
                  👥 {presenceSummary(item.messages)} <span className={`transition ${open ? "rotate-180" : ""}`}>▾</span>
                </button>
                {open && (
                  <div className="mt-1.5 space-y-0.5">
                    {item.messages.map((m) => <div key={m.id}>{m.text} · {formatTime(m.time)}</div>)}
                  </div>
                )}
              </div>
            );
          }
          const { msg } = item;
          if (msg.senderId === "system") {
            return (
              <div key={msg.id} className="text-center text-[10px] text-slate-500">
                {msg.text} · {formatTime(msg.time)}
                {msg.upgrade && (
                  <button onClick={onUpgrade} className="ml-1.5 px-2 py-0.5 rounded-full bg-indigo-600 text-white font-bold">get Pro ✨</button>
                )}
              </div>
            );
          }
          if (blocked.includes(msg.senderId)) {
            return <div key={msg.id} className="text-center text-[10px] text-slate-600 italic">Message from a blocked user hidden</div>;
          }
          const mine = msg.senderId === clientId;
          const ai = msg.senderId === "ai";
          const mentioned = !mine && mentionsName(msg.text, myName);
          const reactions = Object.entries(msg.reactions || {});
          return (
            <div key={msg.id} className={`group flex flex-col ${mine ? "items-end" : "items-start"}`}>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-xs">{msg.avatar}</span>
                <span className={`text-[10px] font-semibold ${ai ? "text-emerald-300" : "text-slate-400"}`}>{mine ? "You" : msg.sender}</span>
                <span className="text-[9px] text-slate-500">{formatTime(msg.time)}</span>
                {msg.id === pinnedId && <Pin className="w-2.5 h-2.5 text-indigo-300" />}
              </div>
              <div className={`relative flex items-center gap-1 max-w-[88%] ${mine ? "flex-row-reverse" : ""}`}>
                <div className={`px-3 py-2 rounded-2xl text-xs leading-relaxed min-w-0 ${
                  mine
                    ? "bg-indigo-600 text-white rounded-tr-none"
                    : ai
                      ? "bg-emerald-500/10 text-slate-200 rounded-tl-none border border-emerald-500/30"
                      : mentioned
                        ? "bg-amber-500/15 text-slate-100 rounded-tl-none border border-amber-500/40"
                        : "bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700/50"
                }`}>
                  {msg.replyTo && (
                    <div className={`mb-1.5 pl-2 border-l-2 text-[10px] ${mine ? "border-white/50 text-white/80" : "border-indigo-400/60 text-slate-400"}`}>
                      <b>{msg.replyTo.sender}</b>: {msg.replyTo.text}
                    </div>
                  )}
                  {msg.type === "poll" ? (
                    <Poll msg={msg} clientId={clientId} onVote={actions.vote} />
                  ) : msg.type === "note" ? (
                    <button onClick={() => onOpenNote(msg.noteId)} className="text-left space-y-1">
                      <span className="block font-semibold">{msg.text}</span>
                      <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold ${mine ? "bg-white/20" : "bg-indigo-600 text-white"}`}>open notes →</span>
                    </button>
                  ) : (
                    <MathText text={msg.text} mentionClass={mine ? "font-semibold underline" : "font-semibold text-indigo-300"} />
                  )}
                </div>
                <div className="shrink-0 flex flex-col opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition">
                  <button onClick={() => setPickerFor(pickerFor === msg.id ? null : msg.id)} title="React" className="p-0.5 text-slate-500 hover:text-slate-200">
                    <SmilePlus className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => startReply(msg)} title="Reply" className="p-0.5 text-slate-500 hover:text-slate-200">
                    <Reply className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => actions.pin(msg.id === pinnedId ? null : msg.id)} title={msg.id === pinnedId ? "Unpin" : "Pin"} className="p-0.5 text-slate-500 hover:text-slate-200">
                    <Pin className="w-3.5 h-3.5" />
                  </button>
                </div>
                {pickerFor === msg.id && (
                  <div className={`absolute -top-9 ${mine ? "right-0" : "left-0"} flex gap-0.5 bg-slate-900 border border-slate-700 rounded-full px-1.5 py-1 shadow-xl z-10`}>
                    {REACTIONS.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => { actions.react(msg.id, emoji); setPickerFor(null); }}
                        className="text-sm px-1 hover:scale-125 transition"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {reactions.length > 0 && (
                <div className="flex gap-1 mt-1">
                  {reactions.map(([emoji, users]) => (
                    <button
                      key={emoji}
                      onClick={() => actions.react(msg.id, emoji)}
                      className={`text-[11px] px-1.5 py-0.5 rounded-full border transition ${
                        users.includes(clientId)
                          ? "bg-indigo-600/20 border-indigo-500/50 text-indigo-200"
                          : "bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600"
                      }`}
                    >
                      {emoji} {users.length}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="h-5 px-4 text-[10px] text-slate-500 italic">{typingText(typingNames)}</div>

      {polling ? (
        <PollComposer onCreate={actions.createPoll} onClose={() => setPolling(false)} />
      ) : (
        <form onSubmit={sendMessage} className="p-3 border-t border-slate-800/80 bg-slate-900/50">
          {replyTo && (
            <div className="flex items-center justify-between gap-2 mb-2 px-2 py-1 rounded-lg bg-slate-800/70 text-[11px] text-slate-400">
              <span className="truncate">Replying to <b className="text-slate-200">{replyTo.sender}</b>: {replyTo.text}</span>
              <button type="button" onClick={() => setReplyTo(null)} className="hover:text-slate-100 shrink-0"><X className="w-3.5 h-3.5" /></button>
            </div>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={() => setPolling(true)} title="Create a poll" className="px-2 text-slate-400 hover:text-slate-100 bg-slate-800 border border-slate-700 rounded-xl">
              <BarChart2 className="w-4 h-4" />
            </button>
            <input
              ref={inputRef}
              type="text"
              placeholder={aiEnabled ? "say something… (@name, /ask for AI)" : "say something… (@name to mention)"}
              value={inputMsg}
              maxLength={500}
              onChange={(e) => handleInput(e.target.value)}
              className="flex-1 min-w-0 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs focus:outline-none focus:border-indigo-500"
            />
            <button
              type="submit"
              className="pop px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold"
            >
              Send
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
