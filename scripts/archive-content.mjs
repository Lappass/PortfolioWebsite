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
  for (const key of ["cover", "spine", "disc", "back", "hero", "video", "unity", "trailer"])
    if (record[key] !== undefined && !isMediaPath(record[key]))
      errors.push(`${label}.${key}：必须是 public 目录内的路径或 HTTP(S) 链接`);
  if (record.loader !== undefined && !isText(record.loader))
    errors.push(`${label}.loader: must be non-empty text`);
  if (record.gallery !== undefined && (!Array.isArray(record.gallery) ||
    !record.gallery.every((item) => item && isMediaPath(item.src) && (item.caption === undefined || isText(item.caption)) && (item.note === undefined || isText(item.note)))))
    errors.push(`${label}.gallery：每项需要有效的 src，caption 和 note 为可选纯文本`);
  if (record.links !== undefined && (!Array.isArray(record.links) ||
    !record.links.every((item) => item && isText(item.label) && isWebUrl(item.url))))
    errors.push(`${label}.links：每项需要 label 和 HTTP(S) url`);
  if (record.menu !== undefined && !["lastmile", "trail", "lockdown", "sniff"].includes(record.menu))
    errors.push(`${label}.menu：只能是 lastmile、trail、lockdown 或 sniff`);
  const run = record.playthrough;
  if (run !== undefined && (!run || !isMediaPath(run.src) || (run.chapters !== undefined && (!Array.isArray(run.chapters) ||
    !run.chapters.every((c) => c && /^\d+:\d{2}(:\d{2})?$/.test(c.at) && isText(c.label))))))
    errors.push(`${label}.playthrough：需要有效的 src，chapters 每项为 { at: "m:ss", label }`);
  const build = record.download;
  if (build !== undefined && (!build || !isMediaPath(build.url) || (build.label !== undefined && !isText(build.label)) || (build.size !== undefined && !isText(build.size))))
    errors.push(`${label}.download：需要 url，label 和 size 为可选文本`);
  if (record.soon !== undefined && (!Array.isArray(record.soon) || !record.soon.every((key) => ["play", "trailer", "playthrough", "download"].includes(key))))
    errors.push(`${label}.soon：只能包含 play、trailer、playthrough、download`);
  validateStudy(record.study, `${label}.study`, errors);
}

/** The long-form case study: a pitch, a few facts, and sections of text with optional pictures. */
function validateStudy(study, label, errors) {
  if (study === undefined) return;
  const texts = (list) => Array.isArray(list) && list.length > 0 && list.every(isText);
  if (!study || typeof study !== "object" || Array.isArray(study)) {
    errors.push(`${label}：必须是对象`);
    return;
  }
  if (!isText(study.pitch)) errors.push(`${label}.pitch：必须是非空文本`);
  if (!Array.isArray(study.facts) || !study.facts.every((fact) => fact && isText(fact.label) && isText(fact.value)))
    errors.push(`${label}.facts：每项需要 label 和 value`);
  if (!Array.isArray(study.sections) || study.sections.length === 0) {
    errors.push(`${label}.sections：至少需要一节`);
    return;
  }
  study.sections.forEach((section, i) => {
    const at = `${label}.sections[${i}]`;
    if (!section || !isText(section.kicker) || !isText(section.heading) || !texts(section.body))
      errors.push(`${at}：需要 kicker、heading 和至少一段 body`);
    if (section?.points !== undefined && !texts(section.points)) errors.push(`${at}.points：必须是非空文本数组`);
    if (section?.media !== undefined && (!Array.isArray(section.media) || !section.media.every((item) => item && isMediaPath(item.src) && (item.caption === undefined || isText(item.caption)))))
      errors.push(`${at}.media：每项需要有效的 src，caption 为可选文本`);
    if (section?.layout !== undefined && !["side", "wide"].includes(section.layout)) errors.push(`${at}.layout：只能是 side 或 wide`);
  });
}

export function validateContent(content) {
  const errors = [];
  if (!content || typeof content !== "object" || Array.isArray(content)) {
    throw new Error("档案数据必须是 JSON 对象。");
  }
  const names = content.categories;
  if (!Array.isArray(names) || names.length === 0 || !names.every(isText)) {
    errors.push("categories：至少需要一个非空分类名称");
  } else if (new Set(names).size !== names.length || names.includes("All")) {
    errors.push("categories：分类名称不能重复，也不能使用“All”");
  }
  const categories = Array.isArray(names) ? names : [];
  const records = Array.isArray(content.records) ? content.records : [];
  if (records.length === 0) errors.push("records：至少需要一份作品");
  const ids = new Set();
  let previousId = "";
  records.forEach((record, index) => {
    const label = `records[${index}]`;
    if (!record || typeof record !== "object" || Array.isArray(record)) {
      errors.push(`${label}：必须是档案对象`);
      return;
    }
    for (const key of requiredFields) {
      if (!isText(record[key])) errors.push(`${label}.${key}：必须是非空文本`);
    }
    // IDs never change once given: a removed work leaves a gap rather than renumbering the rest.
    if (typeof record.id !== "string" || !/^X-\d{3}$/.test(record.id))
      errors.push(`${label}.id：应为 X- 加三位数字，例如 X-001`);
    else if (ids.has(record.id)) errors.push(`${label}.id：重复编号 ${record.id}`);
    else if (previousId && record.id < previousId)
      errors.push(`${label}.id：${record.id} 应排在 ${previousId} 之前，编号须按顺序保持稳定`);
    if (typeof record.id === "string") { ids.add(record.id); previousId = record.id; }
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
  if (content.featured !== undefined && (!Array.isArray(content.featured) || content.featured.length !== 4 || new Set(content.featured).size !== 4 || !content.featured.every(id => records.some(record => record?.id === id))))
    errors.push("featured：必须按展示顺序列出四个不同且存在的作品编号");
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
  // The case study, when there is one, follows the highlights as plain sections.
  const study = r.study ? `\n${r.study.sections.map((s) => `${s.kicker} / ${s.heading}\n\n${[...s.body, ...(s.points ?? []).map((p) => `- ${p}`)].join("\n\n")}\n`).join("\n")}` : "";
  return `\uFEFFSHUHANG CHEN · PORTFOLIO ARCHIVE\nFILE ${r.id} / ${r.title}\n${r.en}\n\nRole: ${r.department}\nDate: ${r.date}\nStack: ${r.lead}\nStatus: ${r.clearance}\n\n${r.abstract}\n\nHighlights\n${r.findings.map((f, i) => `${i + 1}. ${f}`).join("\n")}\n${study}\nLink: ${r.source}\n`;
}
