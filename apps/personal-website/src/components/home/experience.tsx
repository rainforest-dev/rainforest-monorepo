import { FilterChip } from '@components';
import { ExperienceTag } from '@types';
import { getExperience } from '@utils';
import { ComponentProps, useMemo, useState } from 'react';

import Timeline from './timeline';

interface IProps extends ComponentProps<typeof Timeline> {
  filters: { type: ExperienceTag; label: string }[];
}

const Experience = ({ experience, filters }: IProps) => {
  const [experienceType, setExperienceType] = useState<
    ExperienceTag | undefined
  >();
  const items = useMemo(
    () => getExperience(experience, experienceType),
    [experienceType, experience]
  );

  const handleClick = (type: ExperienceTag): void => {
    if (experienceType && experienceType === type) {
      setExperienceType(undefined);
      return;
    }
    setExperienceType(type);
  };

  return (
    <>
      <div className="size-full sm:h-4/5 sm:overflow-auto grow-1">
        <Timeline experience={items} />
      </div>
      <div className="flex gap-10 mt-10">
        {filters.map(({ type, label }) => (
          <FilterChip
            key={type}
            selected={experienceType === type}
            onClick={() => handleClick(type)}
          >
            {label}
          </FilterChip>
        ))}
      </div>
    </>
  );
};

export default Experience;
