import { Capacitor } from '@capacitor/core';

interface Props {
  adUnitId?: string;
  size?: 'banner' | 'rectangle';
}

export const InlineAdSlot = ({ size = 'banner' }: Props) => {
  if (!Capacitor.isNativePlatform()) return null;
  const height = size === 'rectangle' ? 250 : 60;
  return <div style={{ height, width: '100%', backgroundColor: 'transparent' }} aria-hidden="true" />;
};
