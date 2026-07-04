import type { SkillTag } from '@types';
import { type CollectionEntry,getCollection, getEntry } from 'astro:content';

export interface ResolvedOrganization {
  id: string;
  name: string;
  link?: string;
}

export interface ResolvedExperience {
  id: string;
  type: 'job' | 'education';
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

export async function getWorkExperience(
  options: { technology?: SkillTag; lang?: string } = {},
): Promise<ResolvedExperience[]> {
  const { technology, lang = 'en' } = options;
  const entries = await getCollection(
    'experiences',
    (entry) => entry.data.type === 'job' && entry.data.language === lang,
  );
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
