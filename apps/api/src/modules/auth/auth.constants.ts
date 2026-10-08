// DI token for the injected SmsProvider implementation (see
// providers/sms.provider.ts and the factory in auth.module.ts). A plain
// string/Symbol token because SmsProvider is an interface, not a class —
// Nest can't use an interface as an injection token.
export const SMS_PROVIDER = 'SMS_PROVIDER';
