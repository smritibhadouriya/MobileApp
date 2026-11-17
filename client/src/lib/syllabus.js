import { readJSON, writeJSON } from "./storage";

// Chapter lists are condensed; students can add their own chapters per subject.
const PHYSICS = [
  "Units & Measurements", "Kinematics", "Laws of Motion", "Work, Energy & Power", "Rotational Motion",
  "Gravitation", "Properties of Solids & Liquids", "Thermodynamics", "Kinetic Theory of Gases",
  "Oscillations & Waves", "Electrostatics", "Current Electricity", "Magnetic Effects of Current",
  "Magnetism & Matter", "Electromagnetic Induction", "Alternating Current", "Electromagnetic Waves",
  "Ray Optics", "Wave Optics", "Dual Nature of Matter", "Atoms & Nuclei", "Semiconductors",
];
const CHEMISTRY = [
  "Some Basic Concepts", "Atomic Structure", "Chemical Bonding", "States of Matter", "Thermodynamics (Chem)",
  "Equilibrium", "Redox Reactions", "Solutions", "Electrochemistry", "Chemical Kinetics",
  "Periodic Table", "p-Block Elements", "d & f Block Elements", "Coordination Compounds",
  "General Organic Chemistry", "Hydrocarbons", "Haloalkanes & Haloarenes", "Alcohols, Phenols & Ethers",
  "Aldehydes, Ketones & Acids", "Amines", "Biomolecules",
];
const MATHS_JEE = [
  "Sets & Relations", "Complex Numbers", "Quadratic Equations", "Matrices & Determinants",
  "Permutations & Combinations", "Binomial Theorem", "Sequences & Series", "Limits & Continuity",
  "Differentiation", "Application of Derivatives", "Integrals", "Differential Equations",
  "Straight Lines", "Circles", "Conic Sections", "3D Geometry", "Vector Algebra",
  "Probability", "Statistics", "Trigonometry",
];
const BIOLOGY = [
  "Diversity in Living World", "Structural Organisation", "Cell Structure & Function", "Plant Physiology",
  "Human Physiology", "Reproduction", "Genetics & Evolution", "Biology & Human Welfare",
  "Biotechnology", "Ecology & Environment",
];

export const EXAMS = {
  JEE: { label: "JEE Main / Advanced", subjects: { Physics: PHYSICS, Chemistry: CHEMISTRY, Maths: MATHS_JEE } },
  NEET: { label: "NEET", subjects: { Physics: PHYSICS, Chemistry: CHEMISTRY, Biology: BIOLOGY } },
  CBSE12: {
    label: "Class 12 Boards",
    subjects: {
      Physics: PHYSICS.slice(10),
      Chemistry: ["Solutions", "Electrochemistry", "Chemical Kinetics", "d & f Block Elements", "Coordination Compounds", "Haloalkanes & Haloarenes", "Alcohols, Phenols & Ethers", "Aldehydes, Ketones & Acids", "Amines", "Biomolecules"],
      Maths: ["Relations & Functions", "Inverse Trigonometry", "Matrices", "Determinants", "Continuity & Differentiability", "Application of Derivatives", "Integrals", "Application of Integrals", "Differential Equations", "Vectors", "3D Geometry", "Linear Programming", "Probability"],
      Biology: ["Sexual Reproduction in Flowering Plants", "Human Reproduction", "Reproductive Health", "Inheritance & Variation", "Molecular Basis of Inheritance", "Evolution", "Human Health & Disease", "Microbes in Human Welfare", "Biotechnology", "Organisms & Populations", "Ecosystem", "Biodiversity"],
    },
  },
  CBSE10: {
    label: "Class 10 Boards",
    subjects: {
      Maths: ["Real Numbers", "Polynomials", "Linear Equations", "Quadratic Equations", "Arithmetic Progressions", "Triangles", "Coordinate Geometry", "Trigonometry", "Applications of Trigonometry", "Circles", "Areas Related to Circles", "Surface Areas & Volumes", "Statistics", "Probability"],
      Science: ["Chemical Reactions", "Acids, Bases & Salts", "Metals & Non-metals", "Carbon Compounds", "Life Processes", "Control & Coordination", "Reproduction", "Heredity", "Light", "Human Eye", "Electricity", "Magnetic Effects", "Our Environment"],
      "Social Science": ["Nationalism in Europe", "Nationalism in India", "Global World", "Industrialisation", "Print Culture", "Resources & Development", "Water Resources", "Agriculture", "Minerals & Energy", "Power Sharing", "Federalism", "Political Parties", "Development", "Money & Credit", "Globalisation"],
    },
  },
};

// Spaced repetition: revise 1, 3, 7, 21 and 60 days after finishing a chapter
export const REVISION_DAYS = [1, 3, 7, 21, 60];
const DAY = 24 * 60 * 60 * 1000;

const KEY = "fs:syllabus";
const DEFAULT = { exam: "JEE", done: {}, custom: {} };

export const loadSyllabus = () => ({ ...DEFAULT, ...readJSON(KEY, {}) });
export const saveSyllabus = (data) => writeJSON(KEY, data);

export const chapterKey = (exam, subject, chapter) => `${exam}|${subject}|${chapter}`;

export function subjectsFor(data) {
  const base = EXAMS[data.exam]?.subjects || {};
  const merged = {};
  for (const [subject, chapters] of Object.entries(base)) {
    merged[subject] = [...chapters, ...(data.custom[`${data.exam}|${subject}`] || [])];
  }
  return merged;
}

export function nextRevision(entry) {
  if (!entry) return null;
  const count = entry.revisions?.length || 0;
  if (count >= REVISION_DAYS.length) return null;
  const from = count ? entry.revisions[count - 1] : entry.doneAt;
  const gap = REVISION_DAYS[count] - (count ? REVISION_DAYS[count - 1] : 0);
  return from + gap * DAY;
}

// Returns a copy with the chapter ticked (scheduling its revisions) or unticked
export function toggleChapter(data, key) {
  const done = { ...data.done };
  if (done[key]) delete done[key];
  else done[key] = { doneAt: Date.now(), revisions: [] };
  return { ...data, done };
}

export function markRevised(data, key) {
  const entry = data.done[key];
  return { ...data, done: { ...data.done, [key]: { ...entry, revisions: [...(entry.revisions || []), Date.now()] } } };
}

export function dueRevisions(data, now) {
  return Object.entries(data.done)
    .map(([key, entry]) => {
      const [exam, subject, chapter] = key.split("|");
      return { key, exam, subject, chapter, due: nextRevision(entry), round: (entry.revisions?.length || 0) + 1 };
    })
    .filter((r) => r.exam === data.exam && r.due && r.due <= now)
    .sort((a, b) => a.due - b.due);
}
