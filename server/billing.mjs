// Token counters and the CLI's placeholder cost are not an account bill.
// Only a separately verified billing API may supply credit amounts.
export function withBilling(result) {
  const clientAccount = ['local-codebuddy', 'workbuddy-localassistant'].includes(result.provider);
  return {...result, billing: {
    status: 'unavailable', source: 'not_reported',
    creditsConsumed: null, remainingCredits: null,
    account: clientAccount ? 'client' : 'provider',
    note: clientAccount
      ? '当前通道未返回积分扣费或余额；以客户端账户账单为准。'
      : '当前接口未提供账单金额；以模型服务商账单为准。'
  }};
}
