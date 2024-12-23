import liff from '@line/liff';
import useSWRImmutable from 'swr/immutable';

export const useLineProfile = (): {
  profile: Awaited<ReturnType<typeof liff.getProfile>> | undefined;
  isLoading: boolean;
} => {
  const { data: profile, isLoading } = useSWRImmutable('liff/profile', () =>
    liff.getProfile()
  );

  return { profile, isLoading };
};
