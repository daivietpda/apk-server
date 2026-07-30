# APK Server

Nguồn GitHub Pages dùng để cài đặt, cập nhật, bắt buộc duy trì hoặc gỡ từ xa các ứng dụng Android dạng data app có thể gỡ.

Tài liệu tiếng Anh: [README.md](README.md).

## URL công khai

- Manifest tương thích cũ: `https://daivietpda.github.io/apk-server/manifest.json`
- Manifest ưu tiên: `https://apk.daivietpda.com/manifest.json`
- APK/Split ZIP tương thích cũ: `https://daivietpda.github.io/apk-server/apk/<tên-file>`
- APK/Split ZIP ưu tiên: `https://apk.daivietpda.com/apk/<tên-file>`
- DEX helper tải HTTPS: `https://daivietpda.github.io/apk-server/remote-preinstall.jar`

## Định dạng payload

### APK đơn

Đặt file `.apk` trực tiếp trong `apk/`. GitHub Actions dùng `aapt2` đọc `packageName` và `versionCode` thực tế từ APK.

### Split APK dạng ZIP

Đặt file `.zip` trong `apk/`. ZIP phải có cấu trúc phẳng, chỉ chứa file `.apk` viết thường và bắt buộc có `base.apk`:

```text
ExampleTV.zip
├── base.apk
├── split_config.arm64_v8a.apk
├── split_config.vi.apk
└── split_config.xhdpi.apk
```

Workflow từ chối thư mục con, file không phải APK, trên 64 APK, dung lượng giải nén trên 1 GiB hoặc các split không cùng package/version. Android giải nén bằng `unzip` rồi cài toàn bộ split qua PackageInstaller session: `install-create`, `install-write`, `install-commit`.

## Hành vi manifest

Mỗi entry được sinh từ metadata thật, SHA-256 và kích thước payload:

```json
{
  "name": "ExampleTV",
  "packageName": "com.example.tv",
  "versionCode": 120,
  "format": "splitZip",
  "forceInstall": false,
  "url": "https://daivietpda.github.io/apk-server/apk/ExampleTV.zip",
  "urls": [
    "https://apk.daivietpda.com/apk/ExampleTV.zip",
    "https://daivietpda.github.io/apk-server/apk/ExampleTV.zip"
  ],
  "sha256": "...",
  "size": 12345678
}
```

Thiết kế giữ tương thích ngược: ROM cũ tiếp tục đọc trường `url` không đổi và tải từ GitHub Pages. ROM mới thử lần lượt các địa chỉ trong `urls`; nếu không có mảng này thì dùng `url`. Không xóa hoặc đổi ý nghĩa `url` khi còn thiết bị dùng client cũ.

Hostname Cloudflare phải cung cấp cùng manifest và cùng đường dẫn object `/apk/`. APK/ZIP lớn nên đặt trong Cloudflare R2 sau custom domain; không dùng `r2.dev` làm endpoint production.

Khi boot hoặc khi PreinstallManager yêu cầu chạy thủ công, ROM sẽ:

- cài package chưa từng được quản lý;
- chỉ cập nhật khi `versionCode` trên server cao hơn;
- không downgrade;
- tôn trọng package người dùng đã gỡ nếu `forceInstall=false`;
- cài lại package bị thiếu nếu `forceInstall=true`;
- kiểm tra SHA-256 và phiên bản sau khi cài.

Bản cập nhật phải giữ cùng `packageName`, cùng signing certificate và tăng `versionCode`.

## Chính sách forceInstall

Policy được lưu lâu dài trong `manifest-policy.json`. Bật bắt buộc cài lại:

```bat
manifest.bat --aapt2 C:\Android-SDK\build-tools\35.0.1\aapt2.exe --set-apk downloader.apk --package-name com.esaba.downloader --force-install true
```

Tắt chính sách:

```bat
manifest.bat --aapt2 C:\Android-SDK\build-tools\35.0.1\aapt2.exe --set-apk downloader.apk --force-install false
```

`packageName` phải khớp application ID thật bên trong APK/ZIP.

## Chính sách gỡ ứng dụng từ xa

Quy tắc gỡ được lưu trong `uninstall-policy.json` và xuất hiện dưới `uninstallPackages` của manifest v2:

```json
{
  "action": "uninstall",
  "packageName": "com.example.oldapp",
  "enforce": true,
  "keepData": false,
  "userId": 0
}
```

Thêm quy tắc gỡ một lần khi manifest thay đổi:

```bat
manifest.bat --aapt2 C:\Android-SDK\build-tools\35.0.1\aapt2.exe --uninstall-package com.example.oldapp --uninstall-action once --uninstall-user-id 0
```

Luôn bảo đảm package bị gỡ và giữ dữ liệu:

```bat
manifest.bat --aapt2 C:\Android-SDK\build-tools\35.0.1\aapt2.exe --uninstall-package com.example.oldapp --uninstall-action enforce --uninstall-keep-data true --uninstall-user-id 0
```

Xóa quy tắc khỏi policy:

```bat
manifest.bat --aapt2 C:\Android-SDK\build-tools\35.0.1\aapt2.exe --uninstall-package com.example.oldapp --uninstall-action remove
```

ROM dùng `pm uninstall [ -k ] --user <id>`. Với system app, thao tác chỉ gỡ package cho Android user tương ứng; APK read-only vẫn nằm trong image. Một package không được đồng thời xuất hiện trong `packages` và `uninstallPackages`: phải xóa APK/ZIP khỏi `apk/` trước khi thêm quy tắc gỡ.

Theo yêu cầu thiết kế, `factoryreset.conf` không có allowlist package được gỡ. Cần bảo vệ quyền ghi repository và tài khoản GitHub Actions. Manifest hiện dựa vào HTTPS; payload được kiểm tra thêm SHA-256 nhưng manifest chưa được ký bằng khóa offline.

## Chạy cục bộ

`aapt2` phải có trong `PATH` hoặc truyền đường dẫn đầy đủ:

```bat
manifest.bat --aapt2 C:\Android-SDK\build-tools\35.0.1\aapt2.exe
```

Commit các file được sinh/cập nhật:

```text
manifest.json
manifest-policy.json
uninstall-policy.json
```

## Chạy bằng GitHub Actions

Mở **Actions → Build manifest and publish APK server → Run workflow**.

Nhóm cài đặt:

- `apk_file`: tên chính xác của `.apk` hoặc `.zip` trong `apk/`.
- `package_name`: application ID, bắt buộc khi bật `force_install`.
- `force_install`: `true`, `false` hoặc `unchanged`.

Nhóm gỡ ứng dụng:

- `uninstall_package`: package cần gỡ.
- `uninstall_action`: `once`, `enforce`, `remove` hoặc `unchanged`.
- `uninstall_keep_data`: giữ dữ liệu bằng tùy chọn `-k`.
- `uninstall_user_id`: Android user, thông thường là `0` trên Android TV.

Khi push thông thường, input rỗng mặc định thành `unchanged`. Workflow kiểm tra toàn bộ APK/Split ZIP, tạo lại policy/manifest, build `RemoteFetch.java` thành DEX jar, commit file sinh tự động và deploy GitHub Pages.

## Cấu trúc server

```text
apk/                       APK và Split ZIP
scripts/update_manifest.py Công cụ tạo manifest/policy
tools/RemoteFetch.java     Helper Android tải HTTPS có giới hạn host
manifest-policy.json       Chính sách forceInstall
uninstall-policy.json      Chính sách gỡ package
manifest.json              Manifest công khai được sinh tự động
```

## Mirror Cloudflare R2

Hai domain được tách vai trò có chủ ý:

- `https://daivietpda.github.io/apk-server/` là nguồn chuẩn dành cho ROM cũ. GitHub Pages không được cấu hình custom domain và repo không được có file `CNAME`.
- `https://apk.daivietpda.com/` do `cloudflare/worker.mjs` phục vụ. Worker đọc cùng cây đường dẫn từ bucket R2 private có tên `apk-server`.

Cách tách này ngăn GitHub Pages redirect ROM cũ sang hostname nằm ngoài HTTPS allowlist của bản `RemoteFetch` cũ. Manifest vẫn giữ `url` cũ trên GitHub và thêm mảng `urls` ưu tiên Cloudflare cho client mới.

### Thiết lập Cloudflare một lần

1. Tạo bucket R2 đúng tên `apk-server`:

   ```bash
   npx wrangler@4 r2 bucket create apk-server
   ```

2. Trong Cloudflare DNS, xóa record CNAME/AAAA/A hiện có của host `apk` trước lần deploy Worker đầu tiên. `wrangler.toml` khai báo `apk.daivietpda.com` là Worker Custom Domain, vì vậy Cloudflare tự tạo và quản lý DNS record cùng chứng chỉ. Không trỏ hostname này về GitHub Pages.

3. Tạo Cloudflare API token giới hạn cho đúng account/zone. Token cần quyền sửa Workers script và R2, cùng các quyền zone cần thiết để tạo Worker custom domain/DNS record.

4. Thêm hai GitHub repository secrets:

   ```text
   CLOUDFLARE_ACCOUNT_ID
   CLOUDFLARE_API_TOKEN
   ```

Nếu chưa có hai secrets, workflow bình thường vẫn thành công: GitHub Pages vẫn được deploy và job Cloudflare chỉ thông báo đã bỏ qua.

### Publish tự động

Mỗi workflow thành công sẽ:

- sinh một `manifest.json` duy nhất;
- build `remote-preinstall.jar`;
- deploy bản tương thích cũ lên GitHub Pages;
- upload manifest, helper, APK và Split APK ZIP lên R2;
- deploy read-only Worker cho custom domain.

Worker chỉ chấp nhận `GET` và `HEAD` cho:

```text
/manifest.json
/remote-preinstall.jar
/apk/<một tên file .apk hoặc .zip>
```

Worker chặn directory traversal và directory listing, đặt content/cache header rõ ràng, đồng thời hỗ trợ một HTTP byte range để tiếp tục tải file lớn. Object R2 không còn trong manifest không bị tự động xóa; điều này tránh mất dữ liệu do một lần build manifest sai. Chỉ xóa thủ công sau khi chắc chắn không còn client đã phát hành tham chiếu object đó.
