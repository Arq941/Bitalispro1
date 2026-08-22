export const configuration = () => ({
  environment: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  database: {
    url: process.env.DATABASE_URL,
    directUrl: process.env.DIRECT_URL,
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  },
  financial: {
    companyContributionRatio: parseFloat(process.env.FINANCIAL_COMPANY_CONTRIBUTION_RATIO || '1'),
    earlySettlementDiscount: parseFloat(process.env.EARLY_SETTLEMENT_DISCOUNT || '0.10'),
    minPayments: {
      weekly: parseFloat(process.env.WEEKLY_MIN_PAYMENT || '100'),
      biweekly: parseFloat(process.env.BIWEEKLY_MIN_PAYMENT || '200'),
      monthly: parseFloat(process.env.MONTHLY_MIN_PAYMENT || '400'),
    },
  },
});
