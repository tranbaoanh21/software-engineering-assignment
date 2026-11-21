# Quy ước thiết kế Phase 3

Nhóm dùng báo cáo Submission 2 làm nguồn nghiệp vụ. Phase 3 chuyển các luồng đó thành kiến trúc, lớp và phương thức; không tự thêm role, UC hay trạng thái mới khi vẽ.

## Kiến trúc và công nghệ

- Website React + TypeScript + Vite; bản đồ Leaflet, tile OpenStreetMap.
- Backend NestJS + TypeScript trên Node.js, modular monolith và layered architecture.
- PostgreSQL là nơi lưu thật; Prisma là adapter truy cập. SEMHDataStore là tên logic trong báo cáo.
- Một backend instance; scheduler và simulation worker ở cùng ứng dụng. Simulator Node.js là tiến trình bên ngoài.
- Docker Compose gồm web (Nginx), api và db. Không bắt buộc Azure, broker hoặc microservice.
- Đây là lựa chọn thiết kế cho giai đoạn tiếp theo, chưa có mã ứng dụng hoặc kết quả chạy.

## Địa điểm và dữ liệu Hub

Danh mục địa điểm gồm ga Metro Đại học Quốc gia; KTX khu A/B; Bách Khoa cơ sở Dĩ An; KHXH&NV và Khoa học Tự nhiên cơ sở khu ĐHQG; Công nghệ Thông tin; Quốc tế; Kinh tế - Luật; Thư viện Trung tâm; Nhà điều hành ĐHQG-HCM; Đại học Thể dục Thể thao TP.HCM. Phạm vi bản đồ là khu đô thị ĐHQG-HCM và khu vực lân cận.

Mỗi Hub có ID, tên địa điểm, tọa độ, sức chứa và tài nguyên gắn với đúng Hub. Sự kiện IoT dùng resourceId để ánh xạ; dữ liệu hiển thị gồm xe và pin từng xe, chỗ đỗ/cổng sạc, số lượng khả dụng và thời điểm cập nhật.

Nguồn địa điểm: [KHXH&NV](https://hcmussh.edu.vn/organizational-structure), [Khoa học Tự nhiên](https://stsv.hcmus.edu.vn/gioi-thieu-ve-truong), [Công nghệ Thông tin](https://tuyensinh.uit.edu.vn/content/lien-he), [Quốc tế](https://hcmiu.edu.vn/wp-content/uploads/2025/02/Thu-moi-chao-gia-qua-tang-phuc-vu-cho-hoat-dong-quang-ba-va-don-doan-cua-P.QHDN_.pdf), [Kinh tế - Luật](https://www.uel.edu.vn/), [Thể dục Thể thao](https://tuyensinh.ush.edu.vn/), [Thư viện Trung tâm](https://research.vnuhcm.edu.vn/index.php/vi/2023/03/19/huong-dan-su-dung-co-so-du-lieu-thu-vien-trung-tam-dhqg-hcm/), [Nhà điều hành ĐHQG](https://www.vnuilead.edu.vn/hoat-dong-sinh-vien-iei.html).

## Tên và owner

| Phạm vi | Lớp nghiệp vụ | Service / UI |
|---|---|---|
| GEN | Account, AccessAssignment; Session là lớp kỹ thuật | AccessService, AdministrationService / AdministrationUI |
| HUB | MobilityHub | HubService / HubUI |
| RES | VehicleReservation | ReservationService / ReservationUI |
| TRIP | Vehicle, SharedVehicle, Trip | TripService / TripUI |
| PARK | PrivateVehicle, ParkingSpace, ParkingReservation | ParkingService / ParkingUI |
| CHG | ChargingRequest, ChargingSession, ChargingPoint | ChargingService / ChargingUI |
| OPS | Incident, RedistributionPlan | OperationsService / OperationsUI |
| SIM | SimulationScenario, SimulationRun, Recommendation | SimulationService / SimulationUI |

SUB-SIM có thêm các kiểu nội bộ SimulationSnapshot, SimulationResult, ScenarioParameters và các lớp xử lý SimulationEngine, RecommendationAnalyzer, SnapshotProvider/StoreSnapshotProvider. Các kiểu này thuộc SIM; không đổi owner của tài nguyên vận hành. Run chốt snapshot, parametersCopy, profileCopy và modelVersion; analysisReady là cờ kết quả phân tích, không phải trạng thái mới của SimulationRun.

Một lớp được định nghĩa tại một owner. Phân hệ khác tham chiếu đúng lớp/ID và gọi hợp đồng owner; không sao chép SharedVehicle, Hub hoặc PrivateVehicle thành lớp mới. GEN tạo danh mục Draft qua owner; OPS thay đổi phục vụ qua owner. Cùng DB không có nghĩa được tự sửa bảng của module khác.

StateDataGateway (ACT-DAT / EXT-STATE) là nguồn dữ liệu ngoài; StateDataAdapter là lớp tiếp nhận nội bộ. MapTileProvider (EXT-MAP) cung cấp tile, Leaflet nằm trong frontend; không dùng ACT-MAP. AuditService là nội bộ, không phải actor.

## Trạng thái giữ nguyên

| Kiểu | Giá trị |
|---|---|
| AccountStatus | Active, Locked |
| ServiceStatus | Draft, Active, Inactive |
| VehicleStatus | Available, Reserved, InUse, Charging, OutOfService |
| HubStatus | Normal, NearCapacity, Full, OutOfService |
| ParkingSpaceStatus | Available, Reserved, Occupied, OutOfService |
| ChargingPointStatus | Available, Reserved, Charging, OutOfService |
| VehicleReservationStatus | Pending, Confirmed, Fulfilled, Cancelled, Expired, Rejected |
| ParkingReservationStatus | Pending, Confirmed, CheckedIn, Completed, Cancelled, Expired, Rejected |
| TripStatus | InProgress, Completed, Interrupted |
| ChargingRequestStatus | Pending, Scheduled, Charging, Completed, Cancelled, Rejected |
| ChargingSessionStatus | Ready, Charging, Paused, Completed, Interrupted, Failed |
| IncidentStatus | Open, Acknowledged, InProgress, Resolved, Closed |
| RedistributionPlanStatus | Draft, Recommended, Approved, InProgress, Completed, Cancelled |
| SimulationRunStatus | Draft, Running, Completed, Failed |

ServiceStatus tách khỏi trạng thái vật lý và AccountStatus. Cấp phát cần Hub/tài nguyên Active cùng điều kiện vận hành. IoT không tự kích hoạt tài nguyên; hoàn tất Trip không tự làm xe Available. Không thêm Cancelled cho SimulationRun.

## Kiểu và chữ ký

- Class/DTO/enum: PascalCase; thuộc tính, phương thức: lowerCamelCase.
- ID: UUID; DateTime: UTC/ISO-8601; duration nêu đơn vị trong tên.
- Khoảng cách mét; batteryPercent 0–100; năng lượng kWh, công suất kW.
- Tọa độ WGS84: latitude [-90,90], longitude [-180,180].
- Version là số nguyên không âm. Optional dùng [0..1]; danh sách dùng List<T>.
- Chữ ký: `+ methodName(input: InputType): OutputType`. Visibility phải phù hợp trách nhiệm.
- Query trả DTO an toàn; không trả passwordHash, tokenHash, khóa nguồn hoặc bản ghi DB nguyên trạng.
- Tên lời gọi tổng quát submitChange của sequence quản trị được phân rã thành các phương thức cụ thể ở GEN; giữ nguyên nghiệp vụ và điều kiện đã chốt.

Các kiểu chung gồm SessionToken, SessionView, Permission, TargetRef, AccessDecision, ChangeContext, ChangeReceipt, StateEvent, IngestResult và AuditEntry; xem định nghĩa trong báo cáo. ChangeContext chứa requestId/reason và expectedVersion khi cập nhật. Actor lấy từ session, không nhận role do form tự gửi.

## Quy tắc xử lý

- AccessService kiểm tra phiên, tài khoản, quyền hiện hành và phạm vi đối tượng tại backend. ADM không mặc nhiên có quyền OPR/MNT.
- Session hết hạn sau 30 phút không hoạt động hợp lệ. Khóa tài khoản thu hồi phiên; mở lại không khôi phục phiên cũ.
- Command cạnh tranh dùng transaction Serializable, kiểm tra lại quyền/version/ràng buộc; retry toàn transaction tối đa hai lần khi serialization conflict.
- Thay đổi, audit và receipt commit cùng nhau. requestId gắn chủ thể/loại thao tác/nội dung; gửi lại đúng ID đọc kết quả cũ.
- Mất phản hồi không chứng minh chưa commit. Dùng getChangeResult hoặc gửi lại đúng ID/nội dung; không tự tạo yêu cầu mới.
- IoT dùng sourceId/eventId chống lặp, sequence tăng trong cùng nguồn/tài nguyên, giữ observedAt và receivedAt riêng.
- Nguồn sai, payload sai hoặc bản tin cũ không ghi đè dữ liệu hợp lệ mới hơn.
- Snapshot mô phỏng đọc nhất quán, working copy riêng. Chỉ OPS áp dụng kế hoạch thật sau xác nhận và kiểm tra lại.
- Không đổi ngưỡng BR/NFR từ Submission 2 để khớp code hoặc sơ đồ mới.

## Bài của từng phân hệ

Mỗi file gồm một Class Diagram theo phân hệ, mô tả lớp cần thiết và mô tả phương thức. Có thể tách sơ đồ nếu quá khó đọc, nhưng không tạo một mô hình lớp mới cho mỗi UC.

Mọi phương thức được vẽ đều phải có mô tả, kể cả interface/helper/tác vụ nền. Không cần đưa getter/setter sinh tự động vào sơ đồ. Query đơn giản dùng một dòng bảng; command phức tạp mô tả thêm điều kiện, xử lý, thay đổi dữ liệu và lỗi. Không viết lại toàn bộ UC specification.

Quan hệ có multiplicity; kế thừa/realization hướng tam giác về lớp cha/interface. Không dùng composition chỉ vì Hub quản lý xe. Giữ nền trắng, nét đen, không bóng; xuất cả SVG và PDF vector, giữ .puml để chỉnh sửa.
