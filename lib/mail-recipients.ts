// Who gets which email from this app.
//
//  - Normal emails (store closed, store resumed, weekly summary) go to BOTH AurixLab and
//    Merch Express.
//  - Error emails (for example "store NOT closed") go to AurixLab ONLY.
//
// To add or change a recipient, edit the two lists below; every email reads from here.

export const AURIXLAB_EMAIL = "aurixlab@gmail.com";
export const MERCH_EXPRESS_EMAIL = "sales@merchexpresscanada.ca";

/** Everything except errors. */
export const NORMAL_MAIL_TO: string[] = [AURIXLAB_EMAIL, MERCH_EXPRESS_EMAIL];

/** Error emails only. */
export const ERROR_MAIL_TO: string[] = [AURIXLAB_EMAIL];
