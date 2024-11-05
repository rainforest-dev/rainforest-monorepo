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
        <ul className="list-disc list-inside">
          {description.map((desc) => (
            <li key={desc}>{desc}</li>
          ))}
        </ul>
      );
    }
    return <p>{description}</p>;
  };

  return (
    <ul className="flex flex-col gap-5 relative">
      <div className="absolute w-0.5 h-full bg-on-background left-1/2 -translate-x-1/2" />
      {items.map((item) => (
        <li
          key={`${item.organization}_${item.position}`}
          className="flex-row-center odd:flex-row-reverse *:flex-1 odd:*:last:text-right even:*:first:text-right gap-10"
        >
          <div>{item.date}</div>
          <div className="absolute size-2 bg-on-background left-1/2 -translate-x-1/2 rounded-full" />
          <div>
            <h3 className="text-2xl">{item.organization}</h3>
            <p className="text-lg text-primary/85">{item.position}</p>
            {renderDescription(item.description)}
            {
              <ul>
                {item.projects?.toReversed().map((project) => (
                  <li key={project.name}>
                    <h4 className="text-lg mb-1.5 mt-3">{project.name}</h4>
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
