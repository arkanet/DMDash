<!--
Thanks for contributing to DMDash.
Use this template to highlight dashboard impact, compatibility notes, and verification clearly for reviewers.
-->

## Summary

<!--
Describe what this PR changes and why it matters for DMDash.
-->

## Related Issues

<!--
Use GitHub keywords when applicable, for example "Fixes #123" or "Relates to #456".
-->

## What Changed

<!--
Call out the most important implementation details or UX changes.
-->

-
-
-

## Compatibility Notes

<!--
Mention any impact on:
- official Meshtastic protobuf compatibility
- DarkMesh Android or firmware parity
- upstream sync policy or compatibility docs
-->

## Verification

<!--
List the commands, scenarios, or manual checks you ran.
-->

## Screenshots or Recordings

<!--
If the PR changes the dashboard UI or operator flow, add before/after captures here.
-->

## Checklist

- [ ] Code follows project style guidelines
- [ ] `pnpm check` passes locally
- [ ] `pnpm --filter meshtastic-web typecheck` passes locally
- [ ] `pnpm test --run` passes locally
- [ ] `pnpm --filter meshtastic-web build` passes locally
- [ ] Documentation was updated if behavior, workflows, or contributor expectations changed
- [ ] I documented any compatibility implications for Meshtastic protobufs or DarkMesh feature parity
