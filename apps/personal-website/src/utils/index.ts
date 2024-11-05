import type { ComponentProps } from 'react';
import type { resume } from './constants';
import type Timeline from '../components/home/timeline';

export const getBrandIconName = (_name: string) => {
  let name = undefined;
  switch (_name) {
    case 'vue':
    case 'react':
    case 'flutter':
    case 'playwright':
    case 'vitest':
    case 'python':
      name = `logos:${_name}`;
      break;
    case 'docker':
    case 'nextjs':
    case 'auth0':
    case 'qwik':
    case 'pytorch':
    case 'fastapi':
      name = `logos:${_name}-icon`;
      break;
    case 'mui':
      name = 'logos:material-ui';
      break;
    case 'tailwindcss':
    case 'swift':
      name = `devicon:${_name}`;
      break;
    default:
      break;
  }
  return name;
};

export const transformExperience = (
  experience: (typeof resume)['experience'][number]
): ComponentProps<typeof Timeline>['items'][number] => {
  return {
    date: experience.startAt,
    organization: experience.organization.name,
    position: experience.position,
    description: experience.description,
    projects:
      'projects' in experience
        ? experience.projects.map((project) => ({
            name: project.name,
            description: project.description as any,
          }))
        : [],
    technologies: [...experience.tags],
  };
};

export const getExperience = (
  experience: (typeof resume)['experience'],
  type?: (typeof resume)['experience'][number]['type']
) => {
  const sorted = [...experience].sort((a, b) => {
    if (a.startAt < b.startAt) return 1;
    if (a.startAt > b.startAt) return -1;
    return 0;
  });
  if (!type) return sorted;
  return sorted.filter((exp) => exp.type === type);
};

export const getLinkedInUrl = (username: string) =>
  `https://www.linkedin.com/in/${username}`;

export const getGitHubUrl = (username: string) =>
  `https://github.com/${username}`;
