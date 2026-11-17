import { useState } from "react";
import { Sparkles } from "lucide-react";
import Modal from "../ui/Modal";

const STEPS = [
  { icon: "⏱️", title: "lock in together", text: "the room timer is shared — when anyone hits start, the whole squad's clock starts. go Solo for your own timer or a full mock test." },
  { icon: "🌱", title: "grow your plant", text: "every finished session = XP, a bigger plant and a longer streak. leave the tab mid-session and your plant wilts. no pressure 🙂" },
  { icon: "💬", title: "study w/ the squad", text: "chat with @mentions and formulas ($E=mc^2$), drop polls, raise your hand for doubts, make group tests, draw on the whiteboard or watch a lecture in sync — open any tool full screen and it opens for everyone." },
  { icon: "📝", title: "your notes, anywhere", text: "the yellow notes button is your private notebook — open it over a lecture or the whiteboard and write while you listen. only you can see it." },
  { icon: "🧰", title: "tools that go hard", text: "syllabus tracker with revision reminders, a day planner, a formula bank and your stats. press ? anytime for shortcuts." },
];

export default function TourModal({ onClose }) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const last = step === STEPS.length - 1;

  return (
    <Modal title="Welcome to StudyGroup" icon={<Sparkles className="w-4 h-4 text-indigo-400" />} onClose={onClose}>
      <div className="text-center space-y-3 py-2">
        <div className="text-5xl">{current.icon}</div>
        <h3 className="text-lg font-semibold text-slate-100">{current.title}</h3>
        <p className="text-sm text-slate-400 leading-relaxed">{current.text}</p>
      </div>
      <div className="flex items-center justify-between mt-6">
        <div className="flex gap-1.5">
          {STEPS.map((_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? "w-6 bg-indigo-500" : "w-1.5 bg-slate-700"}`} />
          ))}
        </div>
        <div className="flex gap-2">
          {step > 0 && <button onClick={() => setStep(step - 1)} className="px-3 py-2 text-sm text-slate-400 hover:text-slate-100">Back</button>}
          <button
            onClick={() => (last ? onClose() : setStep(step + 1))}
            className="pop px-5 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold"
          >
            {last ? "let's lock in 🔒" : "next"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
