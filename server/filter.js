// Basic profanity filter (English + common Hinglish). Extend the list as needed.
const BAD_WORDS = [
  "fuck", "fucking", "shit", "bitch", "bastard", "asshole", "dick", "cunt", "slut",
  "madarchod", "behenchod", "bhenchod", "benchod", "chutiya", "chutiye", "gandu", "bhosdike", "bhosdi", "randi", "harami", "lodu", "lavde", "lund",
];

const pattern = new RegExp(`\\b(${BAD_WORDS.join("|")})\\b`, "gi");

export const filterText = (text) => text.replace(pattern, (word) => word[0] + "*".repeat(word.length - 1));
