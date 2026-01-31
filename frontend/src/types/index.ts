export type Currency = string;

export const CURRENCY_SYMBOLS: Record<string, string> = {
  EUR: "€",
  USD: "$",
  TRY: "₺",
  GBP: "£",
  JPY: "¥",
  CNY: "¥",
  CHF: "CHF",
  CAD: "C$",
  AUD: "A$",
  INR: "₹",
  KRW: "₩",
  BRL: "R$",
  MXN: "$",
  SEK: "kr",
  NOK: "kr",
  DKK: "kr",
  PLN: "zł",
  CZK: "Kč",
  HUF: "Ft",
  RUB: "₽",
  THB: "฿",
  SGD: "S$",
  HKD: "HK$",
  NZD: "NZ$",
  ZAR: "R",
  ILS: "₪",
  AED: "د.إ",
  SAR: "﷼",
  PHP: "₱",
  MYR: "RM",
  IDR: "Rp",
  VND: "₫",
  EGP: "E£",
  NGN: "₦",
  PKR: "₨",
  BDT: "৳",
  UAH: "₴",
  RON: "lei",
  BGN: "лв",
  HRK: "kn",
  ISK: "kr",
};

export function getCurrencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency] || currency;
}

export interface BankAccount {
  account_holder: string;
  iban: string;
}

export interface PayPalMethod {
  url: string;
}

export interface OtherMethod {
  text: string;
}

export interface PaymentMethods {
  bank?: BankAccount;
  paypal?: PayPalMethod;
  other?: OtherMethod;
}

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
  payment_methods: PaymentMethods | null;
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
  payment_methods: PaymentMethods;
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
  currency: string | null;
}

export interface ExchangeRateResponse {
  from: string;
  to: string;
  rate: string;
}
