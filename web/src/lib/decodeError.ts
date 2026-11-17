/** Turn contract reason codes and common error names into plain language (中英白话错误提示). */
const blockReasons: Record<number, { zh: string; en: string }> = {
  1: { zh: "这把 AI 授权钥匙没有注册，无法付款。", en: "This AI key is not registered, so it cannot pay." },
  2: { zh: "AI 的授权已过期，请续期后再试。", en: "The AI's authorization expired. Renew it before retrying." },
  3: { zh: "这把 AI 授权钥匙已被撤销。", en: "This AI key has been revoked." },
  4: { zh: "收款人不在白名单里。", en: "The recipient is not on the allowlist." },
  5: { zh: "这笔付款超过单笔上限，已被拦截。", en: "This payment exceeds the per-transaction cap and was blocked." },
  6: { zh: "今日累计付款已达上限，明天或调整额度后再试。", en: "Today's spending cap is reached. Wait for the daily reset or raise the cap." },
  7: { zh: "AI 资金池余额不足。", en: "The agent's vault balance is too low." },
  8: { zh: "金额不能为零。", en: "The amount cannot be zero." },
  9: { zh: "签名时间窗口已失效，请重新发起。", en: "The signature window expired. Please try again." },
  10: { zh: "合约已被紧急暂停。", en: "The contract is paused for emergency response." },
  11: { zh: "商户报价签名无效，请重新获取报价。", en: "The merchant quote signature is invalid. Request a new quote." },
};

const errorNames: Record<string, { zh: string; en: string }> = {
  NotOwner: { zh: "只有资金池主人可以执行这个操作。", en: "Only the vault owner can do this." },
  NotAdmin: { zh: "只有管理员可以执行这个操作。", en: "Only the admin can do this." },
  InvalidBounds: { zh: "额度不合法：单笔上限不能大于每日上限，到期时间必须在未来。", en: "Invalid limits: the per-tx cap cannot exceed the daily cap, and expiry must be in the future." },
  ZeroAmount: { zh: "金额不能为零。", en: "The amount cannot be zero." },
  AlreadyProcessed: { zh: "这笔付款已经处理过了。", en: "This payment was already processed." },
  InvalidSignature: { zh: "签名无效。", en: "The signature is invalid." },
  NotPending: { zh: "这笔付款不在等待审批状态。", en: "This payment is not awaiting approval." },
  UserRejectedRequest: { zh: "你在钱包里取消了操作。", en: "You cancelled the action in your wallet." },
  InsufficientFunds: { zh: "钱包余额不足以支付 gas。", en: "Your wallet does not have enough gas." },
};

export function explainError(error: unknown, lang: "zh" | "en" = "zh"): string {
  const text = error instanceof Error ? error.message : String(error);
  for (const [key, value] of Object.entries(errorNames)) {
    if (text.includes(key)) return value[lang];
  }
  if (/execution reverted/i.test(text)) {
    return lang === "zh" ? "交易被合约拒绝，请检查额度、到期时间和白名单。" : "The contract rejected the transaction. Check caps, expiry and allowlist.";
  }
  return text.length > 220 ? `${text.slice(0, 220)}…` : text;
}

export function explainBlockReason(reason: number | bigint | undefined, lang: "zh" | "en" = "zh"): string {
  if (reason === undefined) return lang === "zh" ? "正常" : "OK";
  return blockReasons[Number(reason)]?.[lang] ?? `reason ${reason}`;
}
