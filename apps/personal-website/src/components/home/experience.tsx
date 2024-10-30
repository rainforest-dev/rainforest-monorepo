import { useMemo, useState } from 'react';
import { resume } from '../../utils/constants';

const experienceTypes = ['job', 'education'] as const;
type ExperienceType = (typeof experienceTypes)[number];

const Experience = () => {
  const [experience, setExperience] = useState<ExperienceType | undefined>();
  const items = useMemo(() => {
    if (!experience) return resume.experience;
    return resume.experience.filter((exp) => exp.type === experience);
  }, [experience]);

  const handleClick = (type: ExperienceType) => {
    if (experience && experience === type) {
      setExperience(undefined);
      return;
    }
    setExperience(type);
  };

  return (
    <>
      <ul className="flex flex-col gap-5">
        {items.map((item) => (
          <li>
            <h3>{item.organization.name}</h3>
            <p>{item.position}</p>
            {Array.isArray(item.description) ? (
              <ul>
                {item.description.map((desc) => (
                  <li>{desc}</li>
                ))}
              </ul>
            ) : (
              <p>{item.description}</p>
            )}
          </li>
        ))}
      </ul>
      <div className="flex gap-10">
        {experienceTypes.map((type) => (
          <button key={type} onClick={() => handleClick(type)}>
            {type}
          </button>
        ))}
      </div>
    </>
  );
};

export default Experience;
