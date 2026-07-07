import type { ExperienceTag, SkillTag } from '@types';
import { type CollectionEntry, getCollection, getEntry } from 'astro:content';

export interface ResolvedOrganization {
  id: string;
  name: string;
  link?: string;
}

export interface ResolvedExperience {
  id: string;
  type: ExperienceTag;
  language: string;
  position: string;
  startAt: Date;
  endAt?: Date;
  technologies: SkillTag[];
  organization: ResolvedOrganization;
  content: string;
}

async function resolveOrganization(
  ref: CollectionEntry<'experiences'>['data']['organization'],
): Promise<ResolvedOrganization> {
  const org = await getEntry(ref);
  if (!org) throw new Error(`Organization not found: ${ref.id}`);
  return { id: org.id, name: org.data.name, link: org.data.link };
}

/**
 * Resolves an experience entry. `technologies` must be the already-merged set
 * (direct + linked projects') so the returned data stays consistent with
 * whatever technology filter was used to find this entry in the first place —
 * see `experienceTechnologies` below.
 */
async function resolveExperience(
  entry: CollectionEntry<'experiences'>,
  technologies: SkillTag[],
): Promise<ResolvedExperience> {
  return {
    id: entry.id,
    type: entry.data.type,
    language: entry.data.language,
    position: entry.data.position,
    startAt: entry.data.startAt,
    endAt: entry.data.endAt,
    technologies,
    organization: await resolveOrganization(entry.data.organization),
    content: entry.body ?? '',
  };
}

/** Technologies declared directly on the experience, plus technologies of any linked projects. */
async function experienceTechnologies(entry: CollectionEntry<'experiences'>): Promise<SkillTag[]> {
  const direct = entry.data.technologies ?? [];
  const projectRefs = entry.data.projects ?? [];
  const projects = await Promise.all(projectRefs.map((ref) => getEntry(ref)));
  const fromProjects = projects.flatMap((p) => p?.data.technologies ?? []);
  return Array.from(new Set([...direct, ...fromProjects]));
}

/** Experience entries of a given type (`job` or `education`) in a given language. */
function getExperiencesByType(type: ExperienceTag, lang: string) {
  return getCollection('experiences', (entry) => entry.data.type === type && entry.data.language === lang);
}

export async function getWorkExperience(
  options: { technology?: SkillTag; lang?: string } = {},
): Promise<ResolvedExperience[]> {
  const { technology, lang = 'en' } = options;
  const entries = await getExperiencesByType('job', lang);
  const withTech = await Promise.all(
    entries.map(async (entry) => ({
      entry,
      technologies: await experienceTechnologies(entry),
    })),
  );
  const filtered = technology
    ? withTech.filter(({ technologies }) => technologies.includes(technology))
    : withTech;
  return Promise.all(filtered.map(({ entry, technologies }) => resolveExperience(entry, technologies)));
}

export async function getEducation(
  options: { lang?: string } = {},
): Promise<ResolvedExperience[]> {
  const { lang = 'en' } = options;
  const entries = await getExperiencesByType('education', lang);
  return Promise.all(
    entries.map(async (entry) => resolveExperience(entry, await experienceTechnologies(entry))),
  );
}

/**
 * A single experience (job or education) by id, fully resolved — same shape as
 * `getWorkExperience`/`getEducation`'s entries. Used by the MCP resource reader so a
 * `profile://experience/{id}` read returns the same resolved organization/technologies
 * as the tool surface, not a raw entry with unresolved reference pointers.
 */
export async function getExperienceById(id: string): Promise<ResolvedExperience | undefined> {
  const entry = await getEntry('experiences', id);
  if (!entry) return undefined;
  return resolveExperience(entry, await experienceTechnologies(entry));
}

export interface ResolvedProject {
  id: string;
  name: string;
  language: string;
  technologies: SkillTag[];
  organization: ResolvedOrganization;
  experience: string;
  content: string;
}

async function resolveProject(entry: CollectionEntry<'projects'>): Promise<ResolvedProject> {
  return {
    id: entry.id,
    name: entry.data.name,
    language: entry.data.language,
    technologies: entry.data.technologies,
    organization: await resolveOrganization(entry.data.organization),
    experience: entry.data.experience.id,
    content: entry.body ?? '',
  };
}

export async function getProjects(
  options: { technology?: SkillTag; lang?: string } = {},
): Promise<ResolvedProject[]> {
  const { technology, lang = 'en' } = options;
  const entries = await getCollection(
    'projects',
    (entry) =>
      entry.data.language === lang &&
      (!technology || entry.data.technologies.includes(technology)),
  );
  return Promise.all(entries.map(resolveProject));
}

/** A single project by id, fully resolved — same rationale as `getExperienceById`. */
export async function getProjectById(id: string): Promise<ResolvedProject | undefined> {
  const entry = await getEntry('projects', id);
  if (!entry) return undefined;
  return resolveProject(entry);
}

export interface ResolvedSkill {
  id: string;
  name: string;
  icon: SkillTag;
  tags: string[];
  content: string;
}

export async function getSkills(options: { lang?: string } = {}): Promise<ResolvedSkill[]> {
  const { lang = 'en' } = options;
  const entries = await getCollection('skills', (entry) => entry.id.startsWith(`${lang}/`));
  return entries.map((entry) => ({
    id: entry.id,
    name: entry.data.name,
    icon: entry.data.icon,
    tags: entry.data.tags ?? [],
    content: entry.body ?? '',
  }));
}

export interface ProfileSummary {
  experienceCount: number;
  projectCount: number;
  skillCount: number;
  topTechnologies: SkillTag[];
}

export async function getProfileSummary(options: { lang?: string } = {}): Promise<ProfileSummary> {
  const { lang = 'en' } = options;
  const [experiences, projects, skills] = await Promise.all([
    getWorkExperience({ lang }),
    getProjects({ lang }),
    getSkills({ lang }),
  ]);
  const techCounts = new Map<SkillTag, number>();
  for (const exp of experiences) {
    for (const tech of exp.technologies) techCounts.set(tech, (techCounts.get(tech) ?? 0) + 1);
  }
  for (const project of projects) {
    for (const tech of project.technologies) techCounts.set(tech, (techCounts.get(tech) ?? 0) + 1);
  }
  const topTechnologies = [...techCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([tech]) => tech);
  return {
    experienceCount: experiences.length,
    projectCount: projects.length,
    skillCount: skills.length,
    topTechnologies,
  };
}

export async function searchByTechnology(
  query: string,
  options: { lang?: string } = {},
): Promise<{ experiences: ResolvedExperience[]; projects: ResolvedProject[] }> {
  const { lang = 'en' } = options;
  const q = query.toLowerCase();
  const [experiences, projects] = await Promise.all([
    getWorkExperience({ lang }),
    getProjects({ lang }),
  ]);
  return {
    experiences: experiences.filter((e) => e.technologies.some((t) => t.toLowerCase().includes(q))),
    projects: projects.filter((p) => p.technologies.some((t) => t.toLowerCase().includes(q))),
  };
}
