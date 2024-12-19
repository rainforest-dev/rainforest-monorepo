import type { ImageMetadata } from 'astro';

import { ILocation, IName, ISkill, SkillTag } from './data';

export interface IContactProps {
  email: string;
  phone: string;
  links: {
    linkedin: string;
    github: string;
    website: string;
    [key: string]: string;
  };
}

export interface IHeroProps {
  name: IName;
  profile: Promise<{ default: ImageMetadata }> | ImageMetadata;
  dateOfBirth: Date;
  jobPosition: string;
  location: ILocation;
  summaries: string[];
  tags: SkillTag[];
}

export type Skill = ISkill & { label: string };

export type IResumeProps = IContactProps &
  Omit<IHeroProps, 'tags'> & {
    tags: string[];
  };
