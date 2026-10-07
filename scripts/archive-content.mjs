import fs from "node:fs/promises";

const requiredFields = [
  "id",
  "title",
  "en",
  "department",
  "category",
  "date",
  "lead",
  "clearance",
  "abstract",
  "source",
];
const isText = (value) => typeof value === "string" && value.trim().length > 0;
const isWebUrl = (value) => {
  try {
    return ["https:", "http:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};
// Media may live in public/ (site-relative path) or on another HTTPS host.
const isMediaPath = (value) =>
  isText(value) && (isWebUrl(value) || /^(?!\/\/)[\w\-./]+$/.test(value.replace(/^\//, "")) && !value.includes(".."));

function validateMedia(record, label, errors) {
  if (record.tags !== undefined && (!Array.isArray(record.tags) || !record.tags.every(isText)))
    errors.push(`${label}.tags：必须是非空文本数组`);
  for (const key of ["cover", "hero", "video", "unity"])
    if (record[key] !== undefined && !isMediaPath(record[key]))
      errors.push(`${label}.${key}：必须是 public 目录内的路径或 HTTP(S) 链接`);
  if (record.gallery !== undefined && (!Array.isArray(record.gallery) ||
    !record.gallery.every((item) => item && isMediaPath(item.src) && (item.caption === undefined || isText(item.caption)))))
    errors.push(`${label}.gallery：每项需要有效的 src，caption 可选`);
  if (record.links !== undefined && (!Array.isArray(record.links) ||
    !record.links.every((item) => item && isText(item.label) && isWebUrl(item.url))))
    errors.push(`${label}.links：每项需要 label 和 HTTP(S) url`);
}

export function validateContent(content) {
  const errors = [];
  if (!content || typeof content !== "object" || Array.isArray(content)) {
    throw new Error("档案数据必须是 JSON 对象。");
  }
  for (const key of ["categories", "columns"]) {
    const names = content[key];
    if (!Array.isArray(names) || names.length !== 5 || !names.every(isText)) {
      errors.push(`${key}：必须包含五个非空分类名称`);
    } else if (new Set(names).size !== 5 || names.includes("全部档案")) {
      errors.push(`${key}：分类名称不能重复，也不能使用“全部档案”`);
    }
  }
  const categories = Array.isArray(content.categories)
    ? content.categories
    : [];
  const columns = Array.isArray(content.columns) ? content.columns : [];
  if (
    categories.some((name) => !columns.includes(name)) ||
    columns.some((name) => !categories.includes(name))
  ) {
    errors.push("categories 与 columns 必须包含相同的五个分类（顺序可以不同）");
  }
  const records = Array.isArray(content.records) ? content.records : [];
  if (records.length !== 40) errors.push("records：当前阵列要求四十份档案");
  const ids = new Set();
  records.forEach((record, index) => {
    const label = `records[${index}]`;
    if (!record || typeof record !== "object" || Array.isArray(record)) {
      errors.push(`${label}：必须是档案对象`);
      return;
    }
    for (const key of requiredFields) {
      if (!isText(record[key])) errors.push(`${label}.${key}：必须是非空文本`);
    }
    const expectedId = `X-${String(index + 1).padStart(3, "0")}`;
    if (record.id !== expectedId)
      errors.push(`${label}.id：应为 ${expectedId}，编号须按顺序保持稳定`);
    if (ids.has(record.id)) errors.push(`${label}.id：重复编号 ${record.id}`);
    ids.add(record.id);
    if (!categories.includes(record.category))
      errors.push(`${label}.category：未知分类 ${record.category}`);
    if (
      !Array.isArray(record.findings) ||
      record.findings.length === 0 ||
      !record.findings.every(isText)
    ) {
      errors.push(`${label}.findings：必须包含至少一条非空研究记录`);
    }
    if (!isWebUrl(record.source))
      errors.push(`${label}.source：必须是有效的 HTTP 或 HTTPS 链接`);
    validateMedia(record, label, errors);
  });
  for (const name of columns) {
    if (records.filter((record) => record?.category === name).length !== 8) {
      errors.push(`分类“${name}”：当前阵列要求八份档案`);
    }
  }
  if (errors.length)
    throw new Error(`档案数据校验失败：\n- ${errors.join("\n- ")}`);
  return content;
}

export async function loadContent() {
  return validateContent(
    JSON.parse(
      await fs.readFile(
        new URL("../content/archives.json", import.meta.url),
        "utf8",
      ),
    ),
  );
}

export function archiveText(r) {
  return `\uFEFFLAPPAS · PORTFOLIO ARCHIVE\nFILE ${r.id} / ${r.title}\n${r.en}\n\n角色：${r.department}\n时间：${r.date}\n技术与协作：${r.lead}\n状态：${r.clearance}\n\n${r.abstract}\n\n项目要点\n${r.findings.map((f, i) => `${i + 1}. ${f}`).join("\n")}\n\n项目链接：${r.source}\n`;
}
