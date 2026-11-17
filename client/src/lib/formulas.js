// Seed formulas shown the first time the formula bank opens
export const STARTER_FORMULAS = [
  { subject: "Physics", title: "Newton's second law", latex: "F = \\frac{dp}{dt} = ma" },
  { subject: "Physics", title: "Kinematics", latex: "v^2 = u^2 + 2as" },
  { subject: "Physics", title: "Coulomb's law", latex: "F = \\frac{1}{4\\pi\\varepsilon_0}\\frac{q_1 q_2}{r^2}" },
  { subject: "Chemistry", title: "Ideal gas equation", latex: "PV = nRT" },
  { subject: "Chemistry", title: "Nernst equation", latex: "E = E^\\circ - \\frac{0.0591}{n}\\log Q" },
  { subject: "Maths", title: "Quadratic formula", latex: "x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}" },
  { subject: "Maths", title: "Product rule", latex: "\\frac{d}{dx}(uv) = u\\frac{dv}{dx} + v\\frac{du}{dx}" },
].map((f, i) => ({ id: `starter-${i}`, ...f }));
