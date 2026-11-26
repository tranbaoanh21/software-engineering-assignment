# Smart E-Mobility Hub

Bài tập lớn Công nghệ phần mềm HK261 của nhóm K24 Warriors, lớp L02. Website hỗ trợ đi xe dùng chung, đỗ xe cá nhân và sạc tại khu đô thị ĐHQG TP.HCM.

- [Website demo](https://semh.brainstorm-challenge.id.vn)
- [Báo cáo cuối](docs/final-report/output/pdf/final-report.pdf)
- [Mục lục tài liệu](docs/README.md)
- [Đề bài gốc](docs/reference/BTL_SoftwareEngineering_HK261_v1.pdf)

## Chạy local

Cần Node.js 24 và Docker Compose. Chạy từ root repository.

### Node.js và PostgreSQL trong Docker

Terminal 1 chuẩn bị database và chạy web cùng API.

```bash
test -f .env || cp .env.example .env
npm ci
docker compose -f compose.yaml -f compose.dev.yaml up -d --wait db
npm run db:generate
npm run db:migrate
npm run build
npm run db:seed
IOT_DEMO_BATTERY=true IOT_DEMO_ACCELERATED=true npm run dev
```

Terminal 2 chạy IoT simulator.

```bash
IOT_DEMO_BATTERY=true SIM_MODE=handoff npm run dev:simulator
```

Mở [localhost:5173](http://localhost:5173). Đặt `IOT_DEMO_BATTERY=true` cho cả hai tiến trình để API hiện nút giả lập pin thấp và simulator tự giảm pin xe trong chuyến. `IOT_DEMO_ACCELERATED=true` rút thời gian hoàn tất sạc demo còn khoảng sáu giây tính từ lúc phiên bắt đầu. Lịch dự kiến vẫn tính theo mức pin, công suất và hiệu suất 90%.

### Toàn bộ ứng dụng bằng Docker Compose

```bash
test -f .env || cp .env.example .env
docker compose --profile full build api web
docker compose up -d --wait db
docker compose --profile full run --rm --no-deps api npm run db:migrate -w @semh/api
docker compose --profile full run --rm --no-deps api npm run db:seed -w @semh/api
docker compose --profile full up -d --wait
```

Mở [localhost:4173](http://localhost:4173) hoặc cổng `COMPOSE_WEB_PORT`. API và PostgreSQL chạy trong mạng Compose. Profile `full` xác nhận nhận/trả xe, vào/rời chỗ đỗ và các mốc sạc. Simulator phát mức pin cho xe demo đã cấu hình khoảng mỗi 15 giây. Để demo nút pin thấp và pin giảm theo chuyến trên local, dùng cách chạy Node.js ở trên.

## Demo theo vai trò

Sinh viên có thể tự đăng ký bằng MSSV tại `/register` rồi đăng nhập tại `/login`. Tài khoản local gồm `student`, `operator`, `maintenance` và `admin`. Mật khẩu lấy từ các biến `DEMO_STU_PASSWORD`, `DEMO_OPR_PASSWORD`, `DEMO_MNT_PASSWORD` và `DEMO_ADM_PASSWORD` trong `.env`. Seed thêm một xe cá nhân cho tài khoản `student`.

| Vai trò | Luồng chính |
| --- | --- |
| Sinh viên | Khám phá Hub trên bản đồ, tìm theo tên có gợi ý và xem Hub thay thế. Giữ, hủy, nhận và trả xe dùng chung. Lưu biển số trong **Xe cá nhân** để dùng cho đặt chỗ đỗ và sạc. Đặt chỗ đỗ 20 phút, check-in/check-out, xem lịch sạc dự kiến và theo dõi phiên. |
| Vận hành | Xem số liệu và cảnh báo theo Hub. Xác nhận vị trí sự cố, giao Kỹ thuật và duyệt đưa tài nguyên vào phục vụ. Lập kế hoạch điều chuyển, giao Kỹ thuật và xác nhận xe đến Hub đích. Điều chỉnh lịch sạc chưa bắt đầu, thêm và quản lý thiết bị. |
| Kỹ thuật | Tiếp nhận việc được giao, sửa xe, xác nhận Hub đã nhận xe và gửi Vận hành duyệt. Với điều chuyển, xác nhận bắt đầu và báo khi xe đã đến Hub đích. |
| Quản trị | Tạo, chỉnh sửa, khóa và mở tài khoản. Cấp và thu hồi vai trò, giới hạn phạm vi OPR theo Hub. Khai báo danh mục Hub và thiết bị ở trạng thái nháp. |

### Luồng demo

- **Pin và sạc.** Sau khi nhận xe, mở **Chuyến đi** để xem pin xe dùng chung giảm 1 điểm phần trăm khoảng mỗi 5 giây. Với xe cá nhân, mở **Sạc của tôi → Đăng ký nhu cầu sạc**, chọn xe có pin trên 15% hoặc chưa có số đo và mở **Giả lập IoT → Giả lập pin thấp**. Khi xe đủ điều kiện, API ghi mức pin 15% để có thể thử đăng ký sạc.
- **Hư xe giữa chuyến.** Sinh viên dùng **Báo sự cố với xe** và nhập địa điểm. Vận hành xác nhận vị trí rồi giao Kỹ thuật. Khi Kỹ thuật bấm **Tiếp nhận xe**, chuyến kết thúc ở trạng thái gián đoạn. Sau khi sửa và đưa xe về Hub, Kỹ thuật chọn Hub và bấm **Xác nhận đã đưa xe về Hub**. Xe đã có vị trí Hub và vẫn ở trạng thái tạm ngừng phục vụ. Vận hành phụ trách Hub đó bấm **Xác nhận đưa vào phục vụ**. Xe về trạng thái sẵn sàng nếu pin từ 30% trở lên, hoặc chờ sạc nếu pin dưới 30%.
- **What-if và điều chuyển.** Vận hành tạo hoặc sao chép kịch bản, chọn snapshot hiện tại hoặc mốc đã lưu và so sánh kết quả. Mô phỏng tính trên bản sao dữ liệu của snapshot. Từ khuyến nghị chuyển xe, mở kế hoạch đã điền trước trong **Điều chuyển**. Vận hành giao Kỹ thuật, Kỹ thuật bấm **Bắt đầu điều chuyển** rồi **Báo đã đến Hub đích**. Khi Vận hành bấm **Xác nhận hoàn tất**, hệ thống cập nhật Hub đích cho xe.

Có thể chạy simulator với `SIM_RETURN_BATTERY_PERCENT=20` để demo xe trả về chờ sạc, hoặc `SIM_RETURN_FAULT=true` để demo xe có lỗi lúc trả.

## Dữ liệu demo

Trên cơ sở dữ liệu mới, seed tạo 10 Hub, 45 xe dùng chung, 88 chỗ đỗ cá nhân và 20 cổng sạc. Ga Metro và KTX A/B có nhiều xe và chỗ đỗ hơn. Khi chạy lại seed, hệ thống bổ sung tài nguyên theo mã, trong giới hạn sức chứa xe và chỗ đã dành cho các kế hoạch điều chuyển.

Các Hub là vị trí mô phỏng quanh ga Metro ĐHQG, KTX A/B, Bách Khoa, KHXH&NV, ĐH TDTT TP.HCM, ĐH CNTT, ĐH Khoa học Tự nhiên, ĐH Quốc tế và Thư viện Trung tâm. Vị trí đối chiếu theo [dữ liệu ga Metro](https://www.citylines.co/api/ho-chi-minh-city/raw_source/stations), [bảng tọa độ khu ĐHQG](https://gis.hcmuaf.edu.vn/data/file/KhoaLuanTotNghiep_DH12GI/ThuyKieu.pdf), [hướng dẫn đến cơ sở TDTT](https://forum.uit.edu.vn/t/hoc-giao-duc-the-chat-o-dau/140521) và dữ liệu OpenStreetMap cho [ĐH CNTT](https://www.openstreetmap.org/way/1303838982), [ĐH Khoa học Tự nhiên](https://www.openstreetmap.org/node/9593572488), [ĐH Quốc tế](https://www.openstreetmap.org/way/1419109086) và [Thư viện Trung tâm](https://www.openstreetmap.org/way/290230693).

### Xác nhận trạng thái cho tài nguyên mới

Lấy ID từ API danh mục hoặc cơ sở dữ liệu của môi trường demo. Chạy một lệnh tương ứng trong terminal simulator với ID đã chọn. Sau khi nhận trạng thái, OPR mới kích hoạt tài nguyên.

```bash
SIM_MODE=resource-state SIM_RESOURCE_KIND=HUB SIM_RESOURCE_ID='hub-uuid' npm run dev:simulator
SIM_MODE=resource-state SIM_RESOURCE_KIND=VEHICLE SIM_RESOURCE_ID='vehicle-uuid' npm run dev:simulator
SIM_MODE=parking-state SIM_PARKING_SPACE_ID='space-uuid' SIM_PARKING_OCCUPIED=false npm run dev:simulator
SIM_MODE=charging-state SIM_POINT_ID='point-uuid' npm run dev:simulator
```

## Kiến trúc

| Thành phần | Trách nhiệm |
| --- | --- |
| `apps/web` | React và Leaflet cho giao diện theo vai trò và bản đồ Hub. |
| `apps/api` | NestJS modular monolith gồm GEN và bảy phân hệ HUB, RES, TRIP, PARK, CHG, OPS, SIM. Từng phân hệ tổ chức theo layered architecture. |
| `apps/iot-simulator` | Tiến trình Node.js mô phỏng thiết bị. Đọc yêu cầu đang chờ từ API và gửi sự kiện HTTP. |
| `packages/contracts` | Kiểu dữ liệu dùng chung giữa web, API và simulator. |

Trên EC2, Nginx trên Ubuntu phục vụ bản React và chuyển `/api/` vào container `app`. NestJS và simulator chạy thành hai tiến trình trong container. Simulator gửi bản tin tới API qua HTTP. `StateDataAdapter` xác thực và chuyển sự kiện đến phân hệ xử lý. NestJS lưu trạng thái trong PostgreSQL trên Neon, còn giao diện đọc lại qua API. Mosquitto là một lựa chọn khi tích hợp thiết bị thật dùng MQTT. [Implementation View](docs/final-report/sections/module-handoffs.tex) · [Hướng dẫn EC2](infra/ec2/README.md)

## Kiểm thử và phát hành

```bash
npm run lint
npm run typecheck
npm run build
```

Để chạy `npm test`, đặt `DATABASE_URL` trỏ tới PostgreSQL riêng tên `semh_test` và áp dụng migration, seed với các biến demo. [Cấu hình CI](.github/workflows/ci.yml) tạo DB kiểm thử cho từng job.

PR vào `main` chạy CI. Push hoặc merge vào `main` kích hoạt [Release](.github/workflows/release.yml), kể cả thay đổi chỉ gồm Markdown. Khi CI thành công và `RELEASE_ENABLED=true`, pipeline build Docker image, push lên Amazon ECR và dùng AWS Systems Manager để EC2 triển khai đúng image theo digest. [Hướng dẫn phát hành](infra/ec2/README.md)
