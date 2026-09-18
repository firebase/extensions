- fix: set `serve` concurrency to `1`, matching the extension, which ran on Gen1 and served one request per instance. Previously, the kit inherited the Gen2 default of `80`. Ingress stays `ALLOW_ALL`, because `serve` is a public endpoint. Existing kit deployments adopt the limit on their next deploy.

- Initial release of kit, see README for differences between the legacy extension and this kit
