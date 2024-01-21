interface IProps {
  name: string;
  description: string;
  from: Date;
  to?: Date;
  preview: {
    src: string;
    alt: string;
  };
  active?: boolean;
}

const ProjectCard = ({
  name,
  description,
  preview,
  from,
  to,
  active = false,
}: IProps) => {
  return (
    <div className="z-0 size-full relative">
      {active && (
        <div className="flex flex-col w-1/2 h-4/5 justify-between font-pretty z-10 absolute -translate-x-2/3 top-1/2 -translate-y-1/2">
          <h1 className="text-7xl">{name}</h1>
          <div className="text-lg flex flex-col gap-4 pl-1">
            <p>{description}</p>
            <i>
              {from.toLocaleDateString()}~{to?.toLocaleDateString()}
            </i>
          </div>
        </div>
      )}
      <div
        className="
        relative size-full shrink-0 rounded-t-full z-0
        after:content-[''] after:w-[95%] after:h-full 
        after:border-2 after:border-on-surface/60 after:rounded-[inherit]
        after:-translate-x-6 after:translate-y-6 after:top-0 after:absolute after:-z-10"
      >
        <img
          {...preview}
          className="object-cover size-full rounded-[inherit]"
        />
      </div>
      {active && (
        <div className="size-60 rounded-full bg-gradient-to-br from-secondary to-primary blur-3xl absolute -right-20 -bottom-20 -z-10 animate-spin"></div>
      )}
    </div>
  );
};

export default ProjectCard;
