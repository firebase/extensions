If your trigger path is `example/path/` and you write URLs to the database path at:
`example/path/{urlID}/original` via one of the official Firebase SDKs (https://firebase.google.com/docs/database/), the shortened URL will be written to:
`example/path/{urlID}/short`.

## Sample Realtime Database Structure

Here is an example of the database structure with a sample trigger path of `example/path`.
```
/your-project-id-123
    /example/path
        /url-123456
            original: "https://my.super.long-link.com/api/user/profile/-jEHitne10395-k3593085"
```

When a new URL (string) is pushed to `/example/path`, it gets replaced with an object containing the original URL and a shortened one.
This way, you can display a clean URL by fetching `/example/path/{urlID}/short`.

```
/your-project-id-123
    /example/path
        /url-123456
            original: "https://my.super.long-link.com/api/user/profile/-jEHitne10395-k3593085",
            short: "https://bit.ly/EKDdza"
```
