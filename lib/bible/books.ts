export type BookEntry = {
  usfm: string
  name: string
  aliases: string[]
  chapters: number
}

export const BOOKS: BookEntry[] = [
  // Old Testament
  { usfm: "GEN", name: "Genesis", aliases: ["gen", "ge", "gn"], chapters: 50 },
  { usfm: "EXO", name: "Exodus", aliases: ["exo", "ex", "exod"], chapters: 40 },
  { usfm: "LEV", name: "Leviticus", aliases: ["lev", "le", "lv"], chapters: 27 },
  { usfm: "NUM", name: "Numbers", aliases: ["num", "nu", "nm", "nb"], chapters: 36 },
  { usfm: "DEU", name: "Deuteronomy", aliases: ["deu", "dt", "deut"], chapters: 34 },
  { usfm: "JOS", name: "Joshua", aliases: ["jos", "jsh", "josh"], chapters: 24 },
  { usfm: "JDG", name: "Judges", aliases: ["jdg", "judg", "jg", "jdgs"], chapters: 21 },
  { usfm: "RUT", name: "Ruth", aliases: ["rut", "rth", "ru"], chapters: 4 },
  { usfm: "1SA", name: "1 Samuel", aliases: ["1sa", "1sam", "1 sam", "1 samuel", "1s"], chapters: 31 },
  { usfm: "2SA", name: "2 Samuel", aliases: ["2sa", "2sam", "2 sam", "2 samuel", "2s"], chapters: 24 },
  { usfm: "1KI", name: "1 Kings", aliases: ["1ki", "1 ki", "1kings", "1 kings"], chapters: 22 },
  { usfm: "2KI", name: "2 Kings", aliases: ["2ki", "2 ki", "2kings", "2 kings"], chapters: 25 },
  { usfm: "1CH", name: "1 Chronicles", aliases: ["1ch", "1chr", "1 chr", "1 chronicles"], chapters: 29 },
  { usfm: "2CH", name: "2 Chronicles", aliases: ["2ch", "2chr", "2 chr", "2 chronicles"], chapters: 36 },
  { usfm: "EZR", name: "Ezra", aliases: ["ezr"], chapters: 10 },
  { usfm: "NEH", name: "Nehemiah", aliases: ["neh", "ne"], chapters: 13 },
  { usfm: "EST", name: "Esther", aliases: ["est", "esth"], chapters: 10 },
  { usfm: "JOB", name: "Job", aliases: ["job", "jb"], chapters: 42 },
  { usfm: "PSA", name: "Psalms", aliases: ["psa", "ps", "psalm", "psalms"], chapters: 150 },
  { usfm: "PRO", name: "Proverbs", aliases: ["pro", "prov", "pr", "prv"], chapters: 31 },
  { usfm: "ECC", name: "Ecclesiastes", aliases: ["ecc", "eccl", "ec", "qoh"], chapters: 12 },
  { usfm: "SNG", name: "Song of Songs", aliases: ["sng", "sos", "song", "sos", "ss", "song of solomon"], chapters: 8 },
  { usfm: "ISA", name: "Isaiah", aliases: ["isa", "is"], chapters: 66 },
  { usfm: "JER", name: "Jeremiah", aliases: ["jer", "je"], chapters: 52 },
  { usfm: "LAM", name: "Lamentations", aliases: ["lam", "la"], chapters: 5 },
  { usfm: "EZK", name: "Ezekiel", aliases: ["ezk", "eze", "ezek"], chapters: 48 },
  { usfm: "DAN", name: "Daniel", aliases: ["dan", "da", "dn"], chapters: 12 },
  { usfm: "HOS", name: "Hosea", aliases: ["hos", "ho"], chapters: 14 },
  { usfm: "JOL", name: "Joel", aliases: ["jol", "joel", "jl"], chapters: 3 },
  { usfm: "AMO", name: "Amos", aliases: ["amo", "amos", "am"], chapters: 9 },
  { usfm: "OBA", name: "Obadiah", aliases: ["oba", "obad", "ob"], chapters: 1 },
  { usfm: "JON", name: "Jonah", aliases: ["jon", "jnh", "jona"], chapters: 4 },
  { usfm: "MIC", name: "Micah", aliases: ["mic", "mi"], chapters: 7 },
  { usfm: "NAM", name: "Nahum", aliases: ["nam", "nah", "na"], chapters: 3 },
  { usfm: "HAB", name: "Habakkuk", aliases: ["hab", "hb"], chapters: 3 },
  { usfm: "ZEP", name: "Zephaniah", aliases: ["zep", "zeph", "zp"], chapters: 3 },
  { usfm: "HAG", name: "Haggai", aliases: ["hag", "hg"], chapters: 2 },
  { usfm: "ZEC", name: "Zechariah", aliases: ["zec", "zech", "zc"], chapters: 14 },
  { usfm: "MAL", name: "Malachi", aliases: ["mal", "ml"], chapters: 4 },
  // New Testament
  { usfm: "MAT", name: "Matthew", aliases: ["mat", "mt", "matt"], chapters: 28 },
  { usfm: "MRK", name: "Mark", aliases: ["mrk", "mk", "mar"], chapters: 16 },
  { usfm: "LUK", name: "Luke", aliases: ["luk", "lk"], chapters: 24 },
  { usfm: "JHN", name: "John", aliases: ["jhn", "jn", "joh"], chapters: 21 },
  { usfm: "ACT", name: "Acts", aliases: ["act", "ac"], chapters: 28 },
  { usfm: "ROM", name: "Romans", aliases: ["rom", "ro", "rm"], chapters: 16 },
  { usfm: "1CO", name: "1 Corinthians", aliases: ["1co", "1cor", "1 cor", "1 corinthians"], chapters: 16 },
  { usfm: "2CO", name: "2 Corinthians", aliases: ["2co", "2cor", "2 cor", "2 corinthians"], chapters: 13 },
  { usfm: "GAL", name: "Galatians", aliases: ["gal", "ga"], chapters: 6 },
  { usfm: "EPH", name: "Ephesians", aliases: ["eph"], chapters: 6 },
  { usfm: "PHP", name: "Philippians", aliases: ["php", "phil", "pp"], chapters: 4 },
  { usfm: "COL", name: "Colossians", aliases: ["col"], chapters: 4 },
  { usfm: "1TH", name: "1 Thessalonians", aliases: ["1th", "1 th", "1thess", "1 thessalonians"], chapters: 5 },
  { usfm: "2TH", name: "2 Thessalonians", aliases: ["2th", "2 th", "2thess", "2 thessalonians"], chapters: 3 },
  { usfm: "1TI", name: "1 Timothy", aliases: ["1ti", "1tim", "1 tim", "1 timothy"], chapters: 6 },
  { usfm: "2TI", name: "2 Timothy", aliases: ["2ti", "2tim", "2 tim", "2 timothy"], chapters: 4 },
  { usfm: "TIT", name: "Titus", aliases: ["tit", "ti"], chapters: 3 },
  { usfm: "PHM", name: "Philemon", aliases: ["phm", "phlm", "philem"], chapters: 1 },
  { usfm: "HEB", name: "Hebrews", aliases: ["heb"], chapters: 13 },
  { usfm: "JAS", name: "James", aliases: ["jas", "jm"], chapters: 5 },
  { usfm: "1PE", name: "1 Peter", aliases: ["1pe", "1pet", "1 pet", "1 peter"], chapters: 5 },
  { usfm: "2PE", name: "2 Peter", aliases: ["2pe", "2pet", "2 pet", "2 peter"], chapters: 3 },
  { usfm: "1JN", name: "1 John", aliases: ["1jn", "1 jn", "1john", "1 john"], chapters: 5 },
  { usfm: "2JN", name: "2 John", aliases: ["2jn", "2 jn", "2john", "2 john"], chapters: 1 },
  { usfm: "3JN", name: "3 John", aliases: ["3jn", "3 jn", "3john", "3 john"], chapters: 1 },
  { usfm: "JUD", name: "Jude", aliases: ["jud", "jd"], chapters: 1 },
  { usfm: "REV", name: "Revelation", aliases: ["rev", "re", "rv"], chapters: 22 },
]

const lookupMap = new Map<string, BookEntry>()
for (const b of BOOKS) {
  lookupMap.set(b.usfm.toLowerCase(), b)
  lookupMap.set(b.name.toLowerCase(), b)
  for (const a of b.aliases) lookupMap.set(a.toLowerCase(), b)
}

export function findBook(query: string): BookEntry | null {
  return lookupMap.get(query.trim().toLowerCase()) ?? null
}

export type ParsedReference = {
  book: BookEntry
  chapter: number
  verseStart: number
  verseEnd?: number
  canonical: string
}

const REFERENCE_RE =
  /^\s*((?:[123]\s*)?[a-zA-Z]+(?:\s+[a-zA-Z]+)?)\s+(\d+)(?::(\d+)(?:\s*-\s*(\d+))?)?\s*$/

export function parseReference(input: string): ParsedReference | null {
  const m = REFERENCE_RE.exec(input)
  if (!m) return null
  const [, rawBook, rawChap, rawVerseStart, rawVerseEnd] = m
  const book = findBook(rawBook.replace(/\s+/g, " ").trim())
  if (!book) return null
  const chapter = parseInt(rawChap, 10)
  if (chapter < 1 || chapter > book.chapters) return null
  const verseStart = rawVerseStart ? parseInt(rawVerseStart, 10) : 1
  const verseEnd = rawVerseEnd ? parseInt(rawVerseEnd, 10) : undefined
  if (verseEnd != null && verseEnd < verseStart) return null
  const canonical = verseStart
    ? verseEnd
      ? `${book.name} ${chapter}:${verseStart}-${verseEnd}`
      : rawVerseStart
        ? `${book.name} ${chapter}:${verseStart}`
        : `${book.name} ${chapter}`
    : `${book.name} ${chapter}`
  return { book, chapter, verseStart, verseEnd, canonical }
}
