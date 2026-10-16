# @krak-stack/auth

## 0.2.21

### Patch Changes

- Reload the current page after impersonation instead of navigating to `/` or refreshing the previous user's mounted guards. This clears stale router and organization query state when switching identities while preserving the current URL.

  Update the SDK's KrakStack registry development dependency and minimum peer requirement to `0.1.44`.
