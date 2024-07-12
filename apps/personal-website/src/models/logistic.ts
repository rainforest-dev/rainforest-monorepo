import { parse } from 'date-fns';
import type { IPostResponse } from '../services';
import { orderBy } from 'lodash-es';

interface ILogistic {
  trackingNumber: string;
  carrier: 'post' | 't-cat';
  events: {
    name: string;
    timestamp: Date;
    from: {
      id: string;
      name: string;
    };
    to?: {
      id: string;
      name: string;
    };
  }[];
}

export class Logistic implements ILogistic {
  trackingNumber: string;
  carrier: 'post' | 't-cat';
  events: {
    name: string;
    timestamp: Date;
    from: {
      id: string;
      name: string;
    };
    to?: {
      id: string;
      name: string;
    };
  }[];

  constructor(data: ILogistic) {
    this.trackingNumber = data.trackingNumber;
    this.carrier = data.carrier;
    this.events = orderBy(data.events, 'timestamp', ['desc']);
  }

  toJSON(): ILogistic {
    return this;
  }

  static fromPost = async (
    raw: Exclude<IPostResponse['body']['host_rs'], undefined>,
  ) => {
    return new Logistic({
      trackingNumber: raw.MAILNO,
      carrier: 'post',
      events: raw.ITEM.map((item) => {
        const from = {
          id: item.BRHNO,
          name: item.BRHNC,
        };
        const to =
          item['REVBRN-Z'] && item['REVBRC-Z']
            ? {
                id: item['REVBRN-Z'],
                name: item['REVBRC-Z'],
              }
            : undefined;
        return {
          name: item.STATUS,
          timestamp: parse(item.DATIME, 'yyyyMMddHHmmss', new Date()),
          from,
          to,
        };
      }),
    });
  };
}
