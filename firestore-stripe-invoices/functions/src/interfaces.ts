export interface InvoicePayload {
  email?: string;
  uid?: string;
  items: [OrderItem];
  daysUntilDue?: number;
}

export interface OrderItem {
  amount: number;
  currency: string;
  description: string;
}
