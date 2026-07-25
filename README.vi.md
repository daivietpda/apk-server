# APK Server

Nguồn cài sẵn có thể gỡ bỏ từ xa dành cho các ROM Android.

## Các URL đã được xuất bản

- Tệp kê khai (Manifest): `https://daivietpda.github.io/apk-server/manifest.json`
- Các tệp APK: `https://daivietpda.github.io/apk-server/apk/<tên-tệp>.apk`
- Trình trợ giúp DEX: `https://daivietpda.github.io/apk-server/remote-preinstall.jar`

## Cập nhật cục bộ

Tạo lại mã băm và tệp kê khai:

```bat
manifest.bat
```

Bắt buộc cài đặt lại cho một APK:

```bat
manifest.bat --set-apk downloader.apk --package-name com.esaba.downloader --force-install true
```

Tắt tính năng này:

```bat
manifest.bat --set-apk downloader.apk --force-install false
```

Commit và push các tệp `manifest.json` và `manifest-policy.json` đã thay đổi.

## Cập nhật từ GitHub Actions

Mở **Actions > Build manifest and publish APK server > Run workflow**.

- `apk_file`: tên chính xác của tệp trong thư mục `apk/`.
- `package_name`: ID ứng dụng Android.
- `force_install`: `true`, `false` hoặc `unchanged` (không thay đổi).

Quy trình làm việc sẽ tạo lại các giá trị SHA-256, biên dịch `RemoteFetch.java` thành tệp jar DEX,
commit các thay đổi về chính sách/tệp kê khai đã được tạo, và triển khai trang web lên GitHub Pages.
