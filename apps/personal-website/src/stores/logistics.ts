import { persistentMap } from '@nanostores/persistent';
import { map } from 'nanostores';

export interface ILogistic {
  trackingNumber: string;
  carrier: 'post' | 't-cat';
}

export const logistics = persistentMap<Record<string, ILogistic>>(
  'logistics',
  {},
  {
    encode: JSON.stringify,
    decode: JSON.parse,
  },
);

export function addLogistic(
  trackingNumber: string,
  carrier: ILogistic['carrier'],
) {
  if (logistics.get()[trackingNumber])
    throw new Error('Tracking number already exists');
  logistics.setKey(trackingNumber, { trackingNumber, carrier });
}
