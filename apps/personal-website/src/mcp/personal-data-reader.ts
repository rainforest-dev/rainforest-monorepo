import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import matter from 'gray-matter';
import type { Experience, Organization, Project, Skill } from './types';

/**
 * Recursively finds all files in a directory with specific extensions
 */
function findFiles(
  dir: string,
  extensions: string[],
  baseDir: string = dir
): string[] {
  const files: string[] = [];

  try {
    const entries = readdirSync(dir);

    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        files.push(...findFiles(fullPath, extensions, baseDir));
      } else if (extensions.some((ext) => entry.endsWith(ext))) {
        files.push(relative(baseDir, fullPath));
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error);
  }

  return files;
}

/**
 * Reads and parses an organization JSON file
 */
export function readOrganization(
  orgDir: string,
  relativePath: string
): Organization | null {
  try {
    const fullPath = join(orgDir, relativePath);
    const content = readFileSync(fullPath, 'utf-8');
    const data = JSON.parse(content);

    const id = relativePath.replace(/\.json$/, '');

    return {
      id,
      name: data.name || 'Unknown',
      language: data.language || 'en',
      department: data.department,
      link: data.link,
    };
  } catch (error) {
    console.error(`Error reading organization ${relativePath}:`, error);
    return null;
  }
}

/**
 * Reads all organizations
 */
export function readAllOrganizations(orgDir: string): Organization[] {
  const files = findFiles(orgDir, ['.json']);
  const organizations: Organization[] = [];

  for (const file of files) {
    const org = readOrganization(orgDir, file);
    if (org) {
      organizations.push(org);
    }
  }

  return organizations;
}

/**
 * Reads and parses an experience markdown file
 */
export function readExperience(
  experienceDir: string,
  relativePath: string
): Experience | null {
  try {
    const fullPath = join(experienceDir, relativePath);
    const fileContent = readFileSync(fullPath, 'utf-8');
    const { data, content } = matter(fileContent);

    const id = relativePath.replace(/\.md$/, '');

    // Parse dates (format: YYYY-MM)
    const startAt = data.startAt ? new Date(data.startAt) : new Date();
    const endAt = data.endAt ? new Date(data.endAt) : undefined;

    return {
      id,
      type: data.type || 'job',
      language: data.language || 'en',
      organization: typeof data.organization === 'string' ? data.organization : 'unknown',
      position: data.position || 'Unknown Position',
      startAt,
      endAt,
      technologies: Array.isArray(data.technologies) ? data.technologies : [],
      projects: Array.isArray(data.projects) ? data.projects : [],
      content,
    };
  } catch (error) {
    console.error(`Error reading experience ${relativePath}:`, error);
    return null;
  }
}

/**
 * Reads all experiences
 */
export function readAllExperiences(experienceDir: string): Experience[] {
  const files = findFiles(experienceDir, ['.md']);
  const experiences: Experience[] = [];

  for (const file of files) {
    const exp = readExperience(experienceDir, file);
    if (exp) {
      experiences.push(exp);
    }
  }

  // Sort by start date (newest first)
  return experiences.sort((a, b) => b.startAt.getTime() - a.startAt.getTime());
}

/**
 * Reads and parses a project markdown file
 */
export function readProject(projectDir: string, relativePath: string): Project | null {
  try {
    const fullPath = join(projectDir, relativePath);
    const fileContent = readFileSync(fullPath, 'utf-8');
    const { data, content } = matter(fileContent);

    const id = relativePath.replace(/\.md$/, '');

    return {
      id,
      name: data.name || 'Unknown Project',
      language: data.language || 'en',
      technologies: Array.isArray(data.technologies) ? data.technologies : [],
      organization: typeof data.organization === 'string' ? data.organization : 'unknown',
      experience: typeof data.experience === 'string' ? data.experience : 'unknown',
      content,
    };
  } catch (error) {
    console.error(`Error reading project ${relativePath}:`, error);
    return null;
  }
}

/**
 * Reads all projects
 */
export function readAllProjects(projectDir: string): Project[] {
  const files = findFiles(projectDir, ['.md']);
  const projects: Project[] = [];

  for (const file of files) {
    const project = readProject(projectDir, file);
    if (project) {
      projects.push(project);
    }
  }

  return projects;
}

/**
 * Reads and parses a skill markdown file
 */
export function readSkill(skillDir: string, relativePath: string): Skill | null {
  try {
    const fullPath = join(skillDir, relativePath);
    const fileContent = readFileSync(fullPath, 'utf-8');
    const { data, content } = matter(fileContent);

    const id = relativePath.replace(/\.md$/, '');

    return {
      id,
      name: data.name || 'Unknown Skill',
      icon: data.icon || '',
      tags: Array.isArray(data.tags) ? data.tags : [],
      content,
    };
  } catch (error) {
    console.error(`Error reading skill ${relativePath}:`, error);
    return null;
  }
}

/**
 * Reads all skills
 */
export function readAllSkills(skillDir: string): Skill[] {
  const files = findFiles(skillDir, ['.md']);
  const skills: Skill[] = [];

  for (const file of files) {
    const skill = readSkill(skillDir, file);
    if (skill) {
      skills.push(skill);
    }
  }

  return skills;
}

/**
 * Filters experiences by type (job or education)
 */
export function filterExperiencesByType(
  experiences: Experience[],
  type: 'job' | 'education'
): Experience[] {
  return experiences.filter((exp) => exp.type === type);
}

/**
 * Filters experiences by technology
 */
export function filterExperiencesByTechnology(
  experiences: Experience[],
  technology: string
): Experience[] {
  return experiences.filter(
    (exp) => exp.technologies && exp.technologies.includes(technology)
  );
}

/**
 * Filters projects by technology
 */
export function filterProjectsByTechnology(
  projects: Project[],
  technology: string
): Project[] {
  return projects.filter((proj) => proj.technologies.includes(technology));
}

/**
 * Filters skills by tag
 */
export function filterSkillsByTag(skills: Skill[], tag: string): Skill[] {
  return skills.filter((skill) => skill.tags && skill.tags.includes(tag));
}

/**
 * Gets all unique technologies from experiences and projects
 */
export function getAllTechnologies(
  experiences: Experience[],
  projects: Project[]
): string[] {
  const techSet = new Set<string>();

  for (const exp of experiences) {
    if (exp.technologies) {
      exp.technologies.forEach((tech) => techSet.add(tech));
    }
  }

  for (const proj of projects) {
    proj.technologies.forEach((tech) => techSet.add(tech));
  }

  return Array.from(techSet).sort();
}

/**
 * Resolves an organization reference
 */
export function resolveOrganization(
  organizations: Organization[],
  orgId: string
): Organization | null {
  return organizations.find((org) => org.id === orgId) || null;
}

/**
 * Resolves project references
 */
export function resolveProjects(
  projects: Project[],
  projectIds: string[]
): Project[] {
  return projectIds
    .map((id) => projects.find((proj) => proj.id === id))
    .filter((proj): proj is Project => proj !== undefined);
}
