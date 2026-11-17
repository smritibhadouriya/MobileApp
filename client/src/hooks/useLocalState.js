import { useEffect, useState } from "react";
import { readJSON, writeJSON } from "../lib/storage";

// useState that is saved to localStorage under `key`
export default function useLocalState(key, fallback) {
  const [value, setValue] = useState(() => readJSON(key, fallback));
  useEffect(() => writeJSON(key, value), [key, value]);
  return [value, setValue];
}
