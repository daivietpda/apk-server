# APK Server

Remote removable-preinstall source for Android ROMs.

## Published URLs

- Manifest: `https://daivietpda.github.io/apk-server/manifest.json`
- APKs: `https://daivietpda.github.io/apk-server/apk/<filename>.apk`
- DEX helper: `https://daivietpda.github.io/apk-server/remote-preinstall.jar`

## Update locally

Regenerate hashes and manifest:

```bat
manifest.bat
```

Enable enforced reinstall for one APK:

```bat
manifest.bat --set-apk downloader.apk --package-name com.esaba.downloader --force-install true
```

Disable it:

```bat
manifest.bat --set-apk downloader.apk --force-install false
```

Commit and push the resulting `manifest.json` and `manifest-policy.json`.

## Update from GitHub Actions

Open **Actions > Build manifest and publish APK server > Run workflow**.

- `apk_file`: exact filename under `apk/`.
- `package_name`: Android application ID.
- `force_install`: `true`, `false`, or `unchanged`.

The workflow regenerates SHA-256 values, builds `RemoteFetch.java` as a DEX jar,
commits generated policy/manifest changes, and deploys the site to GitHub Pages.
