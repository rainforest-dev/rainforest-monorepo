import { createComponent } from '@lit/react';
import { MdFilterChip } from '@material/web/chips/filter-chip';
import { getExperience, transformExperience } from '@utils';
import { resume } from '@utils/constants';
import React, { useMemo, useState } from 'react';

import Timeline from './timeline';

const FilterChip = createComponent({
  tagName: 'md-filter-chip',
  elementClass: MdFilterChip,
  react: React,
  events: {
    onClick: 'click',
  },
});

const experienceTypes = ['job', 'education'] as const;
type ExperienceType = (typeof experienceTypes)[number];

const Experience = () => {
  const [experience, setExperience] = useState<ExperienceType | undefined>();
  const items = useMemo(
    () => getExperience(resume.experience, experience).map(transformExperience),
    [experience, resume.experience]
  );

  const handleClick = (type: ExperienceType): void => {
    if (experience && experience === type) {
      setExperience(undefined);
      return;
    }
    setExperience(type);
  };

  return (
    <>
      <div className="size-full sm:h-4/5 sm:overflow-auto grow-1">
        <Timeline items={items} />
      </div>
      <div className="flex gap-10 mt-10">
        {experienceTypes.map((type) => (
          <FilterChip
            key={type}
            selected={experience === type}
            onClick={() => handleClick(type)}
          >
            {type}
          </FilterChip>
        ))}
      </div>
    </>
  );
};

export default Experience;
