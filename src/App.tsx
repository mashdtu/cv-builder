import { useState, useRef } from "react";
import { flushSync } from "react-dom";
import {
  Mail,
  MapPin,
  User,
  Briefcase,
  GraduationCap,
  Wrench,
  Languages,
  Pencil,
  X,
  Plus,
  Trash2,
  Download,
  Upload,
  Printer,
  FileCode,
  FileText,
  Palette,
} from "lucide-react";
import { FaGithub } from "react-icons/fa";
import "./App.css";
import {
  header as defaultHeader,
  footerName as defaultFooterName,
  about as defaultAbout,
  skills as defaultSkills,
  languages as defaultLanguages,
  experience as defaultExperience,
  education as defaultEducation,
  type ExperienceEntry,
  type EducationEntry,
  type GradeColumn,
  type GradeScale,
  type SummaryMode,
  type LanguageEntry,
  type Header,
} from "./data";

// Compute average percentage from a list of courses given a mode. Skips courses with missing/invalid grade or ECTS.
// Returns { avg, isRaw } where isRaw=true means avg is a raw grade value (not a percentage)
function computeAvgPct(
  courses: { grade: string; ects: string }[],
  scale: GradeScale,
  scaleMax: string | undefined,
  mode: SummaryMode,
): { avg: number; isRaw: boolean } | null {
  if (scale === "none") {
    // No scale: average raw numeric grade values
    const vals = courses
      .map((c) => ({ val: parseFloat(c.grade), ects: parseFloat(c.ects) }));
    const withGrade = vals.filter((x) => !isNaN(x.val));
    if (withGrade.length === 0) return null;
    const simple = withGrade.reduce((s, x) => s + x.val, 0) / withGrade.length;
    const withEcts = withGrade.filter((x) => !isNaN(x.ects) && x.ects > 0);
    const weighted = withEcts.length > 0
      ? withEcts.reduce((s, x) => s + x.val * x.ects, 0) / withEcts.reduce((s, x) => s + x.ects, 0)
      : null;
    if (mode === "weighted") return { avg: weighted ?? simple, isRaw: true };
    if (mode === "simple") return { avg: simple, isRaw: true };
    // best: higher of weighted and simple
    return { avg: Math.max(simple, weighted ?? simple), isRaw: true };
  }
  const valid = courses
    .map((c) => ({ pct: gradeToPercentNum(c.grade, scale, scaleMax), ects: parseFloat(c.ects) }))
    .filter((x): x is { pct: number; ects: number } => x.pct !== null && !isNaN(x.ects));
  const validAll = courses
    .map((c) => gradeToPercentNum(c.grade, scale, scaleMax))
    .filter((x): x is number => x !== null);
  if (validAll.length === 0) return null;
  const simple = validAll.reduce((s, x) => s + x, 0) / validAll.length;
  const totalEcts = valid.reduce((s, x) => s + x.ects, 0);
  const weighted = totalEcts > 0
    ? valid.reduce((s, x) => s + x.pct * x.ects, 0) / totalEcts
    : null;
  if (mode === "simple") return { avg: simple, isRaw: false };
  if (mode === "weighted") return { avg: weighted ?? simple, isRaw: false };
  // best: higher of weighted and simple
  return { avg: Math.max(simple, weighted ?? simple), isRaw: false };
}

// For numeric scales (gpa, percent, linear), compute average directly in scale space
// to avoid step-function snapping. Returns null for step-based scales (danish, ects).
function computeDirectAvg(
  courses: { grade: string; ects: string }[],
  scale: GradeScale,
  mode: SummaryMode,
): number | null {
  if (scale !== "gpa" && scale !== "percent" && scale !== "linear" && scale !== "danish") return null;
  const vals = courses
    .map((c) => ({ val: parseFloat(c.grade), ects: parseFloat(c.ects) }))
    .filter((x) => !isNaN(x.val));
  if (vals.length === 0) return null;
  const simple = vals.reduce((s, x) => s + x.val, 0) / vals.length;
  const withEcts = vals.filter((x) => !isNaN(x.ects) && x.ects > 0);
  const weighted = withEcts.length > 0
    ? withEcts.reduce((s, x) => s + x.val * x.ects, 0) / withEcts.reduce((s, x) => s + x.ects, 0)
    : null;
  if (mode === "simple") return simple;
  if (mode === "weighted") return weighted ?? simple;
  return Math.max(simple, weighted ?? simple); // best
}

function formatDirectAvg(avg: number, scale: GradeScale): string {
  if (scale === "percent") return avg.toFixed(1) + "%";
  return avg.toFixed(2);
}

// Official Danish grade → GPA lookup table
const DANISH_GPA: Array<[number, number]> = [
  [-3, 0.0], [0, 0.0], [2, 1.0], [4, 2.0], [7, 3.0], [10, 3.7], [12, 4.0],
];
function danishToGpaNum(grade: string): number | null {
  const g = parseFloat(grade);
  if (isNaN(g)) return null;
  const entry = DANISH_GPA.find(([d]) => d >= g);
  return entry ? entry[1] : 4.0;
}

// GPA value → percentage (upper bound of each GPA bin)
function gpaToPercent(gpa: number): number {
  if (gpa <= 0) return 0;
  if (gpa < 1.0) return 59;
  const steps: [number, number][] = [[1.0,66],[1.3,69],[1.7,72],[2.0,76],[2.3,79],[2.7,83],[3.0,86],[3.3,89],[3.7,93],[4.0,100]];
  return (steps.find(([g]) => g >= gpa) ?? steps[steps.length - 1])[1];
}

// Convert a grade directly between scales, using Danish→GPA direct lookup where possible.
function convertGrade(
  grade: string,
  fromScale: GradeScale,
  fromScaleMax: string | undefined,
  toScale: Exclude<GradeScale, "none">,
  toScaleMax: string | undefined,
): string {
  if (fromScale === "danish") {
    const g = parseFloat(grade);
    if (isNaN(g)) return "";
    if (toScale === "gpa") return (danishToGpaNum(grade) ?? 0).toFixed(2);
    if (toScale === "percent") {
      if (g <= -3) return "0.0%";
      const pctSteps: [number, number][] = [[0,30],[2,65],[4,72],[7,83],[10,93],[12,100]];
      const found = pctSteps.find(([d]) => d >= g) ?? pctSteps[pctSteps.length - 1];
      return found[1].toFixed(1) + "%";
    }
    const gpaVal = danishToGpaNum(grade);
    if (gpaVal === null) return "";
    return percentToGrade(gpaToPercent(gpaVal), toScale, toScaleMax);
  }
  const pct = gradeToPercentNum(grade, fromScale, fromScaleMax);
  if (pct === null) return "";
  return percentToGrade(pct, toScale, toScaleMax);
}

// Compute extra column average by averaging in input space then converting once.
function computeColAvg(
  courses: { grade: string; ects: string }[],
  fromScale: GradeScale,
  fromScaleMax: string | undefined,
  col: GradeColumn,
  mode: SummaryMode,
): string {
  const toScale = col.scale;
  if (fromScale === "danish" || fromScale === "gpa" || fromScale === "percent" || fromScale === "linear") {
    const vals = courses
      .map((c) => ({ val: parseFloat(c.grade), ects: parseFloat(c.ects) }))
      .filter((x) => !isNaN(x.val));
    if (vals.length === 0) return "—";
    const simple = vals.reduce((s, x) => s + x.val, 0) / vals.length;
    const withEcts = vals.filter((x) => !isNaN(x.ects) && x.ects > 0);
    const weighted = withEcts.length > 0
      ? withEcts.reduce((s, x) => s + x.val * x.ects, 0) / withEcts.reduce((s, x) => s + x.ects, 0)
      : null;
    const avg = mode === "simple" ? simple : mode === "weighted" ? (weighted ?? simple) : Math.max(simple, weighted ?? simple);
    if (fromScale === "danish") {
      const pts = DANISH_GPA;
      let gpa: number;
      if (avg <= pts[0][0]) gpa = pts[0][1];
      else if (avg >= pts[pts.length - 1][0]) gpa = pts[pts.length - 1][1];
      else { const hi = pts.findIndex(([d]) => d >= avg); const lo = pts[hi-1], h = pts[hi]; gpa = lo[1] + (avg - lo[0]) / (h[0] - lo[0]) * (h[1] - lo[1]); }
      if (toScale === "gpa") return gpa.toFixed(2);
      return percentToGrade(gpaToPercent(gpa), toScale, col.scaleMax);
    }
    let pct: number;
    if (fromScale === "percent") pct = avg;
    else if (fromScale === "gpa") pct = gpaToPercent(avg);
    else { const max = parseFloat(fromScaleMax ?? "10"); if (isNaN(max) || max === 0) return "—"; pct = (avg / max) * 100; }
    if (toScale === "percent") return pct.toFixed(1) + "%";
    if (toScale === "gpa") {
      const pts: [number,number][] = [[0,0.0],[60,1.0],[67,1.3],[70,1.7],[73,2.0],[77,2.3],[80,2.7],[83,3.0],[87,3.3],[90,3.7],[94,4.0],[100,4.0]];
      if (pct <= 0) return "0.00"; if (pct >= 100) return "4.00";
      const hi = pts.findIndex(([p]) => p >= pct); const lo = pts[hi-1], h = pts[hi];
      return (lo[1] + (pct - lo[0]) / (h[0] - lo[0]) * (h[1] - lo[1])).toFixed(2);
    }
    return percentToGrade(pct, toScale, col.scaleMax);
  }
  const entries = courses
    .map((c) => ({ val: gradeToPercentNum(c.grade, fromScale, fromScaleMax), ects: parseFloat(c.ects) }))
    .filter((x): x is { val: number; ects: number } => x.val !== null);
  if (entries.length === 0) return "—";
  const simple = entries.reduce((s, x) => s + x.val, 0) / entries.length;
  const withEcts = entries.filter((x) => !isNaN(x.ects) && x.ects > 0);
  const weighted = withEcts.length > 0
    ? withEcts.reduce((s, x) => s + x.val * x.ects, 0) / withEcts.reduce((s, x) => s + x.ects, 0)
    : null;
  const avg = mode === "simple" ? simple : mode === "weighted" ? (weighted ?? simple) : Math.max(simple, weighted ?? simple);
  if (toScale === "percent") return avg.toFixed(1) + "%";
  return percentToGrade(avg, toScale, col.scaleMax);
}

// Grade → red/yellow/green hsl colour, scale-aware.
function gradeColor(grade: string, scale: GradeScale, scaleMax?: string): string | undefined {
  let hue: number;
  if (scale === "danish") {
    const g = parseFloat(grade);
    if (isNaN(g)) return undefined;
    if (g <= 0) return "hsl(0, 70%, 40%)";
    hue = 60 + Math.min(1, (g - 2) / (12 - 2)) * 60;
  } else if (scale === "gpa") {
    const g = parseFloat(grade);
    if (isNaN(g)) return undefined;
    if (g < 2.0) return "hsl(0, 70%, 40%)";
    hue = 60 + Math.min(1, (g - 2.0) / 2.0) * 60;
  } else if (scale === "ects") {
    const passing = ["E", "D", "C", "B", "A"];
    const g = grade.trim().toUpperCase();
    if (!passing.includes(g)) return "hsl(0, 70%, 40%)";
    hue = 60 + (passing.indexOf(g) / (passing.length - 1)) * 60;
  } else if (scale === "percent") {
    const g = parseFloat(grade);
    if (isNaN(g)) return undefined;
    hue = Math.round(Math.min(24, Math.floor(g / 4)) / 24 * 120);
  } else if (scale === "linear") {
    const g = parseFloat(grade); const max = parseFloat(scaleMax ?? "10");
    if (isNaN(g) || isNaN(max) || max === 0) return undefined;
    hue = Math.round(Math.min(1, Math.max(0, g / max)) * 120);
  } else { return undefined; }
  return `hsl(${Math.round(hue)}, 70%, 40%)`;
}

function gradeToPercentNum(grade: string, scale: GradeScale, scaleMax?: string): number | null {
  if (scale === "none") return null;
  if (scale === "ects") {
    // Upper bound of each ECTS percentage range
    const upper: Record<string, number> = { A: 100, B: 89, C: 79, D: 69, E: 59, FX: 49, F: 39 };
    return upper[grade.trim().toUpperCase()] ?? null;
  }
  const g = parseFloat(grade);
  if (isNaN(g)) return null;
  if (scale === "danish") {
    // Route through official Danish→GPA table, then GPA→%
    if (g <= -3) return 0;
    const gpaVal = danishToGpaNum(grade);
    if (gpaVal === null) return null;
    return gpaToPercent(gpaVal);
  }
  if (scale === "percent") return g;
  if (scale === "gpa") {
    // Upper bound of each GPA percentage range
    if (g < 1.0) return 59; // F: 0-59%
    const steps: [number, number][] = [[1.0, 66], [1.3, 69], [1.7, 72], [2.0, 76], [2.3, 79], [2.7, 83], [3.0, 86], [3.3, 89], [3.7, 93], [4.0, 100]];
    const found = steps.find(([gpa]) => gpa >= g) ?? steps[steps.length - 1];
    return found[1];
  }
  if (scale === "linear") {
    const max = parseFloat(scaleMax ?? "10");
    if (isNaN(max) || max === 0) return null;
    return (g / max) * 100;
  }
  return null;
}

// Convert a percentage (0–100) to a grade string in the target scale.
function percentToGrade(pct: number, scale: Exclude<GradeScale, "none">, scaleMax?: string): string {
  if (scale === "percent") return pct.toFixed(1) + "%";
  if (scale === "danish") {
    if (pct >= 93) return "12";
    if (pct >= 89) return "10";
    if (pct >= 86) return "7";
    if (pct >= 83) return "4";
    if (pct >= 76) return "02";
    if (pct > 0) return "00";
    return "-3";
  }
  if (scale === "ects") {
    if (pct >= 90) return "A";
    if (pct >= 80) return "B";
    if (pct >= 70) return "C";
    if (pct >= 60) return "D";
    if (pct >= 50) return "E";
    if (pct >= 40) return "FX";
    return "F";
  }
  if (scale === "gpa") {
    // Linear interpolation between GPA breakpoints
    const pts: [number, number][] = [[0, 0.0], [60, 1.0], [67, 1.3], [70, 1.7], [73, 2.0], [77, 2.3], [80, 2.7], [83, 3.0], [87, 3.3], [90, 3.7], [94, 4.0], [100, 4.0]];
    if (pct <= 0) return "0.00";
    if (pct >= 100) return "4.00";
    const hiIdx = pts.findIndex(([p]) => p >= pct);
    const lo = pts[hiIdx - 1], hi = pts[hiIdx];
    const t = (pct - lo[0]) / (hi[0] - lo[0]);
    return (lo[1] + t * (hi[1] - lo[1])).toFixed(2);
  }
  if (scale === "linear") {
    const max = parseFloat(scaleMax ?? "10");
    if (isNaN(max)) return "—";
    return ((pct / 100) * max).toFixed(1);
  }
  return "—";
}

// Column header label for a given scale.
function colLabel(scale: Exclude<GradeScale, "none">, scaleMax?: string): string {
  if (scale === "percent") return "%";
  if (scale === "danish") return "DK";
  if (scale === "ects") return "EU";
  if (scale === "gpa") return "GPA";
  if (scale === "linear") return "/" + (scaleMax ?? "?");
  return "";
}

function App() {
  const [editing, setEditing] = useState(false);
  const [hdr, setHdr] = useState<Header>(defaultHeader);
  const [footer, setFooter] = useState(defaultFooterName);
  const [about, setAbout] = useState(defaultAbout);
  const [skills, setSkills] = useState(defaultSkills);
  const [exp, setExp] = useState<ExperienceEntry[]>(defaultExperience);
  const [edu, setEdu] = useState<EducationEntry[]>(defaultEducation);
  const [expandedCourses, setExpandedCourses] = useState<Set<number>>(new Set());
  const [langs, setLangs] = useState<LanguageEntry[]>(defaultLanguages);
  const [sectionOrder, setSectionOrder] = useState([
    "about",
    "skills",
    "experience",
    "education",
    "languages",
  ]);

  const [theme, setTheme] = useState<{
    accent: string;
    bg: string;
    text: string;
    font: string;
    layout: "classic" | "compact" | "sidebar";
  }>({
    accent: "",
    bg: "",
    text: "",
    font: "system-ui, 'Segoe UI', Roboto, sans-serif",
    layout: "classic",
  });
  const [showTheme, setShowTheme] = useState(false);
  const themeRef = useRef<HTMLDivElement>(null);

  function moveSection(i: number, dir: -1 | 1) {
    setSectionOrder((order) => {
      const next = [...order];
      const j = i + dir;
      if (j < 0 || j >= next.length) return next;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  async function saveJSON() {
    const data = {
      hdr,
      footer,
      about,
      skills,
      exp,
      edu,
      langs,
      sectionOrder,
      theme,
    };
    const json = JSON.stringify(data, null, 2);
    const suggestedName = `${hdr.name.toLowerCase().replace(/\s+/g, "-")}-cv-data.json`;

    if ("showSaveFilePicker" in window) {
      try {
        const handle = await (
          window as Window &
            typeof globalThis & {
              showSaveFilePicker: (
                opts: object,
              ) => Promise<FileSystemFileHandle>;
            }
        ).showSaveFilePicker({
          suggestedName,
          types: [
            {
              description: "JSON file",
              accept: { "application/json": [".json"] },
            },
          ],
        });
        const writable = await handle.createWritable();
        await writable.write(json);
        await writable.close();
        return;
      } catch (e) {
        // User cancelled — do nothing
        if ((e as DOMException).name === "AbortError") return;
      }
    }

    // Fallback for browsers without File System Access API
    const name = window.prompt("Save as:", suggestedName);
    if (name === null) return; // user cancelled
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name.endsWith(".json") ? name : name + ".json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function loadJSON(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const d = JSON.parse(ev.target?.result as string);
        if (d.hdr) setHdr(d.hdr);
        if (d.footer !== undefined) setFooter(d.footer);
        if (d.about) setAbout(d.about);
        if (d.skills) setSkills(d.skills);
        if (d.exp) setExp(d.exp);
        if (d.edu) setEdu(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (d.edu as any[]).map((entry: any) => {
            // Migrate old gradeScale/gradeScaleMax to new gradeInputScale/gradeColumns
            if (entry.gradeScale && entry.gradeScale !== "none" && !entry.gradeInputScale) {
              const migrated = { ...entry, gradeInputScale: entry.gradeScale, gradeInputScaleMax: entry.gradeScaleMax, gradeColumns: [{ scale: "percent" }] };
              delete migrated.gradeScale;
              delete migrated.gradeScaleMax;
              return migrated;
            }
            const clean = { ...entry };
            delete clean.gradeScale;
            delete clean.gradeScaleMax;
            return clean;
          })
        );
        if (d.langs) setLangs(d.langs);
        if (d.sectionOrder) setSectionOrder(d.sectionOrder);
        if (d.theme) setTheme(d.theme);
      } catch {
        alert(
          "Invalid file — make sure it's a cv-data.json saved from this app.",
        );
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  function buildCleanHTML(forPrint = false) {
    const wasEditing = editing;
    const prevExpanded = expandedCourses;
    if (wasEditing) flushSync(() => setEditing(false));
    // Expand all education entries so all course rows are in the DOM
    flushSync(() => setExpandedCourses(new Set(edu.map((_, i) => i))));
    const styles = Array.from(document.styleSheets)
      .flatMap((sheet) => {
        try {
          return Array.from(sheet.cssRules).map((r) => r.cssText);
        } catch {
          return [];
        }
      })
      .join("\n");
    const cvEl = document.querySelector(".cv") as HTMLElement;
    const clone = cvEl.cloneNode(true) as HTMLElement;
    clone.querySelector(".edit-toolbar")?.remove();
    // Restore state
    flushSync(() => setExpandedCourses(prevExpanded));
    if (wasEditing) setEditing(true);
    const script = `
<script>
document.addEventListener('DOMContentLoaded', function () {
  var PREVIEW = 4;
  document.querySelectorAll('.cv-courses-wrap').forEach(function (wrap) {
    var tbody = wrap.querySelector('tbody');
    var btn = wrap.querySelector('.cv-courses-toggle');
    var tableWrap = wrap.querySelector('.cv-courses-table-wrap');
    if (!tbody || !btn) return;
    var rows = Array.from(tbody.querySelectorAll('tr'));
    var tfoot = wrap.querySelector('tfoot');
    if (rows.length <= PREVIEW) return;
    // Set thead height variable for max-height offset
    var thead = wrap.querySelector('thead');
    if (thead && tableWrap) tableWrap.style.setProperty('--cv-thead-h', thead.offsetHeight + 'px');
    rows.slice(PREVIEW).forEach(function (r) { r.style.visibility = 'collapse'; });
    if (tfoot) tfoot.style.visibility = 'collapse';
    if (tableWrap) tableWrap.classList.add('cv-courses-table-wrap--fading');
    btn.textContent = btn.dataset.labelMore;
    var expanded = false;
    btn.addEventListener('click', function () {
      expanded = !expanded;
      rows.slice(PREVIEW).forEach(function (r) { r.style.visibility = expanded ? '' : 'collapse'; });
      if (tfoot) tfoot.style.visibility = expanded ? '' : 'collapse';
      if (tableWrap) tableWrap.classList.toggle('cv-courses-table-wrap--fading', !expanded);
      btn.textContent = expanded ? btn.dataset.labelLess : btn.dataset.labelMore;
    });
  });
});
<\/script>`;
    return `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width,initial-scale=1.0">\n<title></title>\n<style>body{margin:0}\n${styles}</style>\n</head>\n<body><div id="root">${clone.outerHTML}</div>${forPrint ? '' : script}</body>\n</html>`;
  }

  function exportPDF() {
    const html = buildCleanHTML(true);
    const win = window.open("", "_blank");
    if (win) {
      win.document.open();
      win.document.write(html);
      win.document.close();
      win.onload = () => {
        win.print();
        win.onafterprint = () => win.close();
      };
    }
  }

  function exportHTML() {
    const html = buildCleanHTML();
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${hdr.name.toLowerCase().replace(/\s+/g, "-")}-cv.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportMarkdown() {
    const lines: string[] = [];

    // Header
    const pronounsPart = hdr.pronouns ? ` *(${hdr.pronouns})*` : "";
    lines.push(`# ${hdr.name}${pronounsPart}`);
    if (hdr.title) lines.push(`\n**${hdr.title}**`);
    const contacts: string[] = [];
    if (hdr.email) contacts.push(`✉ [${hdr.email}](mailto:${hdr.email})`);
    if (hdr.github)
      contacts.push(
        `[github.com/${hdr.github}](https://github.com/${hdr.github})`,
      );
    if (hdr.location) contacts.push(`📍 ${hdr.location}`);
    if (contacts.length) lines.push(`\n${contacts.join(" · ")}`);

    for (const key of sectionOrder) {
      if (key === "about" && about.some((p) => p.trim())) {
        lines.push("\n---\n\n## About Me");
        for (const p of about) if (p.trim()) lines.push(`\n${p}`);
      }

      if (key === "skills" && skills.some((s) => s.trim())) {
        lines.push("\n---\n\n## Skills");
        lines.push(`\n${skills.filter((s) => s.trim()).join(" · ")}`);
      }

      if (key === "experience" && exp.length) {
        lines.push("\n---\n\n## Experience");
        for (const e of exp) {
          lines.push(`\n### ${e.role}${e.company ? ` — ${e.company}` : ""}`);
          if (e.period) lines.push(`*${e.period}*`);
          if (e.description) lines.push(`\n${e.description}`);
        }
      }

      if (key === "education" && edu.length) {
        lines.push("\n---\n\n## Education");
        for (const e of edu) {
          lines.push(
            `\n### ${e.degree}${e.institution ? ` — ${e.institution}` : ""}`,
          );
          if (e.period) lines.push(`*${e.period}*`);
          if (e.description) lines.push(`\n${e.description}`);
          if (e.courses && e.courses.some((c) => c.name.trim())) {
            const cols = (e.gradeInputScale && e.gradeInputScale !== "none" && e.gradeColumns?.length)
              ? e.gradeColumns : [];
            const extraHeaders = cols.map((col) => ` ${colLabel(col.scale, col.scaleMax)} |`).join("");
            const extraSep = cols.map(() => " --- |").join("");
            lines.push(`\n| # | Course | ECTS | Grade |${extraHeaders}`);
            lines.push(`| --- | --- | --- | --- |${extraSep}`);
            for (const c of e.courses)
              if (c.name.trim()) {
                const extraCells = cols.map((col) => {
                  const converted = convertGrade(c.grade, e.gradeInputScale!, e.gradeInputScaleMax, col.scale, col.scaleMax);
                  return ` ${converted} |`;
                }).join("");
                lines.push(`| ${c.number} | ${c.name} | ${c.ects} | ${c.grade} |${extraCells}`);
              }
            if (e.showCourseSummary) {
              const filled = e.courses.filter((c) => c.name.trim() && (!e.showOnlyGraded || c.grade.trim()));
              const totalEcts = filled.reduce((sum, c) => {
                const n = parseFloat(c.ects); return sum + (isNaN(n) ? 0 : n);
              }, 0);
              const mode = e.summaryMode ?? "weighted";
              const avgResult = computeAvgPct(filled, e.gradeInputScale ?? "none", e.gradeInputScaleMax, mode);
              const directAvg = computeDirectAvg(filled, e.gradeInputScale ?? "none", mode);
              const avgGradeStr = directAvg !== null
                ? formatDirectAvg(directAvg, e.gradeInputScale!)
                : avgResult
                  ? (avgResult.isRaw
                    ? avgResult.avg.toFixed(2)
                    : percentToGrade(avgResult.avg, e.gradeInputScale as Exclude<GradeScale, "none">, e.gradeInputScaleMax))
                  : "—";
              const extraSumCells = cols.map((col) =>
                ` **${computeColAvg(filled, e.gradeInputScale ?? "none", e.gradeInputScaleMax, col, mode)}** |`
              ).join("");
              lines.push(`| | **Total** | **${totalEcts}** | **${avgGradeStr}** |${extraSumCells}`);
            }
          }
        }
      }

      if (key === "languages" && langs.some((l) => l.language.trim())) {
        lines.push("\n---\n\n## Languages");
        lines.push("\n| Language | Level |");
        lines.push("| --- | --- |");
        for (const l of langs)
          if (l.language.trim())
            lines.push(`| ${l.language} | ${l.level} |`);
      }
    }

    lines.push(`\n---\n\n*© ${new Date().getFullYear()} ${footer}*`);

    const md = lines.join("\n");
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${hdr.name.toLowerCase().replace(/\s+/g, "-")}-cv.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Read a CSS custom property from :root (respects light/dark mode)
  const cssVar = (name: string) =>
    getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  // Derive CSS vars from theme overrides
  const themeVars = {
    ...(theme.accent
      ? {
          "--accent": theme.accent,
          "--accent-bg": theme.accent + "18",
          "--accent-border": theme.accent + "55",
        }
      : {}),
    ...(theme.text ? { "--text": theme.text, "--text-h": theme.text } : {}),
    ...(theme.font ? { "--heading": theme.font } : {}),
  } as React.CSSProperties;

  return (
    <>
      {/* Apply bg to the whole page */}
      {theme.bg && (
        <style>{`body { background: ${theme.bg} !important; } #root { background: ${theme.bg}; }`}</style>
      )}

      {/* ── Toolbar ─────────────────────────────────────────── */}
      <div className="edit-toolbar">
        <button
          className="edit-toolbar-toggle"
          onClick={() => setEditing((e) => !e)}>
          {editing ? (
            <>
              <X size={14} /> Done
            </>
          ) : (
            <>
              <Pencil size={14} /> Edit
            </>
          )}
        </button>
        {editing && (
          <>
            <button className="edit-toolbar-btn" onClick={saveJSON}>
              <Download size={13} /> Save
            </button>
            <label className="edit-toolbar-btn">
              <Upload size={13} /> Load
              <input type="file" accept=".json" onChange={loadJSON} hidden />
            </label>
            <button className="edit-toolbar-btn" onClick={exportPDF}>
              <Printer size={13} /> Print
            </button>
            <button className="edit-toolbar-btn" onClick={exportHTML}>
              <FileCode size={13} /> HTML
            </button>
            <button className="edit-toolbar-btn" onClick={exportMarkdown}>
              <FileText size={13} /> Markdown
            </button>
            <div className="edit-theme-wrap" ref={themeRef}>
              <button
                className="edit-toolbar-btn"
                onClick={() => setShowTheme((v) => !v)}>
                <Palette size={13} />
                Theme
              </button>
              {showTheme && (
                <div className="edit-theme-panel">
                  <label className="edit-theme-row">
                    <span>Accent colour</span>
                    <span className="edit-theme-color-wrap">
                      <input
                        type="color"
                        value={theme.accent || cssVar("--accent")}
                        onInput={(e) => {
                          const v = (e.target as HTMLInputElement).value;
                          setTheme((t) => ({ ...t, accent: v }));
                        }}
                      />
                      {theme.accent && (
                        <button
                          className="edit-theme-reset"
                          onClick={() =>
                            setTheme((t) => ({ ...t, accent: "" }))
                          }>
                          auto
                        </button>
                      )}
                    </span>
                  </label>
                  <label className="edit-theme-row">
                    <span>Background</span>
                    <span className="edit-theme-color-wrap">
                      <input
                        type="color"
                        value={theme.bg || cssVar("--bg")}
                        onInput={(e) => {
                          const v = (e.target as HTMLInputElement).value;
                          setTheme((t) => ({ ...t, bg: v }));
                        }}
                      />
                      {theme.bg && (
                        <button
                          className="edit-theme-reset"
                          onClick={() => setTheme((t) => ({ ...t, bg: "" }))}>
                          auto
                        </button>
                      )}
                    </span>
                  </label>
                  <label className="edit-theme-row">
                    <span>Text colour</span>
                    <span className="edit-theme-color-wrap">
                      <input
                        type="color"
                        value={theme.text || cssVar("--text")}
                        onInput={(e) => {
                          const v = (e.target as HTMLInputElement).value;
                          setTheme((t) => ({ ...t, text: v }));
                        }}
                      />
                      {theme.text && (
                        <button
                          className="edit-theme-reset"
                          onClick={() => setTheme((t) => ({ ...t, text: "" }))}>
                          auto
                        </button>
                      )}
                    </span>
                  </label>
                  <label className="edit-theme-row edit-theme-row--col">
                    <span>Font</span>
                    <select
                      value={theme.font}
                      onChange={(e) =>
                        setTheme((t) => ({ ...t, font: e.target.value }))
                      }>
                      <option value="system-ui, 'Segoe UI', Roboto, sans-serif">
                        System sans-serif
                      </option>
                      <option value="Georgia, 'Times New Roman', serif">
                        Georgia (serif)
                      </option>
                      <option value="'Palatino Linotype', Palatino, serif">
                        Palatino (serif)
                      </option>
                      <option value="Garamond, 'EB Garamond', serif">
                        Garamond (serif)
                      </option>
                      <option value="Helvetica, Arial, sans-serif">
                        Helvetica
                      </option>
                      <option value="'Gill Sans', 'Gill Sans MT', sans-serif">
                        Gill Sans
                      </option>
                      <option value="Futura, 'Trebuchet MS', sans-serif">
                        Futura
                      </option>
                      <option value="ui-monospace, Consolas, monospace">
                        Monospace
                      </option>
                    </select>
                  </label>
                  <div className="edit-theme-row edit-theme-row--col">
                    <span>Layout</span>
                    <div className="edit-theme-layout-btns">
                      {(["classic", "compact", "sidebar"] as const).map((l) => (
                        <button
                          key={l}
                          className={`edit-theme-layout-btn${theme.layout === l ? " edit-theme-layout-btn--active" : ""}`}
                          onClick={() => setTheme((t) => ({ ...t, layout: l }))}>
                          {l.charAt(0).toUpperCase() + l.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <div className={`cv cv--layout-${theme.layout}${editing ? " cv--editing" : ""}`} style={themeVars}>
        {/* ── Header ──────────────────────────────────────────── */}
        <header className="cv-header">
          <h1>
            {editing ? (
              <input
                className="edit-inline edit-inline--h1"
                value={hdr.name}
                onChange={(e) =>
                  setHdr((h) => ({ ...h, name: e.target.value }))
                }
                placeholder="Name"
              />
            ) : (
              hdr.name
            )}
            {(editing || hdr.pronouns) && (
              <span className="cv-pronouns">
                {editing ? (
                  <input
                    className="edit-inline edit-inline--sm"
                    value={hdr.pronouns}
                    onChange={(e) =>
                      setHdr((h) => ({ ...h, pronouns: e.target.value }))
                    }
                    placeholder="pronouns"
                  />
                ) : (
                  hdr.pronouns
                )}
              </span>
            )}
          </h1>

          {(editing || hdr.title) &&
            (editing ? (
              <input
                className="edit-inline edit-inline--block cv-title"
                value={hdr.title}
                onChange={(e) =>
                  setHdr((h) => ({ ...h, title: e.target.value }))
                }
                placeholder="Title / role"
              />
            ) : (
              <p className="cv-title">{hdr.title}</p>
            ))}

          <ul className="cv-contact">
            {(editing || hdr.email) && (
              <li>
                <Mail size={14} />
                {editing ? (
                  <input
                    className="edit-inline"
                    value={hdr.email}
                    onChange={(e) =>
                      setHdr((h) => ({ ...h, email: e.target.value }))
                    }
                    placeholder="email@example.com"
                  />
                ) : (
                  <a href={`mailto:${hdr.email}`}>{hdr.email}</a>
                )}
              </li>
            )}
            {(editing || hdr.github) && (
              <li>
                <FaGithub size={14} />
                {editing ? (
                  <input
                    className="edit-inline"
                    value={hdr.github}
                    onChange={(e) =>
                      setHdr((h) => ({ ...h, github: e.target.value }))
                    }
                    placeholder="github username"
                  />
                ) : (
                  <a
                    href={`https://github.com/${hdr.github}`}
                    target="_blank"
                    rel="noreferrer">
                    github.com/{hdr.github}
                  </a>
                )}
              </li>
            )}
            {(editing || hdr.location) && (
              <li>
                <MapPin size={14} />
                {editing ? (
                  <input
                    className="edit-inline"
                    value={hdr.location}
                    onChange={(e) =>
                      setHdr((h) => ({ ...h, location: e.target.value }))
                    }
                    placeholder="City, Country"
                  />
                ) : (
                  hdr.location
                )}
              </li>
            )}
          </ul>
        </header>

        {/* ── Sections ────────────────────────────────────────── */}
        <main className="cv-main">
          {sectionOrder.map((key, si) => {
            const controls = editing && (
              <div className="edit-section-controls">
                <button onClick={() => moveSection(si, -1)} disabled={si === 0}>
                  ↑
                </button>
                <button
                  onClick={() => moveSection(si, 1)}
                  disabled={si === sectionOrder.length - 1}>
                  ↓
                </button>
              </div>
            );

            if (key === "about") {
              if (!editing && !about.some((p) => p.trim())) return null;
              return (
                <section key="about" className="cv-section">
                  <h2>
                    <User size={13} /> About Me {controls}
                  </h2>
                  {about.map((para, i) =>
                    editing ? (
                      <div key={i} className="edit-para-row">
                        <textarea
                          className="edit-inline-area"
                          value={para}
                          onChange={(e) =>
                            setAbout((a) =>
                              a.map((p, j) => (j === i ? e.target.value : p)),
                            )
                          }
                          placeholder="Paragraph…"
                        />
                        <button
                          className="edit-remove-icon"
                          onClick={() =>
                            setAbout((a) => a.filter((_, j) => j !== i))
                          }>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ) : para.trim() ? (
                      <p key={i}>{para}</p>
                    ) : null,
                  )}
                  {editing && (
                    <button
                      className="edit-add-inline"
                      onClick={() => setAbout((a) => [...a, ""])}>
                      <Plus size={12} /> Add paragraph
                    </button>
                  )}
                </section>
              );
            }

            if (key === "skills") {
              if (!editing && !skills.some((s) => s.trim())) return null;
              return (
                <section key="skills" className="cv-section">
                  <h2>
                    <Wrench size={13} /> Skills {controls}
                  </h2>
                  <ul className="cv-skills">
                    {skills.map((skill, i) => (
                      <li
                        key={i}
                        className={`cv-skill-tag${editing ? " cv-skill-tag--editing" : ""}`}>
                        {editing ? (
                          <>
                            <input
                              className="edit-inline"
                              value={skill}
                              onChange={(e) =>
                                setSkills((s) =>
                                  s.map((x, j) =>
                                    j === i ? e.target.value : x,
                                  ),
                                )
                              }
                              placeholder="Skill"
                            />
                            <button
                              className="edit-remove-icon"
                              onClick={() =>
                                setSkills((s) => s.filter((_, j) => j !== i))
                              }>
                              <X size={10} />
                            </button>
                          </>
                        ) : (
                          skill
                        )}
                      </li>
                    ))}
                    {editing && (
                      <li>
                        <button
                          className="edit-add-inline"
                          onClick={() => setSkills((s) => [...s, ""])}>
                          <Plus size={12} /> Add
                        </button>
                      </li>
                    )}
                  </ul>
                </section>
              );
            }

            if (key === "experience") {
              if (!editing && exp.length === 0) return null;
              return (
                <section key="experience" className="cv-section">
                  <h2>
                    <Briefcase size={13} /> Experience {controls}
                  </h2>
                  {exp.map((e, i) => (
                    <div
                      key={i}
                      className={`cv-entry${editing ? " cv-entry--editing" : ""}`}>
                      {editing && (
                        <button
                          className="edit-remove-entry"
                          onClick={() =>
                            setExp((x) => x.filter((_, j) => j !== i))
                          }>
                          <Trash2 size={12} />
                        </button>
                      )}
                      <div className="cv-entry-header">
                        {editing ? (
                          <input
                            className="edit-inline edit-inline--strong"
                            value={e.role}
                            onChange={(v) =>
                              setExp((x) =>
                                x.map((r, j) =>
                                  j === i ? { ...r, role: v.target.value } : r,
                                ),
                              )
                            }
                            placeholder="Role / Position"
                          />
                        ) : (
                          <strong>{e.role}</strong>
                        )}
                        {editing ? (
                          <input
                            className="edit-inline edit-inline--date"
                            value={e.period}
                            onChange={(v) =>
                              setExp((x) =>
                                x.map((r, j) =>
                                  j === i
                                    ? { ...r, period: v.target.value }
                                    : r,
                                ),
                              )
                            }
                            placeholder="e.g. 2022 – 2024"
                          />
                        ) : (
                          <span className="cv-date">{e.period}</span>
                        )}
                      </div>
                      {editing ? (
                        <input
                          className="edit-inline edit-inline--block edit-inline--org"
                          value={e.company}
                          onChange={(v) =>
                            setExp((x) =>
                              x.map((r, j) =>
                                j === i ? { ...r, company: v.target.value } : r,
                              ),
                            )
                          }
                          placeholder="Company"
                        />
                      ) : (
                        <p className="cv-org">{e.company}</p>
                      )}
                      {editing ? (
                        <textarea
                          className="edit-inline-area"
                          value={e.description}
                          onChange={(v) =>
                            setExp((x) =>
                              x.map((r, j) =>
                                j === i
                                  ? { ...r, description: v.target.value }
                                  : r,
                              ),
                            )
                          }
                          placeholder="Description…"
                        />
                      ) : (
                        e.description && <p>{e.description}</p>
                      )}
                    </div>
                  ))}
                  {editing && (
                    <button
                      className="edit-add-inline"
                      onClick={() =>
                        setExp((x) => [
                          ...x,
                          {
                            role: "",
                            company: "",
                            period: "",
                            description: "",
                          },
                        ])
                      }>
                      <Plus size={12} /> Add experience
                    </button>
                  )}
                </section>
              );
            }

            if (key === "education") {
              if (!editing && edu.length === 0) return null;
              return (
                <section key="education" className="cv-section">
                  <h2>
                    <GraduationCap size={13} /> Education {controls}
                  </h2>
                  {edu.map((e, i) => (
                    <div
                      key={i}
                      className={`cv-entry${editing ? " cv-entry--editing" : ""}`}>
                      {editing && (
                        <button
                          className="edit-remove-entry"
                          onClick={() =>
                            setEdu((x) => x.filter((_, j) => j !== i))
                          }>
                          <Trash2 size={12} />
                        </button>
                      )}
                      <div className="cv-entry-header">
                        {editing ? (
                          <input
                            className="edit-inline edit-inline--strong"
                            value={e.degree}
                            onChange={(v) =>
                              setEdu((x) =>
                                x.map((r, j) =>
                                  j === i
                                    ? { ...r, degree: v.target.value }
                                    : r,
                                ),
                              )
                            }
                            placeholder="Degree / Qualification"
                          />
                        ) : (
                          <strong>{e.degree}</strong>
                        )}
                        {editing ? (
                          <input
                            className="edit-inline edit-inline--date"
                            value={e.period}
                            onChange={(v) =>
                              setEdu((x) =>
                                x.map((r, j) =>
                                  j === i
                                    ? { ...r, period: v.target.value }
                                    : r,
                                ),
                              )
                            }
                            placeholder="e.g. 2020 – 2024"
                          />
                        ) : (
                          <span className="cv-date">{e.period}</span>
                        )}
                      </div>
                      {editing ? (
                        <input
                          className="edit-inline edit-inline--block edit-inline--org"
                          value={e.institution}
                          onChange={(v) =>
                            setEdu((x) =>
                              x.map((r, j) =>
                                j === i
                                  ? { ...r, institution: v.target.value }
                                  : r,
                              ),
                            )
                          }
                          placeholder="Institution"
                        />
                      ) : (
                        <p className="cv-org">{e.institution}</p>
                      )}
                      {editing ? (
                        <textarea
                          className="edit-inline-area"
                          value={e.description ?? ""}
                          onChange={(v) =>
                            setEdu((x) =>
                              x.map((r, j) =>
                                j === i
                                  ? { ...r, description: v.target.value }
                                  : r,
                              ),
                            )
                          }
                          placeholder="Description (optional)…"
                        />
                      ) : (
                        e.description && <p>{e.description}</p>
                      )}
                      {(editing || (e.courses && e.courses.some((c) => c.name.trim()))) && (
                        <div className="cv-courses">
                          {!editing && e.courses && e.courses.some((c) => c.name.trim()) && (
                            <>
                              {(() => {
                                const PREVIEW = 4;
                                const filled = e.courses!.filter((c) => c.name.trim() && (!e.showOnlyGraded || c.grade.trim()));
                                const expanded = expandedCourses.has(i);
                                const hasMore = filled.length > PREVIEW;
                                const cols = (e.gradeInputScale && e.gradeInputScale !== "none" && e.gradeColumns?.length)
                                  ? e.gradeColumns : [];
                                return (
                                  <div className="cv-courses-wrap">
                                    <div className={`cv-courses-table-wrap${!expanded && hasMore ? " cv-courses-table-wrap--fading" : ""}`}
                                      ref={(el) => {
                                        if (el) {
                                          const thead = el.querySelector('thead') as HTMLElement | null;
                                          if (thead) el.style.setProperty('--cv-thead-h', thead.offsetHeight + 'px');
                                        }
                                      }}
                                    >
                                      <table className="cv-courses-table">
                                        <thead>
                                          <tr>
                                            <th>#</th>
                                            <th className="cv-col-ects">ECTS</th>
                                            <th>Course</th>
                                            {e.gradeInputScale && e.gradeInputScale !== "none" ? (
                                              <>
                                                <th className="cv-col-grade-first">{colLabel(e.gradeInputScale as Exclude<GradeScale,"none">, e.gradeInputScaleMax)}</th>
                                                {cols.map((col, ci) => (
                                                  <th key={ci}>{colLabel(col.scale, col.scaleMax)}</th>
                                                ))}
                                              </>
                                            ) : (
                                              <th className="cv-col-grade-first">Grade</th>
                                            )}
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {filled.map((c, ci) => (
                                            <tr key={ci} style={(!expanded && ci >= PREVIEW) ? { visibility: "collapse" } : undefined}>
                                              <td>{c.number}</td>
                                              <td className="cv-col-ects">{c.ects}</td>
                                              <td>{c.name}</td>
                                              <td className="cv-col-grade-first" style={{ color: e.colorGrades ? gradeColor(c.grade, e.gradeInputScale ?? "none", e.gradeInputScaleMax) : undefined, fontWeight: e.colorGrades ? 600 : undefined }}>{c.grade}</td>
                                              {cols.map((col, coli) => {
                                                const converted = convertGrade(c.grade, e.gradeInputScale!, e.gradeInputScaleMax, col.scale, col.scaleMax);
                                                return <td key={coli} style={{ color: e.colorGrades && converted ? gradeColor(converted, col.scale, col.scaleMax) : undefined, fontWeight: e.colorGrades && converted ? 600 : undefined }}>{converted}</td>;
                                              })}
                                            </tr>
                                          ))}
                                        </tbody>
                                        {e.showCourseSummary && (() => {
                                          const totalEcts = filled.reduce((sum, c) => {
                                            const n = parseFloat(c.ects);
                                            return sum + (isNaN(n) ? 0 : n);
                                          }, 0);
                                          const mode = e.summaryMode ?? "weighted";
                                          const avgResult = computeAvgPct(filled, e.gradeInputScale ?? "none", e.gradeInputScaleMax, mode);
                                          const directAvg = computeDirectAvg(filled, e.gradeInputScale ?? "none", mode);
                                          const avgGradeStr = directAvg !== null
                                            ? formatDirectAvg(directAvg, e.gradeInputScale!)
                                            : avgResult
                                              ? (avgResult.isRaw
                                                ? avgResult.avg.toFixed(2)
                                                : percentToGrade(avgResult.avg, e.gradeInputScale as Exclude<GradeScale, "none">, e.gradeInputScaleMax))
                                              : "—";
                                          const hidden = !expanded && hasMore;
                                          return (
                                            <tfoot style={hidden ? { visibility: "collapse" } : undefined}>
                                              <tr className="cv-courses-summary">
                                                <td>Total</td>
                                                <td>{totalEcts}</td>
                                                <td />
                                                <td style={{ color: e.colorGrades && avgGradeStr !== "—" ? gradeColor(avgGradeStr, e.gradeInputScale as GradeScale ?? "none", e.gradeInputScaleMax) : undefined, fontWeight: e.colorGrades && avgGradeStr !== "—" ? 600 : undefined }}>{avgGradeStr}</td>
                                                {cols.map((col, coli) => {
                                                  const colAvg = computeColAvg(filled, e.gradeInputScale ?? "none", e.gradeInputScaleMax, col, mode);
                                                  return <td key={coli} style={{ color: e.colorGrades && colAvg !== "—" ? gradeColor(colAvg, col.scale, col.scaleMax) : undefined, fontWeight: e.colorGrades && colAvg !== "—" ? 600 : undefined }}>{colAvg}</td>;
                                                })}
                                              </tr>
                                            </tfoot>
                                          );
                                        })()}
                                      </table>
                                    </div>
                                    {hasMore && (
                                      <button
                                        className="cv-courses-toggle"
                                        data-label-more={`▸ Show all ${filled.length} courses`}
                                        data-label-less="▾ Show less"
                                        onClick={() =>
                                          setExpandedCourses((prev) => {
                                            const next = new Set(prev);
                                            next.has(i) ? next.delete(i) : next.add(i);
                                            return next;
                                          })
                                        }>
                                        {expanded ? "▾ Show less" : `▸ Show all ${filled.length} courses`}
                                      </button>
                                    )}
                                  </div>
                                );
                              })()}
                            </>
                          )}
                          {editing && (
                            <>
                              <span className="cv-courses-label">Courses</span>
                              {(e.courses ?? []).length > 0 && (
                                <div className="cv-courses-edit-header">
                                  <span>#</span>
                                  <span>Name</span>
                                  <span>ECTS</span>
                                  <span>Grade</span>
                                  <span />
                                </div>
                              )}
                              {(e.courses ?? []).map((course, ci) => (
                                <div key={ci} className="cv-courses-edit-row">
                                  <input
                                    className="edit-inline cv-courses-num"
                                    value={course.number}
                                    onChange={(v) =>
                                      setEdu((x) =>
                                        x.map((r, j) =>
                                          j === i
                                            ? {
                                                ...r,
                                                courses: (r.courses ?? []).map(
                                                  (c, k) =>
                                                    k === ci ? { ...c, number: v.target.value } : c,
                                                ),
                                              }
                                            : r,
                                        ),
                                      )
                                    }
                                    placeholder="#"
                                  />
                                  <input
                                    className="edit-inline cv-courses-name"
                                    value={course.name}
                                    onChange={(v) =>
                                      setEdu((x) =>
                                        x.map((r, j) =>
                                          j === i
                                            ? {
                                                ...r,
                                                courses: (r.courses ?? []).map(
                                                  (c, k) =>
                                                    k === ci ? { ...c, name: v.target.value } : c,
                                                ),
                                              }
                                            : r,
                                        ),
                                      )
                                    }
                                    placeholder="Course name"
                                  />
                                  <input
                                    className="edit-inline cv-courses-ects"
                                    value={course.ects}
                                    onChange={(v) =>
                                      setEdu((x) =>
                                        x.map((r, j) =>
                                          j === i
                                            ? {
                                                ...r,
                                                courses: (r.courses ?? []).map(
                                                  (c, k) =>
                                                    k === ci ? { ...c, ects: v.target.value } : c,
                                                ),
                                              }
                                            : r,
                                        ),
                                      )
                                    }
                                    placeholder="ECTS"
                                  />
                                  <input
                                    className="edit-inline cv-courses-grade"
                                    value={course.grade}
                                    onChange={(v) =>
                                      setEdu((x) =>
                                        x.map((r, j) =>
                                          j === i
                                            ? {
                                                ...r,
                                                courses: (r.courses ?? []).map(
                                                  (c, k) =>
                                                    k === ci ? { ...c, grade: v.target.value } : c,
                                                ),
                                              }
                                            : r,
                                        ),
                                      )
                                    }
                                    placeholder="Grade"
                                  />
                                  <button
                                    className="edit-remove-icon"
                                    onClick={() =>
                                      setEdu((x) =>
                                        x.map((r, j) =>
                                          j === i
                                            ? {
                                                ...r,
                                                courses: (r.courses ?? []).filter(
                                                  (_, k) => k !== ci,
                                                ),
                                              }
                                            : r,
                                        ),
                                      )
                                    }>
                                    <X size={10} />
                                  </button>
                                </div>
                              ))}
                              <button
                                className="edit-add-inline"
                                onClick={() =>
                                  setEdu((x) =>
                                    x.map((r, j) =>
                                      j === i
                                        ? {
                                            ...r,
                                            courses: [
                                              ...(r.courses ?? []),
                                              { number: "", name: "", ects: "", grade: "" },
                                            ],
                                          }
                                        : r,
                                    ),
                                  )
                                }>
                                <Plus size={12} /> Add course
                              </button>
                              {e.showCourseSummary && (() => {
                                const filledEdit = (e.courses ?? []).filter((c) => c.name.trim());
                                const totalEcts = filledEdit.reduce((s, c) => { const n = parseFloat(c.ects); return s + (isNaN(n) ? 0 : n); }, 0);
                                const mode = e.summaryMode ?? "weighted";
                                const avgResult = computeAvgPct(filledEdit, e.gradeInputScale ?? "none", e.gradeInputScaleMax, mode);
                                const directAvg = computeDirectAvg(filledEdit, e.gradeInputScale ?? "none", mode);
                                const avgGradeStr = directAvg !== null
                                  ? formatDirectAvg(directAvg, e.gradeInputScale!)
                                  : avgResult
                                    ? (avgResult.isRaw ? avgResult.avg.toFixed(2) : percentToGrade(avgResult.avg, e.gradeInputScale as Exclude<GradeScale, "none">, e.gradeInputScaleMax))
                                    : "—";
                                return (
                                  <div className="cv-courses-edit-summary">
                                    <span>Total</span>
                                    <span>{totalEcts || "—"}</span>
                                    <span>{avgGradeStr}</span>
                                  </div>
                                );
                              })()}
                              <label className="cv-courses-summary-toggle">
                                <input
                                  type="checkbox"
                                  checked={e.showOnlyGraded ?? false}
                                  onChange={(v) =>
                                    setEdu((x) =>
                                      x.map((r, j) =>
                                        j === i
                                          ? { ...r, showOnlyGraded: v.target.checked }
                                          : r,
                                      ),
                                    )
                                  }
                                />
                                Only show graded courses
                              </label>
                              <label className="cv-courses-summary-toggle">
                                <input
                                  type="checkbox"
                                  checked={e.colorGrades ?? false}
                                  onChange={(v) =>
                                    setEdu((x) =>
                                      x.map((r, j) =>
                                        j === i
                                          ? { ...r, colorGrades: v.target.checked }
                                          : r,
                                      ),
                                    )
                                  }
                                />
                                Color code grades
                              </label>
                              <label className="cv-courses-summary-toggle">
                                <input
                                  type="checkbox"
                                  checked={e.showCourseSummary ?? false}
                                  onChange={(v) =>
                                    setEdu((x) =>
                                      x.map((r, j) =>
                                        j === i
                                          ? { ...r, showCourseSummary: v.target.checked }
                                          : r,
                                      ),
                                    )
                                  }
                                />
                                Show totals row
                              </label>
                              {e.showCourseSummary && (
                                <div className="cv-courses-scale-row">
                                  <span className="cv-courses-scale-label">Average</span>
                                  <select
                                    className="cv-courses-scale-select"
                                    value={e.summaryMode ?? "weighted"}
                                    onChange={(v) =>
                                      setEdu((x) =>
                                        x.map((r, j) =>
                                          j === i
                                            ? { ...r, summaryMode: v.target.value as SummaryMode }
                                            : r,
                                        ),
                                      )
                                    }>
                                    <option value="weighted">Weighted by ECTS</option>
                                    <option value="simple">Simple average</option>
                                    <option value="best">Best of weighted/simple</option>
                                  </select>
                                </div>
                              )}
                              {/* Input grade scale */}
                              <div className="cv-courses-scale-row">
                                <span className="cv-courses-scale-label">Input scale</span>
                                <select
                                  className="cv-courses-scale-select"
                                  value={e.gradeInputScale ?? "none"}
                                  onChange={(v) =>
                                    setEdu((x) =>
                                      x.map((r, j) =>
                                        j === i
                                          ? { ...r, gradeInputScale: v.target.value as GradeScale }
                                          : r,
                                      ),
                                    )
                                  }>
                                  <option value="none">— Not set —</option>
                                  <option value="danish">Danish 7-point (−3 to 12)</option>
                                  <option value="ects">EU/ECTS grade (A–F)</option>
                                  <option value="gpa">GPA 0–4</option>
                                  <option value="percent">Percentage (0–100)</option>
                                  <option value="linear">Linear (0–max)</option>
                                </select>
                                {e.gradeInputScale === "linear" && (
                                  <input
                                    className="edit-inline cv-courses-scale-max"
                                    value={e.gradeInputScaleMax ?? ""}
                                    onChange={(v) =>
                                      setEdu((x) =>
                                        x.map((r, j) =>
                                          j === i ? { ...r, gradeInputScaleMax: v.target.value } : r,
                                        ),
                                      )
                                    }
                                    placeholder="Max grade"
                                  />
                                )}
                              </div>
                              {/* Extra grade columns */}
                              {e.gradeInputScale && e.gradeInputScale !== "none" && (
                                <div className="cv-courses-col-list">
                                  {(e.gradeColumns ?? []).map((col, ci) => (
                                    <div key={ci} className="cv-courses-col-item">
                                      <span className="cv-courses-scale-label">Column</span>
                                      <select
                                        className="cv-courses-scale-select"
                                        value={col.scale}
                                        onChange={(v) =>
                                          setEdu((x) =>
                                            x.map((r, j) =>
                                              j === i
                                                ? { ...r, gradeColumns: (r.gradeColumns ?? []).map((c, k) => k === ci ? { ...c, scale: v.target.value as GradeColumn["scale"] } : c) }
                                                : r,
                                            ),
                                          )
                                        }>
                                        <option value="percent">% (Percentage)</option>
                                        <option value="danish">DK (Danish 7-point)</option>
                                        <option value="ects">EU/ECTS grade (A–F)</option>
                                        <option value="gpa">GPA</option>
                                        <option value="linear">Linear (0–max)</option>
                                      </select>
                                      {col.scale === "linear" && (
                                        <input
                                          className="edit-inline cv-courses-scale-max"
                                          value={col.scaleMax ?? ""}
                                          onChange={(v) =>
                                            setEdu((x) =>
                                              x.map((r, j) =>
                                                j === i
                                                  ? { ...r, gradeColumns: (r.gradeColumns ?? []).map((c, k) => k === ci ? { ...c, scaleMax: v.target.value } : c) }
                                                  : r,
                                              ),
                                            )
                                          }
                                          placeholder="Max"
                                        />
                                      )}
                                      <button
                                        className="edit-remove-icon"
                                        onClick={() =>
                                          setEdu((x) =>
                                            x.map((r, j) =>
                                              j === i
                                                ? { ...r, gradeColumns: (r.gradeColumns ?? []).filter((_, k) => k !== ci) }
                                                : r,
                                            ),
                                          )
                                        }>
                                        <X size={10} />
                                      </button>
                                    </div>
                                  ))}
                                  <button
                                    className="edit-add-inline"
                                    onClick={() =>
                                      setEdu((x) =>
                                        x.map((r, j) =>
                                          j === i
                                            ? { ...r, gradeColumns: [...(r.gradeColumns ?? []), { scale: "percent" as const }] }
                                            : r,
                                        ),
                                      )
                                    }>
                                    <Plus size={12} /> Add grade column
                                  </button>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                  {editing && (
                    <button
                      className="edit-add-inline"
                      onClick={() =>
                        setEdu((x) => [
                          ...x,
                          { degree: "", institution: "", period: "" },
                        ])
                      }>
                      <Plus size={12} /> Add education
                    </button>
                  )}
                </section>
              );
            }

            if (key === "languages") {
              if (!editing && !langs.some((l) => l.language.trim()))
                return null;
              return (
                <section key="languages" className="cv-section">
                  <h2>
                    <Languages size={13} /> Languages {controls}
                  </h2>
                  <ul className="cv-lang-list">
                    {langs.map(({ language, level }, i) => (
                      <li
                        key={i}
                        className={`cv-lang-item${editing ? " cv-lang-item--editing" : ""}`}>
                        {editing ? (
                          <>
                            <input
                              className="edit-inline cv-lang-name"
                              value={language}
                              onChange={(e) =>
                                setLangs((x) =>
                                  x.map((r, j) =>
                                    j === i
                                      ? { ...r, language: e.target.value }
                                      : r,
                                  ),
                                )
                              }
                              placeholder="Language"
                            />
                            <input
                              className="edit-inline cv-lang-level"
                              value={level}
                              onChange={(e) =>
                                setLangs((x) =>
                                  x.map((r, j) =>
                                    j === i
                                      ? { ...r, level: e.target.value }
                                      : r,
                                  ),
                                )
                              }
                              placeholder="Level"
                            />
                            <button
                              className="edit-remove-icon"
                              onClick={() =>
                                setLangs((x) => x.filter((_, j) => j !== i))
                              }>
                              <X size={10} />
                            </button>
                          </>
                        ) : (
                          <>
                            <span className="cv-lang-name">{language}</span>
                            <span className="cv-lang-level">{level}</span>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                  {editing && (
                    <button
                      className="edit-add-inline"
                      onClick={() =>
                        setLangs((x) => [...x, { language: "", level: "" }])
                      }>
                      <Plus size={12} /> Add language
                    </button>
                  )}
                </section>
              );
            }

            return null;
          })}
        </main>

        {/* ── Footer ──────────────────────────────────────────── */}
        <footer className="cv-footer">
          <p>
            © {new Date().getFullYear()}{" "}
            {editing ? (
              <input
                className="edit-inline"
                value={footer}
                onChange={(e) => setFooter(e.target.value)}
                placeholder="Footer name"
              />
            ) : (
              footer
            )}
          </p>
        </footer>
      </div>
    </>
  );
}

export default App;
