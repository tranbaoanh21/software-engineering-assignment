# Smart E-Mobility Hub

Bài tập lớn Công nghệ phần mềm HK261 của nhóm K24 Warriors, lớp L02. Website hỗ trợ đi xe dùng chung, đỗ xe cá nhân và sạc tại khu đô thị ĐHQG TP.HCM.

- [Báo cáo cuối](docs/final-report/output/pdf/final-report.pdf)
- [Mục lục tài liệu](docs/README.md)
- [Đề bài gốc](docs/reference/BTL_SoftwareEngineering_HK261_v1.pdf)

## Chạy local

Cần Node.js 24 và Docker Compose. Tạo `.env` từ `.env.example` ở lần đầu, sau đó chạy từ root repository.

```bash
npm ci
docker compose -f compose.yaml -f compose.dev.yaml up -d --wait db
npm run db:generate
npm run db:migrate
npm run build
npm run db:seed
IOT_DEMO_ACCELERATED=true npm run dev
```

Mở `http://localhost:5173`. Để chạy simulator, mở terminal khác từ root:

```bash
SIM_MODE=handoff SIM_DEMO_STREAM=true npm run dev:simulator
```

`IOT_DEMO_ACCELERATED=true` cho phép simulator hoàn tất sạc sau khoảng sáu giây khi demo. Lịch dự kiến trên màn hình vẫn tính theo pin, công suất và hiệu suất 90%. Simulator gửi xác nhận nhận/trả xe, vào/rời chỗ đỗ và các mốc sạc về API. `SIM_DEMO_STREAM=true` phát sự kiện pin cho xe demo được cấu hình mỗi 15 giây.

Sinh viên có thể tự đăng ký bằng MSSV ở `/register` rồi đăng nhập tại `/login`. Dùng `student`, `operator`, `maintenance`, `admin` với mật khẩu tương ứng trong biến `DEMO_STU_PASSWORD`, `DEMO_OPR_PASSWORD`, `DEMO_MNT_PASSWORD`, `DEMO_ADM_PASSWORD`. Seed bổ sung một xe cá nhân cho tài khoản `student`.

Trên cơ sở dữ liệu mới, seed tạo 10 Hub, 45 xe dùng chung, 88 chỗ đỗ cá nhân và 20 cổng sạc. Ga Metro và KTX A/B có nhiều xe và chỗ đỗ hơn. Khi chạy lại seed, hệ thống bổ sung tài nguyên theo mã, trong giới hạn sức chứa xe và chỗ đã dành cho các kế hoạch điều chuyển.

Các Hub là vị trí mô phỏng quanh ga Metro ĐHQG, KTX A/B, Bách Khoa, KHXH&NV, ĐH TDTT TP.HCM, ĐH CNTT, ĐH Khoa học Tự nhiên, ĐH Quốc tế và Thư viện Trung tâm. Vị trí đối chiếu theo [dữ liệu ga Metro](https://www.citylines.co/api/ho-chi-minh-city/raw_source/stations), [bảng tọa độ khu ĐHQG](https://gis.hcmuaf.edu.vn/data/file/KhoaLuanTotNghiep_DH12GI/ThuyKieu.pdf), [hướng dẫn đến cơ sở TDTT](https://forum.uit.edu.vn/t/hoc-giao-duc-the-chat-o-dau/140521) và dữ liệu OpenStreetMap cho [ĐH CNTT](https://www.openstreetmap.org/way/1303838982), [ĐH Khoa học Tự nhiên](https://www.openstreetmap.org/node/9593572488), [ĐH Quốc tế](https://www.openstreetmap.org/way/1419109086) và [Thư viện Trung tâm](https://www.openstreetmap.org/way/290230693).

### Chạy bằng Docker Compose

```bash
docker compose --profile full build api web
docker compose up -d --wait db
docker compose --profile full run --rm --no-deps api npm run db:migrate -w @semh/api
docker compose --profile full run --rm --no-deps api npm run db:seed -w @semh/api
docker compose --profile full up -d --wait
```

Mở `http://localhost:4173` hoặc cổng `COMPOSE_WEB_PORT`. Vite dùng cổng 5173 khi chạy dev trực tiếp. Chế độ Compose chỉ mở cổng web trên localhost. API và PostgreSQL nghe trong mạng Compose. Seed giữ nguyên tài khoản, trạng thái và lịch sử đã có.

## Demo theo vai trò

| Vai trò | Luồng |
| --- | --- |
| Sinh viên | Tìm Hub theo vị trí hoặc nhu cầu, xem tài nguyên và Hub thay thế. Đặt, hủy, nhận và trả xe. Đặt chỗ đỗ 20 phút, check-in và check-out. Xem trước và đăng ký sạc, theo dõi phiên. |
| Vận hành | Xem số liệu và cảnh báo theo Hub. Giao và đóng sự cố. Lưu nháp, duyệt và xác nhận tiến độ điều chuyển. Thêm, sửa mô tả, kích hoạt hoặc ngừng thiết bị. Điều chỉnh lịch sạc chưa bắt đầu. |
| Kỹ thuật | Xem sự cố được giao, tiếp nhận, ghi bằng chứng bàn giao xe hỏng và nộp kết quả kiểm tra. |
| Quản trị | Cấp, chỉnh sửa, khóa và mở tài khoản. Cấp và thu hồi vai trò, giới hạn OPR theo Hub. Khai báo Hub/thiết bị ở trạng thái nháp. |
| What-if | OPR tạo hoặc sao chép kịch bản, chạy với snapshot hiện tại hoặc mốc đã lưu, so sánh kết quả và điền trước phương án điều chuyển để duyệt ở OPS. |

Có thể demo xe trả về chờ sạc bằng `SIM_RETURN_BATTERY_PERCENT=20`, hoặc xe trả về có lỗi bằng `SIM_RETURN_FAULT=true` khi chạy simulator. Trong chuyến đi, sinh viên có thể mở **Báo sự cố với xe** để gửi mô tả và vị trí cho vận hành.

### Xác nhận trạng thái cho tài nguyên mới

Lấy ID từ API danh mục hoặc cơ sở dữ liệu của môi trường demo. Chạy một lệnh tương ứng trong terminal simulator với ID đã chọn. Sau khi nhận trạng thái, OPR mới kích hoạt tài nguyên.

```bash
SIM_MODE=resource-state SIM_RESOURCE_KIND=HUB SIM_RESOURCE_ID='hub-uuid' npm run dev:simulator
SIM_MODE=resource-state SIM_RESOURCE_KIND=VEHICLE SIM_RESOURCE_ID='vehicle-uuid' npm run dev:simulator
SIM_MODE=parking-state SIM_PARKING_SPACE_ID='space-uuid' SIM_PARKING_OCCUPIED=false npm run dev:simulator
SIM_MODE=charging-state SIM_POINT_ID='point-uuid' npm run dev:simulator
```

## Cấu trúc và kiểm thử

`apps/web` chứa React và Leaflet. `apps/api` chạy một ứng dụng NestJS gồm GEN và bảy phân hệ theo layered architecture. `apps/iot-simulator` là tiến trình phát sự kiện qua HTTP. `packages/contracts` định nghĩa dữ liệu web, API và IoT. [Implementation View](docs/final-report/sections/module-handoffs.tex) mô tả hợp đồng liên phân hệ.

Chạy `npm run lint`, `npm run typecheck` và `npm run build` để kiểm tra source. Để chạy `npm test`, cần PostgreSQL riêng tên `semh_test`, áp dụng migration và seed với các biến demo. CI chuẩn bị DB kiểm thử riêng trên từng job.

PR vào `main` chạy CI. Pipeline phát hành một image qua ECR và EC2, dùng digest của image cùng [cấu hình release](infra/ec2/README.md).
