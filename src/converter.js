const TYPE_LABELS = { journal: "期刊", book: "专著", dissertation: "学位论文", unknown: "未识别" };

const FULL_WIDTH_MAP = new Map([
  ["．", "."], ["。", "."], ["，", ","], ["：", ":"], ["；", ";"], ["（", "("], ["）", ")"],
  ["［", "["], ["］", "]"], ["【", "["], ["】", "]"], ["“", "\""], ["”", "\""], ["‘", "'"], ["’", "'"]
]);
const PAGE_RANGE_PATTERN = "[A-Za-z0-9一二三四五六七八九十百千万第页,，、\\-–—~～]+";

export function normalizeText(text) {
  return Array.from(text)
    .map((char) => FULL_WIDTH_MAP.get(char) ?? char)
    .join("")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .replace(/([JMD])\]\.\s+(?=[^\n]{1,100}\[[JMD]\]\.)/g, "$1].\n")
    .replace(new RegExp(`(\\d{4}(?:,?\\([^)]+\\)|,?\\d+\\([^)]+\\)|,?\\d+)?(?::${PAGE_RANGE_PATTERN})?\\.)\\s+(?=[^\\n]{1,100}\\[[JMD]\\]\\.)`, "g"), "$1\n")
    .split("\n")
    .map((line) => stripLeadingNumber(line.trim()))
    .filter(Boolean)
    .join("\n");
}

export function convertText(text, options = {}) {
  const results = normalizeText(text).split("\n").filter(Boolean).map((line, index) => convertLine(line, index + 1));
  if (!options.numbered) return results;
  return results.map((item, index) => ({ ...item, output: `[${index + 1}] ${item.output}` }));
}

export function convertLine(rawLine, lineNumber = 1) {
  const parsed = parseStandardCitation(stripTrailingDot(stripLeadingNumber(rawLine.trim()))) ?? parseCnkiCitation(stripTrailingDot(stripLeadingNumber(rawLine.trim())));
  if (!parsed) {
    return { lineNumber, input: rawLine, output: `${rawLine} [未识别]`, type: "unknown", typeLabel: TYPE_LABELS.unknown, warnings: ["未识别，请人工调整格式"] };
  }
  const warnings = parsed.type === "dissertation" ? ["学位论文默认按博士学位论文处理"] : [];
  return { lineNumber, input: rawLine, output: formatCitation(parsed), type: parsed.type, typeLabel: TYPE_LABELS[parsed.type], warnings };
}

export function numberLines(text) {
  return normalizeText(text).split("\n").filter(Boolean).map((line, index) => `[${index + 1}] ${stripLeadingNumber(line)}`).join("\n");
}

function parseStandardCitation(line) {
  const typeMatch = line.match(/\[([JMD])\]/);
  if (!typeMatch) return null;
  const type = mapType(typeMatch[1]);
  const beforeType = line.slice(0, typeMatch.index);
  const afterType = line.slice(typeMatch.index + typeMatch[0].length).replace(/^\./, "");
  const firstDot = beforeType.indexOf(".");
  if (firstDot < 1) return null;
  const author = beforeType.slice(0, firstDot).trim();
  const title = beforeType.slice(firstDot + 1).trim();
  if (!author || !title) return null;
  if (type === "journal") {
    const journal = parseJournalTail(afterType);
    return journal ? { type, author, title, ...journal } : null;
  }
  if (type === "book") {
    const match = afterType.match(new RegExp(`^(?:(.+?):)?(.+?),(\\d{4})(?::(${PAGE_RANGE_PATTERN}))?$`));
    return match ? { type, author, title, publisher: match[2].trim(), year: match[3], pages: match[4] } : null;
  }
  if (type === "dissertation") {
    const match = afterType.match(new RegExp(`^(?:(.+?):)?(.+?),(\\d{4})(?::(${PAGE_RANGE_PATTERN}))?$`));
    return match ? { type, author, title, school: match[2].trim(), year: match[3], pages: match[4] } : null;
  }
  return null;
}

function parseCnkiCitation(line) {
  const typeMatch = line.match(/\[([JMD])\]\./);
  if (!typeMatch) return null;
  const type = mapType(typeMatch[1]);
  const title = line.slice(0, typeMatch.index).trim();
  const parts = line.slice(typeMatch.index + typeMatch[0].length).split(".").map((part) => part.trim()).filter(Boolean);
  if (!title || parts.length < 2) return null;
  const author = parts[0];
  if (type === "journal") {
    const journal = parseJournalTail(parts.slice(1).join("."));
    return journal ? { type, author, title, ...journal } : null;
  }
  if (type === "book") {
    const [publisher, year] = [parts[1], parts[2] || ""];
    return /^\d{4}$/.test(year) ? { type, author, title, publisher, year } : null;
  }
  if (type === "dissertation") {
    const match = parts.slice(1).join(".").match(new RegExp(`^(.+?),(\\d{4})(?::(${PAGE_RANGE_PATTERN}))?$`));
    return match ? { type, author, title, school: match[1].trim(), year: match[2], pages: match[3] } : null;
  }
  return null;
}

function parseJournalTail(text) {
  const sourceAndYear = text.match(/^(.+?),\s*(\d{4})(.*)$/);
  if (!sourceAndYear) return null;
  const source = sourceAndYear[1].trim();
  const year = sourceAndYear[2];
  const rest = sourceAndYear[3].trim();
  if (!source) return null;
  if (!rest) return { source, year };
  const tail = rest.match(new RegExp(`^,?\\s*(?:(?:([0-9A-Za-z]+)\\s*)?\\(([^)]+)\\)|([0-9A-Za-z]+))?(?::\\s*(${PAGE_RANGE_PATTERN}))?$`));
  return tail ? { source, year, issue: tail[2] || tail[3], pages: tail[4] } : null;
}

function formatCitation(citation) {
  const author = formatAuthors(citation.author);
  const pages = citation.pages ? `，第${citation.pages}页` : "";
  if (citation.type === "journal") return `${author}：《${citation.title}》，《${citation.source}》${citation.year}年${citation.issue ? `第${citation.issue}期` : ""}${pages}。`;
  if (citation.type === "book") return `${author}：《${citation.title}》，${citation.publisher}${citation.year}年版${pages}。`;
  return `${author}：《${citation.title}》，${citation.school}${citation.year}年博士学位论文${pages}。`;
}

function formatAuthors(authorText) {
  const authors = authorText.split(/[,，、;]/).map((author) => author.trim()).filter(Boolean);
  return authors.length >= 3 ? `${authors[0]}等` : authors.join("、") || authorText.trim();
}
function mapType(typeCode) { return { J: "journal", M: "book", D: "dissertation" }[typeCode]; }
function stripLeadingNumber(line) { return line.replace(/^\s*(?:\[\d+\]|\d+[.、]|[(（]\d+[)）])\s*/, ""); }
function stripTrailingDot(line) { return line.replace(/[.。]\s*$/, ""); }
