import Anthropic from "@anthropic-ai/sdk";

// Enabled only when credentials are configured (ANTHROPIC_API_KEY in the server environment)
export const aiEnabled = Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

const client = aiEnabled ? new Anthropic() : null;

const SYSTEM_PROMPT = `You are "AI Tutor", a friendly study helper inside a group study room used mostly by Indian school and college students (JEE, NEET, boards, university).
Answer the student's doubt clearly and concisely, in a few short paragraphs or steps that fit in a chat bubble.
Reply in the same language style the student used (English, Hindi or Hinglish).
For maths and science, show the key steps and write formulas in LaTeX between single dollar signs, e.g. $F = ma$.
If the question is not about studying, gently steer back to the study session.`;

// ================= TEST GENERATOR =================
const TEST_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string", description: "Short test title, e.g. 'Rotational Motion — Quick Test'" },
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          question: { type: "string" },
          options: { type: "array", items: { type: "string" }, description: "Exactly 4 options" },
          answer: { type: "integer", description: "Index (0-3) of the correct option" },
          explanation: { type: "string", description: "1-3 sentences on why the answer is correct" },
          topic: { type: "string", description: "Sub-topic this question tests" },
        },
        required: ["question", "options", "answer", "explanation", "topic"],
        additionalProperties: false,
      },
    },
  },
  required: ["title", "questions"],
  additionalProperties: false,
};

const TEST_SYSTEM_PROMPT = `You write multiple-choice practice tests for Indian students (JEE, NEET, CBSE boards, university exams).
Rules:
- Every question has exactly 4 options and exactly one correct answer; "answer" is the 0-based index of the correct option.
- Vary which option position is correct across the test.
- Distractors must be plausible (common mistakes), never joke options.
- Write maths, physics and chemistry in LaTeX between single dollar signs, e.g. $v = u + at$.
- Explanations are short and teach the idea, 1-3 sentences.
- Write questions in clear English unless the source material is in Hindi.`;

/**
 * source: { mode: "notes" | "topic", text?, topic?, exam?, file?: { data (base64), mediaType } }
 * Returns { ok, title, questions } or { ok: false, error }.
 */
export async function generateTest({ source, count, difficulty }) {
  const content = [];
  if (source.file) {
    const block = source.file.mediaType === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: source.file.data } }
      : { type: "image", source: { type: "base64", media_type: source.file.mediaType, data: source.file.data } };
    content.push(block);
  }
  const task =
    source.mode === "notes"
      ? `Create a test of ${count} questions at ${difficulty} difficulty using ONLY the concepts in the student's notes${source.file ? " (attached)" : ""}. Do not test anything the notes don't cover.${source.text ? `\n\nNotes:\n"""\n${source.text}\n"""` : ""}`
      : `Create a test of ${count} questions at ${difficulty} difficulty on this topic: "${source.topic}"${source.exam ? `, at the level of ${source.exam}` : ""}.`;
  content.push({ type: "text", text: task });

  try {
    const response = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      output_config: { effort: "medium", format: { type: "json_schema", schema: TEST_SCHEMA } },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: TEST_SYSTEM_PROMPT,
      messages: [{ role: "user", content }],
    });

    if (response.stop_reason === "refusal") return { ok: false, error: "AI couldn't make a test from this. Try different notes or a topic." };
    if (response.stop_reason === "max_tokens") return { ok: false, error: "That test was too long to generate. Try fewer questions." };
    const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    const parsed = JSON.parse(text);
    return { ok: true, title: parsed.title, questions: parsed.questions };
  } catch (error) {
    if (error instanceof SyntaxError) return { ok: false, error: "AI returned a broken test. Please try again." };
    if (error instanceof Anthropic.BadRequestError) {
      console.error("Test generator bad request:", error.message);
      return { ok: false, error: "AI couldn't read that file. Try a smaller PDF/photo or paste the notes as text." };
    }
    if (error instanceof Anthropic.AuthenticationError) return { ok: false, error: "AI is not configured correctly on the server." };
    if (error instanceof Anthropic.RateLimitError) return { ok: false, error: "AI is busy right now. Try again in a minute." };
    if (error instanceof Anthropic.APIError) {
      console.error(`Test generator API error ${error.status}:`, error.message);
      return { ok: false, error: "AI ran into a problem. Please try again." };
    }
    console.error("Test generator failed:", error);
    return { ok: false, error: "AI couldn't be reached." };
  }
}

export async function askTutor(question, recentChat) {
  const context = recentChat.length
    ? `Recent room chat for context:\n${recentChat.map((m) => `${m.sender}: ${m.text}`).join("\n")}\n\n`
    : "";

  try {
    const response = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 4000,
      // Chat-style answers: low effort keeps replies fast and cheap
      output_config: { effort: "low" },
      // Retry on a fallback model automatically if a request is declined
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: `${context}Student's question: ${question}` }],
    });

    if (response.stop_reason === "refusal") {
      return { ok: false, error: "AI Tutor couldn't answer that one. Try rephrasing your question." };
    }
    const text = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();
    return text ? { ok: true, text } : { ok: false, error: "AI Tutor gave an empty answer. Please try again." };
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      console.error("AI Tutor: invalid API key");
      return { ok: false, error: "AI Tutor is not configured correctly on the server." };
    }
    if (error instanceof Anthropic.RateLimitError) {
      return { ok: false, error: "AI Tutor is busy right now. Try again in a minute." };
    }
    if (error instanceof Anthropic.APIError) {
      console.error(`AI Tutor API error ${error.status}:`, error.message);
      return { ok: false, error: "AI Tutor ran into a problem. Please try again." };
    }
    console.error("AI Tutor failed:", error);
    return { ok: false, error: "AI Tutor couldn't be reached." };
  }
}
