import { useEffect, useMemo, useRef, useState } from 'react';

export default function InfiniteScroll() {
  const root = useRef<HTMLDivElement | null>(null);
  const target = useRef<HTMLDivElement | null>(null);
  const [page, setPage] = useState(1);
  const posts = useMemo(
    () => Array.from({ length: page * 10 }, (_, i) => i + 1),
    [page],
  );
  const loadMorePosts = () => {
    setTimeout(() => {
      setPage((prev) => prev + 1);
    }, 1000);
  };

  useEffect(() => {
    if (!root.current || !target.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        console.log(entries);
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            loadMorePosts();
          }
        });
      },
      { root: root.current, threshold: 1 },
    );
    observer.observe(target.current);
    return () => {
      observer.disconnect();
    };
  }, [root.current, target.current]);

  return (
    <div>
      <h1>Infinite Scroll</h1>
      <div ref={root} className="flex h-80 flex-col overflow-y-auto">
        {posts.map((post) => (
          <div
            key={post}
            className="flex-center odd:bg-surface-container-high even:bg-surface-container-low h-1/4 shrink-0 border"
          >
            {post}
          </div>
        ))}
        <div ref={target} className="flex-center size-full shrink-0 border">
          Loading...
        </div>
      </div>
    </div>
  );
}
