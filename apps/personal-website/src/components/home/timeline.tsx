import { Icon } from '@iconify-icon/react';
import { getBrandIconName } from '../../utils';

interface IProps {
  items: {
    date: string;
    organization: string;
    position: string;
    description: string | string[];
    projects?: {
      name: string;
      description: string | string[];
    }[];
    technologies: string[];
  }[];
}

export default function Timeline({ items = [] }: IProps) {
  const renderDescription = (description: string | readonly string[]) => {
    if (Array.isArray(description)) {
      return (
        <ul className="list-disc list-inside text-xs sm:text-base">
          {description.map((desc) => (
            <li key={desc}>{desc}</li>
          ))}
        </ul>
      );
    }
    return <p>{description}</p>;
  };

  return (
    <ul className="flex flex-col gap-4 sm:gap-5 relative">
      <div className="absolute w-0.5 h-full bg-on-background left-0 -translate-x-1/2 sm:left-1/2" />
      {items.map((item) => (
        <li
          key={`${item.organization}_${item.position}`}
          className="flex flex-col *:flex-1 pl-[1em] relative
                      sm:pl-0 sm:flex-row sm:items-center sm:odd:flex-row-reverse sm:odd:*:last:text-right sm:even:*:first:text-right sm:gap-10"
        >
          <div className="text-xs sm:text-base">{item.date}</div>
          <div
            className="absolute size-2 bg-on-background rounded-full 
                          left-0 -translate-x-1/2 top-7 
                          sm:top-auto sm:left-1/2 sm:-translate-x-1/2"
          />
          <div>
            <h3 className="sm:text-2xl">{item.organization}</h3>
            <p className="text-sm sm:text-lg text-primary/85">
              {item.position}
            </p>
            {renderDescription(item.description)}
            {
              <ul>
                {item.projects?.toReversed().map((project) => (
                  <li key={project.name}>
                    <h4 className="text-sm mb-0.5 mt-2 sm:text-lg sm:mb-1.5 sm:mt-3">
                      {project.name}
                    </h4>
                    {renderDescription(project.description)}
                  </li>
                ))}
              </ul>
            }
            <div className="inline-flex gap-2 mt-4">
              {item.technologies.map((tag) => {
                const icon = getBrandIconName(tag);
                return icon ? (
                  <Icon
                    key={tag}
                    icon={icon}
                    className="size-5"
                    height="none"
                  />
                ) : (
                  <></>
                );
              })}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
