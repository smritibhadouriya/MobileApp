// Helpers shared by the group-test screens

export function testStatus(test, now) {
  if (test.ended || now >= test.endsAt) return "ended";
  if (now >= test.startsAt) return "live";
  return "upcoming";
}

export function formatCountdown(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export const formatDuration = (seconds) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m ? `${m}m ${String(s).padStart(2, "0")}s` : `${s}s`;
};

export const formatTimeOfDay = (ts) => new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

export const MAX_FILE_BYTES = 5 * 1024 * 1024;

// Reads a notes file: text files become text, PDFs and photos become base64 for the AI
export function readNotesFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    if (/^text\/|\.(txt|md)$/i.test(file.type || file.name)) {
      reader.onload = () => resolve({ kind: "text", text: String(reader.result) });
      reader.readAsText(file);
      return;
    }
    if (file.size > MAX_FILE_BYTES) return reject(new Error("File is too big — keep it under 5 MB."));
    const mediaType = file.type === "image/jpg" ? "image/jpeg" : file.type;
    if (!["application/pdf", "image/png", "image/jpeg", "image/webp", "image/gif"].includes(mediaType)) {
      return reject(new Error("Upload a PDF, a photo (PNG/JPG/WEBP) or a .txt file."));
    }
    reader.onload = () => resolve({ kind: "file", name: file.name, mediaType, data: String(reader.result).split(",")[1] });
    reader.readAsDataURL(file);
  });
}

export const emptyQuestion = () => ({ question: "", options: ["", "", "", ""], answer: 0, explanation: "", topic: "" });

export const isQuestionComplete = (q) =>
  q.question.trim() && q.options.filter((o) => o.trim()).length >= 2 && q.options[q.answer]?.trim();
