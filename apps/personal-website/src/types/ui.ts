import { IExperience, ILocation, IName, ISkill, SkillTag } from './data';

export interface IHeroProps {
  name: IName;
  dateOfBirth: Date;
  jobPosition: string;
  location: ILocation;
  summaries: string[];
  tags: SkillTag[];
}

export interface ITimelineProps {
  experience: IExperience[];
}

export interface ISkillProps {
  skills: ISkill[];
}

export type IResumeProps = IHeroProps & ISkillProps;
