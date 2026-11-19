/**
 * The app owner's Google account. Only hides or shows owner tools in the UI;
 * the Worker independently verifies the Google token before any owner action.
 */
export const OWNER_EMAIL = 'louieddxu2@gmail.com';

export const isOwnerEmail = (email: string | null | undefined): boolean =>
  !!email && email.trim().toLowerCase() === OWNER_EMAIL;
