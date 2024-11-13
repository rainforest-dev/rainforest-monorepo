import { Icon } from '@iconify-icon/react';
import { ITimelineProps } from '@types';
import { getBrandIconName, getLangFromUrl, getTopTechnologies } from '@utils';
import { resumeDateFormat } from '@utils/constants';
import { useTranslation } from '@utils/i18n/react';
import { format } from 'date-fns';

export default function Timeline({ experience = [] }: ITimelineProps) {
  const { t } = useTranslation(getLangFromUrl(location.href), 'home');
  const renderDescription = (
    description: ITimelineProps['experience'][number]['description']
  ) => {
    if (Array.isArray(description)) {
      return (
        <ul className="list-disc list-inside text-xs sm:text-base">
          {description.map((desc) => (
            <li key={desc}>{t(desc)}</li>
          ))}
        </ul>
      );
    }
    return description ? <p>{t(description)}</p> : <></>;
  };

  return (
    <ul className="flex flex-col gap-4 sm:gap-5 relative">
      <div className="absolute w-0.5 h-full bg-on-surface left-0 -translate-x-1/2 sm:left-1/2" />
      {experience.map((item) => {
        const technologies = getTopTechnologies(item);
        return (
          <li
            key={`${item.organization}_${item.position}`}
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
              <h3 className="sm:text-2xl">{t(item.organization.name)}</h3>
              <p className="text-sm sm:text-lg text-primary/85">
                {t(item.position)}
              </p>
              {renderDescription(item.description)}
              {
                <ul>
                  {(item.projects ?? []).reverse().map((project) => (
                    <li key={project.name}>
                      <h4 className="text-sm mb-0.5 mt-2 sm:text-lg sm:mb-1.5 sm:mt-3">
                        {t(project.name)}
                      </h4>
                      {renderDescription(project.description)}
                    </li>
                  ))}
                </ul>
              }
              <div className="inline-flex gap-2 mt-4">
                {technologies.map((tag) => {
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
        );
      })}
    </ul>
  );
}
