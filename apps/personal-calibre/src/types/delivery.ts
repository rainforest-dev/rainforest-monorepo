export interface DeliveryPlatform {
  id: number;
  key: string;
  name: string;
}

export interface BookDeliveryEvent {
  id: number;
  bookId: number;
  platformKey: string;
  platformName: string;
  addedAt: string;
  note: string | null;
  externalRef: string | null;
}

export interface CreateDeliveryEventInput {
  platformKey: string;
  note?: string;
  externalRef?: string;
}
