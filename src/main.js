import { convertText, normalizeText, numberLines } from "./converter.js";

const source = document.querySelector("#source");
const result = document.querySelector("#result");
const status = document.querySelector("#status");
const sourceCount = document.querySelector("#sourceCount");
const resultCount = document.querySelector("#resultCount");
const issueCount = document.querySelector("#issueCount");
const detailsList = document.querySelector("#detailsList");

const sample = [
  "罗亚文.不动产物权期待权实体法外溢的反思与厘正——基于31份二手房“先卖后抵”判决书之整理[J].法治研究,2023(03):148-160.",
  "刘颖.物权期待权排除强制执行规则之再审思[J].当代法学,2023(01).",
  "王泽鉴.英美法导论[M].北京:北京大学出版社,2011:99-100."
].join("\n");

source.value = sample;
updateCounts();
runConvert();

document.querySelector("#normalizeBtn").addEventListener("click", () => {
  source.value = normalizeText(source.value);
  updateCounts();
  setStatus("已规范化");
});

document.querySelector("#convertBtn").addEventListener("click", runConvert);

document.querySelector("#numberBtn").addEventListener("click", () => {
  if (result.value.trim()) {
    result.value = numberExistingLines(result.value);
  } else {
    source.value = numberLines(source.value);
  }
  updateCounts();
  setStatus("已编号");
});

document.querySelector("#copyBtn").addEventListener("click", async () => {
  const text = result.value.trim();
  if (!text) {
    setStatus("没有可复制内容");
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    setStatus("已复制");
  } catch {
    result.select();
    document.execCommand("copy");
    setStatus("已复制");
  }
});

document.querySelector("#clearBtn").addEventListener("click", () => {
  source.value = "";
  result.value = "";
  renderDetails([]);
  updateCounts();
  setStatus("已清空");
});

source.addEventListener("input", updateCounts);

function runConvert() {
  const converted = convertText(source.value);
  result.value = converted.map((item) => item.output).join("\n");
  renderDetails(converted);
  updateCounts();
  const unknownCount = converted.filter((item) => item.type === "unknown").length;
  setStatus(unknownCount ? `${unknownCount} 条需检查` : "转换完成");
}

function renderDetails(items) {
  detailsList.innerHTML = "";
  const warnings = items.flatMap((item) => item.warnings);
  issueCount.textContent = `${warnings.length} 个提示`;

  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "暂无解析结果";
    detailsList.append(empty);
    return;
  }

  for (const item of items) {
    const row = document.createElement("div");
    row.className = `detail-row ${item.type}`;

    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = item.typeLabel;

    const text = document.createElement("p");
    text.textContent = item.warnings.length
      ? `第 ${item.lineNumber} 条：${item.warnings.join("；")}`
      : `第 ${item.lineNumber} 条：已识别`;

    row.append(badge, text);
    detailsList.append(row);
  }
}

function updateCounts() {
  const inputLines = normalizeText(source.value).split("\n").filter(Boolean).length;
  const outputLines = result.value.split("\n").filter(Boolean).length;
  sourceCount.textContent = `${inputLines} 行`;
  resultCount.textContent = `${outputLines} 条`;
}

function setStatus(text) {
  status.textContent = text;
}

function numberExistingLines(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => `[${index + 1}] ${line.replace(/^\s*(?:\[\d+\]|\d+[.、]|[(（]\d+[)）])\s*/, "")}`)
    .join("\n");
}
