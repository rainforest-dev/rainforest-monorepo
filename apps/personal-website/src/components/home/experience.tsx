import { FilterChip } from '@components';
import { getExperience, getLangFromUrl } from '@utils';
import { experience } from '@utils/constants';
import { useTranslation } from '@utils/i18n/react';
import { Suspense, useMemo, useState } from 'react';

import Timeline from './timeline';

const experienceTypes = ['job', 'education'] as const;
type ExperienceType = (typeof experienceTypes)[number];

const _Experience = () => {
  const { t } = useTranslation(getLangFromUrl(), 'home');
  const [experienceType, setExperienceType] = useState<
    ExperienceType | undefined
  >();
  const items = useMemo(
    () => getExperience(experience, experienceType),
    [experienceType, experience]
  );

  const handleClick = (type: ExperienceType): void => {
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
        {experienceTypes.map((type) => (
          <FilterChip
            key={type}
            selected={experienceType === type}
            onClick={() => handleClick(type)}
          >
            {t(`experience-type-${type}`)}
          </FilterChip>
        ))}
      </div>
    </>
  );
};

export default function Experience() {
  return (
    <Suspense fallback="loading...">
      <_Experience />
    </Suspense>
  );
}
