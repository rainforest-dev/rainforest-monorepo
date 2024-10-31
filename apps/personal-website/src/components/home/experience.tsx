import { useMemo, useState } from 'react';
import { resume } from '../../utils/constants';
import { getBrandIconName } from '../../utils';
import { Icon } from '@iconify-icon/react';

const experienceTypes = ['job', 'education'] as const;
type ExperienceType = (typeof experienceTypes)[number];

const Experience = () => {
  const [experience, setExperience] = useState<ExperienceType | undefined>();
  const items = useMemo(() => {
    const result = [...resume.experience].sort((a, b) => {
      if (a.startAt < b.startAt) return 1;
      if (a.startAt > b.startAt) return -1;
      return 0;
    });
    if (!experience) return result;
    return result.filter((exp) => exp.type === experience);
  }, [experience, resume.experience]);

  const handleClick = (type: ExperienceType) => {
    if (experience && experience === type) {
      setExperience(undefined);
      return;
    }
    setExperience(type);
  };

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
    <>
      <div className="size-4/5 overflow-auto">
        <ul className="flex flex-col gap-5 relative">
          <div className="absolute w-0.5 h-full bg-on-background left-1/2 -translate-x-1/2" />
          {items.map((item) => (
            <li
              key={`${item.organization.name}_${item.position}`}
              className="flex-row-center odd:flex-row-reverse *:flex-1 odd:*:last:text-right even:*:first:text-right gap-10"
            >
              <div>{item.startAt}</div>
              <div className="absolute size-2 bg-on-background left-1/2 -translate-x-1/2 rounded-full" />
              <div>
                <h3 className="text-2xl">{item.organization.name}</h3>
                <p className="text-lg text-primary/85">{item.position}</p>
                {renderDescription(item.description)}
                {'projects' in item && item.projects.length && (
                  <ul>
                    {item.projects.map((project) => (
                      <li key={project.name}>
                        <h4 className="text-lg mb-1.5 mt-3">{project.name}</h4>
                        {renderDescription(project.description)}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="inline-flex gap-2 mt-4">
                  {item.tags.map((tag) => {
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
      </div>
      <div className="flex gap-10 mt-10">
        {experienceTypes.map((type) => (
          <label
            key={type}
            htmlFor={type}
            className="border px-2 py-1 rounded cursor-pointer size-fit has-[:checked]:bg-primary has-[:checked]:text-on-primary has-[:hover]:bg-primary/80 has-[:hover]:text-on-primary"
          >
            <input
              type="checkbox"
              className="sr-only peer"
              id={type}
              name={type}
              checked={experience === type}
              onChange={() => handleClick(type)}
            />
            {type}
          </label>
        ))}
      </div>
    </>
  );
};

export default Experience;
