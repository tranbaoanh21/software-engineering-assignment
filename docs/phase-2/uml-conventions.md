# Thuật ngữ dùng chung — Submission 2

Mọi người dùng đúng các tên dưới đây khi vẽ sơ đồ và viết giải thích. Nội dung nghiệp vụ, mã và tên 18 use case giữ theo báo cáo Submission 1 đã chốt; phân công giữ theo khung Submission 2.

## 1. Hệ thống, phân hệ và mã định danh

Tên hệ thống là **Smart E-Mobility Hub**, viết tắt **SEMH**.

| Mã | Tên phân hệ |
| --- | --- |
| SUB-HUB | Tra cứu Hub và tài nguyên |
| SUB-RES | Đặt phương tiện dùng chung |
| SUB-TRIP | Quản lý chuyến đi |
| SUB-PARK | Quản lý chỗ đỗ xe cá nhân |
| SUB-CHG | Quản lý sạc và lịch sạc |
| SUB-OPS | Giám sát và điều phối vận hành |
| SUB-SIM | What-if Simulation và khuyến nghị |

Giữ nguyên mã `UC-*`, `FR-*`, `BR-*`, `NIFR-*` và `NFR-*` trong Submission 1. `GEN` chỉ chức năng dùng chung như xác thực, phân quyền, không phải phân hệ thứ tám.

## 2. Actor và hệ thống bên ngoài

| Mã actor | Tên dùng trên sơ đồ |
| --- | --- |
| ACT-STU | Sinh viên |
| ACT-OPR | Nhân viên vận hành |
| ACT-MNT | Nhân viên kỹ thuật |

Ghi tên kèm mã, ví dụ `Sinh viên (ACT-STU)`. Không đổi Nhân viên vận hành thành `Admin` hoặc tự thêm actor khác.

| Mã hệ thống / actor | Tên hiển thị | Tên ngắn dùng trong mã sơ đồ |
| --- | --- | --- |
| EXT-STATE / ACT-DAT | IoT & State Data Gateway | StateDataGateway |
| EXT-MAP / ACT-MAP | Map & Geolocation Service | MapService |

`EXT-STATE` và `ACT-DAT` chỉ cùng một bên: mã hệ thống ngoài và mã actor tương ứng. Không vẽ thành hai thành phần khác nhau; tương tự với `EXT-MAP` và `ACT-MAP`.

## 3. Đối tượng nghiệp vụ

| Tên chuẩn | Tên tiếng Việt |
| --- | --- |
| MobilityHub | Mobility Hub; viết gọn Hub |
| Vehicle | Phương tiện nói chung |
| SharedVehicle | Phương tiện dùng chung |
| PrivateVehicle | Phương tiện cá nhân |
| VehicleReservation | Lượt đặt phương tiện |
| ParkingReservation | Lượt đặt chỗ đỗ |
| ParkingSpace | Chỗ đỗ |
| Trip | Chuyến đi |
| ChargingRequest | Yêu cầu sạc |
| ChargingSession | Phiên sạc |
| ChargingPoint | Cổng sạc |
| Incident | Sự cố |
| RedistributionPlan | Kế hoạch điều chuyển |
| SimulationScenario | Kịch bản mô phỏng |
| SimulationRun | Lần chạy mô phỏng |
| Recommendation | Khuyến nghị |

Không dùng `Booking` thay `VehicleReservation`, `Charger` thay `ChargingPoint` hoặc đặt tên khác cho cùng một đối tượng.

Phân biệt yêu cầu sạc với phiên sạc; lượt đặt chỗ đỗ với chỗ đỗ; kịch bản mô phỏng với lần chạy mô phỏng. `snapshot` là bản sao trạng thái cơ sở dùng cho mô phỏng, không phải luồng dữ liệu IoT.

## 4. Tên thành phần dùng trong sequence

Cùng một thành phần xuất hiện ở nhiều UC thì giữ cùng tên.

| Phân hệ | Giao diện | Xử lý nghiệp vụ |
| --- | --- | --- |
| SUB-HUB | HubUI | HubService |
| SUB-RES | ReservationUI | ReservationService |
| SUB-TRIP | TripUI | TripService |
| SUB-PARK | ParkingUI | ParkingService |
| SUB-CHG | ChargingUI | ChargingService |
| SUB-OPS | OperationsUI | OperationsService |
| SUB-SIM | SimulationUI | SimulationService |

Tên dùng chung:

- `AccessService`: xử lý xác thực và kiểm tra quyền truy cập.
- `SEMHDataStore`: nơi lưu và truy xuất dữ liệu của SEMH.
- `StateDataGateway`, `MapService`: tên ngắn của hai hệ thống ngoài ở mục 2, không phải service nội bộ.

Các tên này dùng để đồng bộ mô hình, không bắt buộc tạo một ứng dụng riêng cho mỗi service.

## 5. Tên trạng thái

Giữ đúng tên và chữ hoa/thường dưới đây, không thay bằng `Busy`, `Done`, `Unavailable` hoặc tên tự đặt.

```text
VehicleStatus = Available | Reserved | InUse | Charging | OutOfService
ParkingSpaceStatus = Available | Reserved | Occupied | OutOfService
ChargingPointStatus = Available | Reserved | Charging | OutOfService
HubStatus = Normal | NearCapacity | Full | OutOfService

VehicleReservationStatus = Pending | Confirmed | Fulfilled | Cancelled | Expired | Rejected
ParkingReservationStatus = Pending | Confirmed | CheckedIn | Completed | Cancelled | Expired | Rejected
TripStatus = InProgress | Completed | Interrupted
ChargingRequestStatus = Pending | Scheduled | Charging | Completed | Cancelled | Rejected
ChargingSessionStatus = Ready | Charging | Paused | Completed | Interrupted | Failed
IncidentStatus = Open | Acknowledged | InProgress | Resolved | Closed
RedistributionPlanStatus = Draft | Recommended | Approved | InProgress | Completed | Cancelled
SimulationRunStatus = Draft | Running | Completed | Failed
```

`SharedVehicle` dùng tập `VehicleStatus`. Khi nhắc trạng thái, nói rõ đối tượng: `Trip.Completed` là chuyến đi hoàn tất, không có nghĩa xe đã `Available`.

## 6. Cách viết tên trên sơ đồ

- Tên actor, UC, hoạt động và phần giải thích viết tiếng Việt.
- Tên thành phần, đối tượng và trạng thái dùng tiếng Anh như các bảng trên; tên thành phần/kiểu đối tượng viết `PascalCase`.
- Tên thao tác và sự kiện tiếng Anh viết `lowerCamelCase`, ví dụ `cancelVehicleReservation`, `handoverConfirmed`. Cùng một thao tác hoặc sự kiện thì không đổi tên giữa các hình.
- Nếu biểu diễn một đối tượng cụ thể, dùng dạng `reservation:VehicleReservation`, `vehicle:SharedVehicle`, `trip:Trip`.

Tên nào chưa có hoặc cần đổi thì gửi mình thống nhất trước, để bài các bạn ghép lại không bị mỗi người gọi một kiểu.
