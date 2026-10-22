# Contributing

Use Node.js 22+ and `npm ci --ignore-scripts`. Run `npm run check`, the installed-extension browser
suite, and `npm run package` before proposing a change. Keep the lockfile updated. CI runs with
read-only repository permissions and needs no application secrets.

Keep features focused on accidental identity disclosure. New permissions, runtime dependencies,
fingerprint formats and storage migrations need a clear rationale. Matching changes need measured
false-positive/negative results on documented data. Do not replace test failures with weaker checks.

Use small, descriptive changes and plain documentation. UI changes should include real screenshots
in Light, Dark, AMOLED and narrow layouts. Check keyboard focus, reduced motion, contrast and
invalid/empty states. Do not include real personal identities or photos in issues or screenshots.
