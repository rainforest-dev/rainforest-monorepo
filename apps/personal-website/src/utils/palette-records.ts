import type {
  ResolvedExperience,
  ResolvedProject,
  ResolvedSkill,
} from '@rainforest-dev/personal-data';

import type { Searchable } from './search';

export interface PalettePost {
  id: string;
  data: { title: string; tags: string[] };
}

export interface PaletteSources {
  experiences: ResolvedExperience[];
  projects: ResolvedProject[];
  skills: ResolvedSkill[];
  posts: PalettePost[];
}

export function buildPaletteRecords({
  experiences,
  projects,
  skills,
  posts,
}: PaletteSources): Searchable[] {
  return [
    ...experiences.map((experience) => ({
      id: `experience/${experience.id}`,
      kind: 'experience' as const,
      title: `${experience.position} · ${experience.organization.name}`,
      keywords: experience.technologies,
      href: '/resume',
    })),
    ...projects.map((project) => ({
      id: `project/${project.id}`,
      kind: 'project' as const,
      title: project.name,
      keywords: project.technologies,
      href: `/portfolio/${project.id.split('/').pop()}`,
    })),
    ...skills.map((skill) => ({
      id: `skill/${skill.id}`,
      kind: 'skill' as const,
      title: skill.name,
      keywords: skill.tags,
      href: '/#skills',
    })),
    ...posts.map((post) => ({
      id: `post/${post.id}`,
      kind: 'post' as const,
      title: post.data.title,
      keywords: post.data.tags,
      href: `/blog/${post.id}`,
    })),
  ];
}
