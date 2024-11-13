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
