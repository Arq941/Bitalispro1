import Decimal from 'decimal.js';

export type PaymentFrequency = 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';

export class PaymentCalendarService {
  static minimumFor(frequency: PaymentFrequency) {
    if (frequency === 'MONTHLY') return new Decimal(400);
    if (frequency === 'BIWEEKLY') return new Decimal(200);
    return new Decimal(100);
  }

  static buildWholeAmounts(params: {
    balance: Decimal.Value;
    requestedInstallments: number;
    frequency: PaymentFrequency;
  }) {
    const balance = new Decimal(params.balance).toDecimalPlaces(2);
    if (balance.lte(0)) return { regularAmount: new Decimal(0), amounts: [] as Decimal[] };

    const requested = Math.max(1, Math.floor(params.requestedInstallments || 1));
    const average = balance.div(requested);
    const roundedHundred = average.div(100).round().mul(100);
    const regularAmount = Decimal.max(
      this.minimumFor(params.frequency),
      roundedHundred,
    );
    const count = Math.max(1, balance.div(regularAmount).ceil().toNumber());
    const amounts: Decimal[] = [];
    let remaining = balance;
    for (let index = 0; index < count; index++) {
      const amount = Decimal.min(regularAmount, remaining).toDecimalPlaces(2);
      amounts.push(amount);
      remaining = remaining.minus(amount);
    }
    return { regularAmount: Decimal.min(regularAmount, balance), amounts };
  }
}
