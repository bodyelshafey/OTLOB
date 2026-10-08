import { registerDecorator, ValidationOptions } from 'class-validator';

// Restricts a client-supplied "link" field (ads, banners, offers, ...) to
// either an absolute http(s) URL or a relative in-app path. Rejects
// `javascript:`, `data:`, `vbscript:`, and any other scheme — those are
// only useful for a self-XSS-via-stored-content attack (a malicious or
// compromised merchant/admin account planting a link that executes when a
// customer clicks the ad/banner it's attached to).
export function IsSafeLink(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isSafeLink',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (value === undefined || value === null || value === '') return true;
          if (typeof value !== 'string') return false;
          if (value.startsWith('/')) return true; // relative in-app route
          return /^https:\/\/|^http:\/\//i.test(value);
        },
        defaultMessage() {
          return 'link must be an absolute http(s) URL or a relative path starting with /';
        },
      },
    });
  };
}
