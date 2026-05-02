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
  type LanguageEntry,
  type Header,
} from "./data";

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

  const [theme, setTheme] = useState({
    accent: "",
    bg: "",
    text: "",
    font: "system-ui, 'Segoe UI', Roboto, sans-serif",
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
        if (d.edu) setEdu(d.edu);
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

  function buildCleanHTML() {
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
    if (rows.length <= PREVIEW) return;
    rows.slice(PREVIEW).forEach(function (r) { r.style.display = 'none'; });
    if (tableWrap) tableWrap.classList.add('cv-courses-table-wrap--fading');
    btn.textContent = btn.dataset.labelMore;
    var expanded = false;
    btn.addEventListener('click', function () {
      expanded = !expanded;
      rows.slice(PREVIEW).forEach(function (r) { r.style.display = expanded ? '' : 'none'; });
      if (tableWrap) tableWrap.classList.toggle('cv-courses-table-wrap--fading', !expanded);
      btn.textContent = expanded ? btn.dataset.labelLess : btn.dataset.labelMore;
    });
  });
});
<\/script>`;
    return `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width,initial-scale=1.0">\n<title></title>\n<style>body{margin:0}\n${styles}</style>\n</head>\n<body><div id="root">${clone.outerHTML}</div>${script}</body>\n</html>`;
  }

  function exportPDF() {
    const html = buildCleanHTML();
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
            lines.push(`\n| # | Course | ECTS | Grade |`);
            lines.push(`| --- | --- | --- | --- |`);
            for (const c of e.courses)
              if (c.name.trim())
                lines.push(`| ${c.number} | ${c.name} | ${c.ects} | ${c.grade} |`);
            if (e.showCourseSummary) {
              const filled = e.courses.filter((c) => c.name.trim());
              const totalEcts = filled.reduce((sum, c) => {
                const n = parseFloat(c.ects); return sum + (isNaN(n) ? 0 : n);
              }, 0);
              const graded = filled.filter((c) => !isNaN(parseFloat(c.grade)) && !isNaN(parseFloat(c.ects)));
              const weightedSum = graded.reduce((sum, c) => sum + parseFloat(c.grade) * parseFloat(c.ects), 0);
              const weightedEcts = graded.reduce((sum, c) => sum + parseFloat(c.ects), 0);
              const gpa = weightedEcts > 0 ? weightedSum / weightedEcts : null;
              lines.push(`| | **Total** | **${totalEcts}** | **${gpa !== null ? gpa.toFixed(2) : "—"}** |`);
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
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <div className={`cv${editing ? " cv--editing" : ""}`} style={themeVars}>
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
                                const filled = e.courses!.filter((c) => c.name.trim());
                                const expanded = expandedCourses.has(i);
                                const visible = expanded ? filled : filled.slice(0, PREVIEW);
                                const hasMore = filled.length > PREVIEW;
                                return (
                                  <div className="cv-courses-wrap">
                                    <div className={`cv-courses-table-wrap${!expanded && hasMore ? " cv-courses-table-wrap--fading" : ""}`}>
                                      <table className="cv-courses-table">
                                        <thead>
                                          <tr>
                                            <th>#</th>
                                            <th>Course</th>
                                            <th>ECTS</th>
                                            <th>Grade</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {visible.map((c, ci) => (
                                            <tr key={ci}>
                                              <td>{c.number}</td>
                                              <td>{c.name}</td>
                                              <td>{c.ects}</td>
                                              <td>{c.grade}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                        {(expanded || !hasMore) && e.showCourseSummary && (() => {
                                          const totalEcts = filled.reduce((sum, c) => {
                                            const n = parseFloat(c.ects);
                                            return sum + (isNaN(n) ? 0 : n);
                                          }, 0);
                                          const graded = filled.filter((c) => !isNaN(parseFloat(c.grade)) && !isNaN(parseFloat(c.ects)));
                                          const weightedSum = graded.reduce((sum, c) => sum + parseFloat(c.grade) * parseFloat(c.ects), 0);
                                          const weightedEcts = graded.reduce((sum, c) => sum + parseFloat(c.ects), 0);
                                          const gpa = weightedEcts > 0 ? weightedSum / weightedEcts : null;
                                          return (
                                            <tfoot>
                                              <tr className="cv-courses-summary">
                                                <td colSpan={2}>Total</td>
                                                <td>{totalEcts}</td>
                                                <td>{gpa !== null ? gpa.toFixed(2) : "—"}</td>
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
