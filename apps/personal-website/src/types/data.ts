import { tags } from '@utils/constants';

export interface IName {
  first: string;
  last: string;
  fullname: string;
}

export interface ILocation {
  city: string;
  country: string;
}

export type SkillTag = (typeof tags)['skills'][number];

export type Tag = SkillTag;

export type Description = string | string[];

export interface IOrganization {
  name: string;
  department?: string;
  link?: string;
}

export interface IProject {
  name: string;
  description?: Description;
  technologies: SkillTag[];
}

export interface IExperience {
  type: 'job' | 'education';
  organization: IOrganization;
  position: string;
  description?: Description;
  projects?: IProject[];
  startAt: `${number}-${number}`;
  endAt?: `${number}-${number}`;
  technologies?: SkillTag[];
}
