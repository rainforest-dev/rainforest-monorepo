import { useMemo, useState } from 'react';
import { resume } from '../../utils/constants';
import Timeline from './timeline';
import { transformExperience } from '../../utils';

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
    if (!experience) return result.map(transformExperience);
    return result
      .filter((exp) => exp.type === experience)
      .map(transformExperience);
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
      <div className="h-4/5 w-full overflow-auto grow-1">
        <Timeline items={items} />
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
