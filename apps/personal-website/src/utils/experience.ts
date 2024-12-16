import { IExperience } from '@types';

export const getTopTechnologies = (
  experience: {
    technologies?: string[];
    projects?: { technologies: string[] }[];
  },
  top = 10
) => {
  if (experience.technologies?.length) {
    return experience.technologies.slice(0, top);
  }
  if (!experience.projects) {
    return [];
  }
  const map = experience.projects.reduce((acc, project) => {
    project.technologies.forEach((tag) => {
      acc.set(tag, (acc.get(tag) ?? 0) + 1);
    });
    return acc;
  }, new Map<string, number>());
  return Array.from(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, top)
    .map(([tag]) => tag);
};

export const getExperience = (
  experience: IExperience[],
  type?: IExperience['type']
) => {
  const sorted = [...experience].sort((a, b) => {
    if (a.startAt < b.startAt) return 1;
    if (a.startAt > b.startAt) return -1;
    return 0;
  });
  if (!type) return sorted;
  return sorted.filter((exp) => exp.type === type);
};
