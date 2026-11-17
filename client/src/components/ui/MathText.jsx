import katex from "katex";

// Renders text with $inline$ / $$block$$ LaTeX, clickable links and highlighted @mentions
const MATH = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g;
const LINK_OR_MENTION = /(https?:\/\/[^\s]+|@[\w.-]+)/g;

function renderMath(expr, displayMode) {
  // KaTeX escapes its input and `trust` is off by default, so the HTML it returns is safe to inject
  return katex.renderToString(expr, { throwOnError: false, displayMode, strict: "ignore" });
}

function Plain({ text, mentionClass }) {
  return text.split(LINK_OR_MENTION).map((part, i) => {
    if (/^https?:\/\//.test(part)) {
      return (
        <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 break-all hover:opacity-80">
          {part}
        </a>
      );
    }
    if (part.startsWith("@") && part.length > 1) {
      return <span key={i} className={mentionClass}>{part}</span>;
    }
    return part;
  });
}

export default function MathText({ text, className = "", mentionClass = "font-semibold text-indigo-300" }) {
  const parts = text.split(MATH);
  return (
    <span className={`whitespace-pre-wrap break-words ${className}`}>
      {parts.map((part, i) => {
        if (part.startsWith("$$") && part.endsWith("$$") && part.length > 4) {
          return <span key={i} className="block my-1 overflow-x-auto" dangerouslySetInnerHTML={{ __html: renderMath(part.slice(2, -2), true) }} />;
        }
        if (part.startsWith("$") && part.endsWith("$") && part.length > 2) {
          return <span key={i} dangerouslySetInnerHTML={{ __html: renderMath(part.slice(1, -1), false) }} />;
        }
        return <Plain key={i} text={part} mentionClass={mentionClass} />;
      })}
    </span>
  );
}
