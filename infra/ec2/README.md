# Release SEMH lên EC2 và Neon

Nginx chạy dưới `systemd` trên Ubuntu EC2. Nginx nhận HTTP/HTTPS trên cổng 80/443, phục vụ React từ `/var/www/semh/current` và chuyển `/api/` tới NestJS qua `127.0.0.1:8080`. Docker chạy NestJS và IoT simulator từ image `semh-app`. NestJS lưu dữ liệu người dùng, phiên đăng nhập và nghiệp vụ trong PostgreSQL trên Neon.

## Chuẩn bị Neon

Tạo project và database cho SEMH. Trong **Connect**, lấy hai connection string cho cùng database và branch. Dùng URL pooled làm `DATABASE_URL` cho NestJS và URL trực tiếp làm `DATABASE_URL_UNPOOLED` cho Prisma Migrate. Giữ tham số TLS của connection string Neon cấp. [Kết nối Prisma với Neon](https://neon.com/docs/guides/prisma)

## Chuẩn bị AWS

- Tạo private ECR repository `semh-app` cùng region với EC2.
- Chuẩn bị EC2 Linux x86-64 có Docker Engine, Compose plugin cài toàn máy, AWS CLI, SSM Agent, `curl` và `flock`. Gắn IAM instance role có quyền đăng ký SSM và pull `semh-app`.
- Trỏ domain tới EC2. Cho phép HTTP/HTTPS tới EC2 và kết nối ra endpoint Neon.
- Cài Nginx và Certbot trên Ubuntu. Tạo `/var/www/letsencrypt` để Certbot dùng khi xác thực qua webroot. Thay `__SEMH_HOST__` trong [cấu hình Nginx](../nginx/production.conf) bằng domain, lưu vào `/etc/nginx/sites-available/semh` và bật site qua `sites-enabled`. Mẫu cấu hình dùng chứng chỉ tại `/etc/letsencrypt/live/<domain>/`.
- Chạy `sudo nginx -t` rồi bật `nginx.service` trước lần release đầu. Bật `certbot.timer` và đặt deploy hook chạy `nginx -t` rồi `systemctl reload nginx.service` sau khi gia hạn.
- Tạo hai IAM OIDC role cho GitHub Actions. Build role đăng nhập ECR, push và đọc digest của `semh-app`. Deploy role gửi lệnh SSM tới EC2 của SEMH và đọc kết quả. Giới hạn build role vào repo và nhánh `main`. Giới hạn deploy role vào environment `production`, với environment này chỉ cho phép `main`.

Tạo `/opt/semh/.env.production` từ [mẫu cấu hình](.env.production.example) và đặt quyền đọc cho người vận hành. Đặt `APP_ORIGIN` bằng origin HTTPS của domain. Dùng cùng `IOT_SOURCE_ID` khi seed thiết bị và khi chạy app, với `IOT_SOURCE_KEY` dành riêng cho môi trường này.

## Biến GitHub Actions

| Biến | Giá trị |
| --- | --- |
| `AWS_REGION` | Region của ECR và EC2 |
| `AWS_BUILD_ROLE_ARN` | ARN role push image lên ECR |
| `AWS_DEPLOY_ROLE_ARN` | ARN role gửi lệnh SSM |
| `EC2_INSTANCE_ID` | ID máy SEMH |
| `PRODUCT_URL` | Origin HTTPS, không có slash cuối |
| `RELEASE_ENABLED` | Đặt `true` khi đã cấu hình đủ đầu vào |

Push lên `main` chạy CI. Khi bật release, GitHub Actions build image từ commit đã qua CI, đẩy lên ECR và chuyển digest cho EC2. Script trên EC2 lấy bản React từ cùng image, chạy migration, thay container và cập nhật liên kết `/var/www/semh/current`. Bản phát hành được ghi nhận sau khi kiểm tra `/api/health`, `/login` và `/register` qua HTTPS.

## Khởi tạo dữ liệu demo

Lần đầu đưa lên Neon, tạo file riêng `/opt/semh/.env.demo` chứa `DEMO_STU_PASSWORD`, `DEMO_OPR_PASSWORD`, `DEMO_MNT_PASSWORD`, `DEMO_ADM_PASSWORD`. Mỗi mật khẩu production tối thiểu 12 ký tự. Chạy trên EC2 từ `/opt/semh` sau lần release đầu.

```bash
docker compose --project-name semh --env-file .env.production --env-file .release.env \
  -f compose.production.yaml run --rm --no-deps --user node --env-from-file .env.demo \
  app npm run db:seed -w @semh/api
```

Với cơ sở dữ liệu mới, seed tạo 10 Hub, 45 xe dùng chung, 88 chỗ đỗ cá nhân, 20 cổng sạc và các tài khoản demo `student`, `operator`, `maintenance`, `admin`. Sau khi phát hành bản có dữ liệu demo mới, chạy lại lệnh seed để bổ sung tài nguyên theo mã và sức chứa còn lại. Sinh viên có thể mở `/register` để tự tạo tài khoản `STU`, đăng nhập bằng MSSV và thêm xe cá nhân trên màn đỗ hoặc sạc.

## Simulator và kiểm tra sau deploy

`SIMULATOR_ENABLED=true` khởi động simulator trong service `app`. Nó tự gửi xác nhận nhận/trả xe, check-in/check-out chỗ đỗ và các mốc sạc. `SIM_DEMO_STREAM=true` thêm bản tin pin định kỳ. `IOT_DEMO_ACCELERATED=true` rút thời gian chờ hoàn tất sạc demo tính từ khi phiên bắt đầu.

Kiểm tra đăng ký → đăng nhập → đặt xe → nhận xe → trả xe bằng URL sản phẩm. Kiểm tra thêm check-in/check-out và sạc với tài khoản demo sau khi seed. Khởi động lại app rồi xác nhận tài khoản và lịch sử vẫn đọc được từ Neon.

`.release.env` chứa digest của bản đã qua health check. `.release.previous.env` giữ digest trước đó. Nếu bước chuyển bản lỗi, script thử khôi phục container và liên kết React trước đó. Migration Neon đã áp dụng cần tương thích với image khôi phục.
