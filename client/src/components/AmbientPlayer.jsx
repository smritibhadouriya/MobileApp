import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX, ChevronDown, Music } from "lucide-react";
import { AMBIENT_LAYERS, startAmbient } from "../lib/ambient";
import useLocalState from "../hooks/useLocalState";
import Menu from "./ui/Menu";
import { ProTag } from "./ui/ProLock";

const FREE_LAYERS = ["rain"];

// Lofi Girl "beats to relax/study to" live stream; swap the id for any YouTube video or stream
const LOFI_YOUTUBE_ID = "jfKfPfyJRdk";

// Mixer: every layer has its own on/off and volume; layers play together
export default function AmbientPlayer({ pro = false, onUpgrade }) {
  const [mix, setMix] = useLocalState("fs:mixer", { lofi: false, layers: {} });
  // Sounds never auto-start after a refresh: browsers block audio until the user interacts
  const [started, setStarted] = useState(false);
  const handlesRef = useRef({});

  const activeLayers = Object.entries(mix.layers).filter(([, l]) => l.on);
  const anyOn = mix.lofi || activeLayers.length > 0;

  useEffect(() => {
    if (!started) return;
    const handles = handlesRef.current;
    for (const { id } of AMBIENT_LAYERS) {
      const layer = mix.layers[id];
      const on = layer?.on && (pro || FREE_LAYERS.includes(id));
      if (on && !handles[id]) handles[id] = startAmbient(id, layer.volume);
      else if (on) handles[id].setVolume(layer.volume);
      else if (handles[id]) {
        handles[id].stop();
        delete handles[id];
      }
    }
  }, [mix, started, pro]);

  useEffect(() => () => {
    for (const handle of Object.values(handlesRef.current)) handle.stop();
    handlesRef.current = {};
  }, []);

  const updateLayer = (id, patch) => {
    setStarted(true);
    setMix((m) => ({ ...m, layers: { ...m.layers, [id]: { on: false, volume: 0.4, ...m.layers[id], ...patch } } }));
  };

  const stopAll = () => {
    setStarted(true);
    setMix({ lofi: false, layers: Object.fromEntries(Object.entries(mix.layers).map(([id, l]) => [id, { ...l, on: false }])) });
  };

  const label = mix.lofi ? "Lofi" : activeLayers.length === 1 ? AMBIENT_LAYERS.find((l) => l.id === activeLayers[0][0])?.label : activeLayers.length ? `${activeLayers.length} sounds` : "Ambient";

  return (
    <>
      <Menu
        width="w-72"
        trigger={({ toggle }) => (
          <button
            onClick={toggle}
            className="flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-700 transition"
          >
            {anyOn && started ? <Volume2 className="w-3.5 h-3.5 text-indigo-400" /> : <VolumeX className="w-3.5 h-3.5 text-slate-400" />}
            <span className="hidden sm:inline">{label}</span>
            <ChevronDown className="w-3 h-3 text-slate-500" />
          </button>
        )}
      >
        {() => (
          <div className="p-1.5 space-y-1">
            <button
              onClick={() => { setStarted(true); setMix((m) => ({ ...m, lofi: !m.lofi })); }}
              className={`w-full flex items-center gap-2 text-xs px-3 py-2 rounded-lg transition ${
                mix.lofi && started ? "bg-indigo-600/20 text-indigo-300" : "hover:bg-slate-800 text-slate-300"
              }`}
            >
              <Music className="w-4 h-4" /> Lofi Beats (YouTube)
              <span className="ml-auto text-[10px] text-slate-500">{mix.lofi && started ? "On" : "Off"}</span>
            </button>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 px-3 pt-2">Mix ambient sounds</div>
            {AMBIENT_LAYERS.map(({ id, label: name, icon }) => {
              const layer = mix.layers[id] || { on: false, volume: 0.4 };
              const locked = !pro && !FREE_LAYERS.includes(id);
              const on = layer.on && started && !locked;
              return (
                <div key={id} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${on ? "bg-slate-800/70" : ""}`}>
                  <button
                    onClick={() => (locked ? onUpgrade?.() : updateLayer(id, { on: !on }))}
                    className={`flex items-center gap-2 text-xs w-28 shrink-0 text-left ${on ? "text-indigo-300" : "text-slate-400 hover:text-slate-200"}`}
                  >
                    <span>{icon}</span> {name}{locked && <ProTag />}
                  </button>
                  <input
                    type="range" min="0" max="1" step="0.05" value={layer.volume}
                    aria-label={`${name} volume`}
                    disabled={locked}
                    onChange={(e) => updateLayer(id, { volume: Number(e.target.value), on: true })}
                    className="flex-1 accent-indigo-500"
                  />
                </div>
              );
            })}
            {anyOn && (
              <button onClick={stopAll} className="w-full text-[11px] text-rose-400 hover:bg-rose-500/10 rounded-lg py-1.5 mt-1">
                Stop all sounds
              </button>
            )}
          </div>
        )}
      </Menu>

      {mix.lofi && started && (
        <iframe
          title="Lofi music"
          src={`https://www.youtube.com/embed/${LOFI_YOUTUBE_ID}?autoplay=1&loop=1&controls=0`}
          allow="autoplay; encrypted-media"
          className="fixed left-[-9999px] top-0 w-80 h-48 pointer-events-none"
        />
      )}
    </>
  );
}
