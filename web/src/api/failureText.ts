import { ApiRequestError, type ErrorCode } from './client.ts';

const textByCode: Record<ErrorCode, string> = {
  validation_failed: 'The server did not accept these values. Check the fields and try again.',
  not_a_slot: 'This time cannot be booked. Choose another one.',
  booking_not_found: 'This booking does not exist.',
  event_type_not_found: 'This event type does not exist.',
  slot_taken: 'Someone else has just booked this time. Choose another one.',
};

const generalText = 'Something went wrong. Try again.';

/**
 * The text to show for a failed request. It is chosen from `ApiError.code` and
 * never from `message`, whose wording is for developers and may change.
 */
export function failureText(error: unknown): string {
  if (error instanceof ApiRequestError && error.code !== undefined) {
    return textByCode[error.code] ?? generalText;
  }
  return generalText;
}
