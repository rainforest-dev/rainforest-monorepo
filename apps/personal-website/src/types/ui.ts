import { ILocation, IName, SkillTag } from './data';

export interface IHeroProps {
  name: IName;
  dateOfBirth: Date;
  jobPosition: string;
  location: ILocation;
  summaries: string[];
  tags: SkillTag[];
}
