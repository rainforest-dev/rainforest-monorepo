export const isServerSide = typeof window === 'undefined';

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
    case 'linkedin':
    case 'github':
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

export const getLinkedInUrl = (username: string) =>
  `https://www.linkedin.com/in/${username}`;

export const getGitHubUrl = (username: string) =>
  `https://github.com/${username}`;

export * from './experience';
export * from './i18n';
export * from './ui';
export * from './strapi';
