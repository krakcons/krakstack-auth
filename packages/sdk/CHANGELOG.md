# @krak-stack/auth

## 0.2.22

### Patch Changes

- Update the KrakStack registry development dependency and minimum peer requirement to `0.1.48` for corrected image previews, full-width image inputs, file metadata, and non-overlapping replace/delete actions. Use compact, consistently sized icon and logo previews in account and organization forms without changing suggested upload resolutions.

## 0.2.21

### Patch Changes

- Reload the current page after impersonation instead of navigating to `/` or refreshing the previous user's mounted guards. This clears stale router and organization query state when switching identities while preserving the current URL.

  Update the SDK's KrakStack registry development dependency and minimum peer requirement to `0.1.44`.
