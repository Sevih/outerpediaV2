// Single source of truth for the one-click redeem feature flag.
//
// The feature is fully built and working, but kept OFF until VA Games /
// GM Ame approve the third-party relay. While disabled:
//   - the /coupons page renders no redeem UI
//   - the /api/redeem route rejects all requests with 403
//
// Flip to `true` to enable everything once we have the green light.
export const REDEEM_ENABLED = false;
