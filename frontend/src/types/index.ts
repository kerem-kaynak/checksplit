export type Currency = "EUR" | "USD" | "TRY";

export interface Item {
  id: string;
  name: string;
  quantity: number;
  unit_price: string;
  total_price: string;
  claims: Record<string, string[]>; // {"0": ["Alice"], "1": ["Bob", "Charlie"]}
}

export interface Check {
  id: string;
  code: string;
  title: string | null;
  description: string | null;
  currency: Currency;
  tip_amount: string;
  created_at: string;
  items: Item[];
}

export interface ItemCreate {
  name: string;
  quantity: number;
  unit_price?: string;
  total_price?: string;
}

export interface CheckCreate {
  title?: string;
  description?: string;
  currency: Currency;
  tip_amount: string;
  items: ItemCreate[];
}

export interface CheckUpdate {
  currency?: Currency;
  tip_amount?: string;
  items?: ItemCreate[];
}

export interface ClaimRequest {
  participant_name: string;
  item_id: string;
  sub_item_index: number;
}

export interface ParticipantSummary {
  name: string;
  items_subtotal: string;
  tip_share: string;
  total: string;
}

export interface CheckSummary {
  check: Check;
  participants: ParticipantSummary[];
  unclaimed_total: string;
}

export interface OCRItem {
  name: string;
  quantity: number;
  unit_price: string;
}

export interface OCRResponse {
  items: OCRItem[];
}
