## Version 0.1.1

- fix: 0.1.0 shipped the kit's devDependencies in its `npm-shrinkwrap.json`, so a consumer `npm ci` under npm 10 (the Cloud Functions buildpack) fails with `EBADPLATFORM` on the `@esbuild/*` platform binaries. 0.1.1 ships the pruned shrinkwrap. Do not use 0.1.0.
- Initial release of kit, see README for differences between the legacy extension and this kit
