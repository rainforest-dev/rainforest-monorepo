import { Icon } from '@iconify-icon/react';
import type { ITimelineProps } from '@types';
import { getBrandIconName, getTopTechnologies } from '@utils';
import { resumeDateFormat } from '@utils/constants';
import { format } from 'date-fns';

const Description = ({
  description,
}: {
  description: ITimelineProps['experience'][number]['description'];
}) => {
  if (Array.isArray(description)) {
    return (
      <ul className="list-disc list-inside text-xs sm:text-base">
        {description.map((desc) => (
          <li key={desc}>{desc}</li>
        ))}
      </ul>
    );
  }
  return description ? <p>{description}</p> : <></>;
};

const ProjectItem = ({
  project,
}: {
  project:
    | Exclude<
        ITimelineProps['experience'][number]['projects'],
        undefined
      >[number]
    | undefined;
}) => {
  return (
    <li>
      <h4 className="text-sm mb-0.5 mt-2 sm:text-lg sm:mb-1.5 sm:mt-3">
        {project?.name}
      </h4>
      <Description description={project?.description} />
    </li>
  );
};
const TimelineItem = ({
  item,
}: {
  item: ITimelineProps['experience'][number];
}) => {
  const technologies = getTopTechnologies(item);
  const projects = [...(item.projects ?? [])].reverse();

  return (
    <li
      className="flex flex-col *:flex-1 pl-[1em] relative
                      sm:pl-0 sm:flex-row sm:items-center sm:odd:flex-row-reverse sm:odd:*:last:text-right sm:even:*:first:text-right sm:gap-10"
    >
      <div className="text-xs sm:text-base">
        {format(new Date(item.startAt), resumeDateFormat)}
      </div>
      <div
        className="absolute size-2 bg-on-surface rounded-full 
                          left-0 -translate-x-1/2 top-7 
                          sm:top-auto sm:left-1/2 sm:-translate-x-1/2"
      />
      <div>
        <h3 className="sm:text-2xl">{item.organization.name}</h3>
        <p className="text-sm sm:text-lg text-primary/85">{item.position}</p>
        <Description description={item.description} />
        {
          <ul>
            {projects.map((project) => (
              <ProjectItem key={project.name} project={project} />
            ))}
          </ul>
        }
        <div className="inline-flex gap-2 mt-4">
          {technologies.map((tag) => {
            const icon = getBrandIconName(tag);
            return icon ? (
              <Icon key={tag} icon={icon} className="size-5" height="none" />
            ) : (
              <></>
            );
          })}
        </div>
      </div>
    </li>
  );
};

export default function Timeline({ experience = [] }: ITimelineProps) {
  return (
    <ul
      className="flex flex-col gap-4 sm:gap-5 relative
                  after:content-[''] after:absolute after:w-0.5 after:h-full after:bg-on-surface after:left-0 after:-translate-x-1/2 after:sm:left-1/2"
    >
      {experience.map((item) => {
        return (
          <TimelineItem
            key={`${item.organization}_${item.position}`}
            item={item}
          />
        );
      })}
    </ul>
  );
}
