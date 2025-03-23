'use client';

import useSWR from 'swr';

import { useLiff } from './LiffProvider';

export default function Profile() {
  const { liff } = useLiff();
  const { data } = useSWR(
    [liff?.isLoggedIn()],
    async () => await liff?.getProfile(),
  );

  return <div>{data?.displayName}</div>;
}
