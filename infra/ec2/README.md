# Release SEMH lên EC2 và Neon

EC2 chạy service `app` từ image `semh-app`. Nginx phục vụ React qua HTTPS và chuyển `/api/` tới NestJS trên loopback. Tiến trình simulator demo gửi sự kiện cho NestJS qua loopback. NestJS lưu dữ liệu người dùng, phiên đăng nhập và nghiệp vụ trong PostgreSQL trên Neon.

## Chuẩn bị Neon

Tạo project và database cho SEMH. Trong **Connect**, lấy hai connection string cho cùng database và branch. Dùng URL pooled làm `DATABASE_URL` cho NestJS và URL trực tiếp làm `DATABASE_URL_UNPOOLED` cho Prisma Migrate. Giữ tham số TLS của connection string Neon cấp. [Kết nối Prisma với Neon](https://neon.com/docs/guides/prisma)

## Chuẩn bị AWS

- Tạo private ECR repository `semh-app` cùng region với EC2.
- Chuẩn bị EC2 Linux x86-64 có Docker Engine, Compose plugin cài toàn máy, AWS CLI, SSM Agent, `curl` và `flock`. Gắn IAM instance role có quyền đăng ký SSM và pull `semh-app`.
- Trỏ domain tới EC2. Cho phép HTTP/HTTPS tới EC2 và kết nối ra endpoint Neon. Đặt chứng chỉ và key tại `/opt/semh/tls/fullchain.pem` và `/opt/semh/tls/privkey.pem`.
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

Push lên `main` chạy CI. Khi bật release, GitHub Actions build image từ commit đã qua CI, đẩy lên ECR và chuyển digest cho EC2. Script trên EC2 chạy migration trước khi thay app, sau đó kiểm tra `/api/health`, `/login` và `/register` qua HTTPS.

## Khởi tạo dữ liệu demo

Lần đầu đưa lên Neon, tạo file riêng `/opt/semh/.env.demo` chứa `DEMO_STU_PASSWORD`, `DEMO_OPR_PASSWORD`, `DEMO_MNT_PASSWORD`, `DEMO_ADM_PASSWORD`. Mỗi mật khẩu production tối thiểu 12 ký tự. Chạy trên EC2 từ `/opt/semh` sau lần release đầu.

```bash
docker compose --project-name semh --env-file .env.production --env-file .release.env \
  -f compose.production.yaml run --rm --no-deps --user node --env-from-file .env.demo \
  app npm run db:seed -w @semh/api
```

Seed tạo sáu Hub, tài nguyên và các tài khoản demo `student`, `operator`, `maintenance`, `admin`. Chạy lại seed giữ tài khoản đã tồn tại. Sinh viên cũng có thể mở `/register` để tự tạo tài khoản `STU` và đăng nhập bằng MSSV. Dùng tài khoản demo `student` để trình diễn đỗ và sạc với xe cá nhân đã seed.

## Simulator và kiểm tra sau deploy

`SIMULATOR_ENABLED=true` khởi động simulator trong service `app`. Nó tự gửi xác nhận nhận/trả xe, check-in/check-out chỗ đỗ và các mốc sạc. `SIM_DEMO_STREAM=true` thêm bản tin pin định kỳ. `IOT_DEMO_ACCELERATED=true` rút thời gian chờ hoàn tất sạc demo tính từ khi phiên bắt đầu.

Kiểm tra đăng ký → đăng nhập → đặt xe → nhận xe → trả xe bằng URL sản phẩm. Kiểm tra thêm check-in/check-out và sạc với tài khoản demo sau khi seed. Khởi động lại app rồi xác nhận tài khoản và lịch sử vẫn đọc được từ Neon.

`.release.env` chứa digest image đã qua health check. `.release.previous.env` giữ digest trước đó. Trước khi quay lại image cũ, kiểm tra schema Neon còn tương thích. Cập nhật chứng chỉ trong thư mục `tls` rồi reload Nginx để nhận chứng chỉ mới.
