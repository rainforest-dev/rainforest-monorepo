import type { Liff } from '@line/liff';
import type { NextPage } from 'next';

import { useLineProfile } from '@/hooks';

const Index: NextPage<{ liff: Liff | null; liffError: string | null }> = ({
  liff,
  liffError,
}) => {
  const { profile, isLoading } = useLineProfile();

  console.log(profile, isLoading);

  return (
    <>
      <h1>create-liff-app</h1>
      {profile && (
        <>
          <p>{profile.displayName}</p>
          <img src={profile.pictureUrl} alt={profile.displayName} />
        </>
      )}
      {liff && <p>LIFF init succeeded.</p>}
      {liffError && (
        <>
          <p>LIFF init failed.</p>
          <p>
            <code>{liffError}</code>
          </p>
        </>
      )}
      <a
        href="https://developers.line.biz/ja/docs/liff/"
        target="_blank"
        rel="noreferrer"
      >
        LIFF Documentation
      </a>
    </>
  );
};

export default Index;
