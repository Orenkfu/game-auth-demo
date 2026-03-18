import { HttpException, HttpStatus } from '@nestjs/common';
import {
  ERROR_LINK_REQUIRED_CODE,
  ERROR_LINK_REQUIRED_MESSAGE,
  ERROR_EMAIL_MASKED_PLACEHOLDER,
  ERROR_DOMAIN_MASKED_PLACEHOLDER,
} from '../../../shared/constants';

/**
 * Thrown when OAuth login finds a verified email that matches
 * an existing identity, but the provider isn't linked yet.
 */
export class LinkRequiredException extends HttpException {
  constructor(
    public readonly provider: string,
    public readonly email: string,
  ) {
    super(
      {
        statusCode: HttpStatus.CONFLICT,
        error: ERROR_LINK_REQUIRED_CODE,
        message: ERROR_LINK_REQUIRED_MESSAGE,
        provider,
        email: maskEmail(email),
      },
      HttpStatus.CONFLICT,
    );
  }
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return ERROR_EMAIL_MASKED_PLACEHOLDER;

  const [domainName, ...tld] = domain.split('.');
  const maskedLocal = local[0] + ERROR_EMAIL_MASKED_PLACEHOLDER;
  const maskedDomain = domainName[0] + ERROR_DOMAIN_MASKED_PLACEHOLDER;

  return `${maskedLocal}@${maskedDomain}.${tld.join('.')}`;
}
