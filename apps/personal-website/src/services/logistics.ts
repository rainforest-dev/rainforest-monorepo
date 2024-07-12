import { Logistic } from '../models';

export interface IPostResponse {
  header: {
    OutputType: 'Screen' | 'EndBracket';
  };
  body: {
    host_rs?: {
      MAILNO: string;
      MAILTYPE: string;
      ITEM: {
        STATUS: string;
        BRHNC: string;
        BRHNO: string;
        'REVBRC-Z'?: string;
        'REVBRN-Z'?: string;
        DATIME: string;
      }[];
    };
  };
}

export const fetchLogisticFromPost = async (trackingNumber: string) => {
  const response = await fetch(
    'https://postserv.post.gov.tw/pstmail/EsoafDispatcher',
    {
      method: 'POST',
      body: JSON.stringify({
        body: {
          MAILNO: trackingNumber,
          pageCount: 10,
        },
        header: {
          InputVOClass: 'com.systex.jbranch.app.server.post.vo.EB500100InputVO',
          TxnCode: 'EB500100',
          BizCode: 'query2',
          StampTime: true,
          SupvPwd: '',
          TXN_DATA: {},
          SupvID: '',
          CustID: '',
          REQUEST_ID: '',
          ClientTransaction: true,
          DevMode: false,
          SectionID: 'esoaf',
        },
      }),
    },
  );

  const result: IPostResponse[] = await response.json();
  const data = result.find((r) => r.header.OutputType === 'Screen')?.body
    ?.host_rs;
  if (data) {
    return Logistic.fromPost(data);
  }
  throw new Error('No data found');
};
