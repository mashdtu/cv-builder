export interface LanguageEntry {
  language: string;
  level: string;
}

export interface ExperienceEntry {
  role: string;
  company: string;
  period: string;
  description: string;
}

export interface EducationEntry {
  degree: string;
  institution: string;
  period: string;
  description?: string;
}

export interface Header {
  name: string;
  pronouns: string;
  title: string;
  email: string;
  github: string;
  location: string;
}

export const header: Header = {
  name: "Name",
  pronouns: "pro/nouns",
  title: "Title",
  email: "email@example.com",
  github: "account",
  location: "City, Country",
};

export const footerName = "Footer name";

export const about = ["Paragraph One.", "Paragraph Two."];

export const skills = ["Skill One", "Skill Two"];

export const experience: ExperienceEntry[] = [
  {
    role: "Role",
    company: "Company",
    period: "Time period",
    description: "Description",
  },
];

export const education: EducationEntry[] = [
  {
    degree: "Degree",
    institution: "Intitution",
    period: "Time period",
  },
];

export const languages: LanguageEntry[] = [
  { language: "Language One", level: "Level" },
  { language: "Language Two", level: "Level" },
];
