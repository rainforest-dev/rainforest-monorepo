import { IExperience, ILocation, IName, SkillTag } from './data';

export interface IHeroProps {
  name: IName;
  dateOfBirth: Date;
  jobPosition: string;
  location: ILocation;
  summaries: string[];
  tags: SkillTag[];
}

export interface ITimelineProps {
  items: IExperience[];
}

export type IResumeProps = IHeroProps;
