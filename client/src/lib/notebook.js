import { newId } from "./storage";

export const newPage = (title = "Lecture notes") => ({ id: newId(), title, text: "", updatedAt: Date.now() });

// All pages as one text (used to make a test from your notes)
export const notebookText = (notebook) =>
  notebook.pages
    .filter((p) => p.text.trim())
    .map((p) => `## ${p.title}\n${p.text}`)
    .join("\n\n")
    .slice(0, 30000);
