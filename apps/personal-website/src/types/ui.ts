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
  profile: string;
  dateOfBirth: Date;
  jobPosition: string;
  location: ILocation;
  summaries: string[];
  tags: SkillTag[];
}

export type Skill = ISkill & { label: string };

export interface ISkillProps {
  skills: Skill[];
}

export type IResumeProps = IContactProps &
  Omit<IHeroProps, 'tags'> &
  ISkillProps & {
    tags: string[];
  };
