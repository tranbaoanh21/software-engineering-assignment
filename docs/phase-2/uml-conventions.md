# Thuật ngữ dùng chung — Submission 2

Mọi người dùng đúng các tên dưới đây khi vẽ sơ đồ và viết giải thích. Báo cáo Submission 2 tích hợp nội dung Submission 1 với UI và các biểu đồ hành vi; giữ 18 mã UC ban đầu, bổ sung UC-OPS-04/05 và UC-GEN-01/02/03, tổng cộng 23 UC. Quan hệ include/extend và phân loại AF/EF cũ giữ nguyên. Quy tắc hết hạn chỗ đỗ theo BR-PARK-02; lịch sạc demo theo BR-CHG-01 đến BR-CHG-04 (ưu tiên, thời lượng, cổng tương thích và công suất Hub).

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
| ACT-ADM | Quản trị viên |

Ghi tên kèm mã, ví dụ `Sinh viên (ACT-STU)`. `ACT-ADM` là vai trò riêng, không đổi tên `ACT-OPR` thành Admin và không vẽ quan hệ kế thừa giữa hai actor.

- `ACT-ADM`: cấp/cập nhật/khóa tài khoản, quản lý vai trò và phạm vi, khai báo danh mục tài nguyên ban đầu. Hỗ trợ khẩn cấp về truy cập bằng khóa tài khoản hoặc thu hồi quyền, phải ghi lý do.
- `ACT-OPR`: thêm hoặc sửa thông tin thiết bị, kích hoạt/ngừng phục vụ trong Hub được giao; quản lý sạc, sự cố, điều phối và mô phỏng. Không quản lý tài khoản hoặc cấp quyền.
- `ACT-MNT`: cập nhật và xác nhận kết quả kỹ thuật của công việc được giao; không phê duyệt điều phối hay quản trị tài khoản.
- `ACT-ADM` không tự có quyền vận hành, không xác nhận tài nguyên đã sửa xong, không ghi đè telemetry hoặc làm xe trở thành `Available` bằng thao tác sửa danh mục.

`GEN` chứa chức năng dùng chung, không phải phân hệ thứ tám. Nhóm quản trị xuất hiện riêng trong sơ đồ tổng quát; có ba UC-GEN và 20 UC thuộc bảy phân hệ. Không đổi hoặc đánh lại mã UC cũ. Trong sequence, `AccessService` kiểm tra tài khoản, phiên, quyền hiện hành và phạm vi đối tượng; không dùng điều kiện kiểu `isAdmin OR isOperator` để cho Admin vượt kiểm tra quyền vận hành. Quyền bị thu hồi phải hết hiệu lực ở yêu cầu được bảo vệ tiếp theo.

| Mã hệ thống / actor | Tên hiển thị | Tên ngắn dùng trong mã sơ đồ |
| --- | --- | --- |
| EXT-STATE / ACT-DAT | IoT & State Data Gateway | StateDataGateway |
| EXT-MAP / ACT-MAP | Map & Geolocation Service | MapService |

`EXT-STATE` và `ACT-DAT` chỉ cùng một bên: mã hệ thống ngoài và mã actor tương ứng. Không vẽ thành hai thành phần khác nhau; tương tự với `EXT-MAP` và `ACT-MAP`.

## 3. Đối tượng nghiệp vụ

| Tên chuẩn | Tên tiếng Việt |
| --- | --- |
| Account | Tài khoản người dùng |
| AccessAssignment | Phân quyền vai trò và phạm vi |
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
| GEN (quản trị) | AdministrationUI | AdministrationService |

Tên dùng chung:

- `AccessService`: xử lý xác thực và kiểm tra quyền truy cập theo phân quyền hiện hành; Admin không mặc nhiên có mọi quyền.
- `SEMHDataStore`: nơi lưu và truy xuất dữ liệu của SEMH.
- `StateDataGateway`, `MapService`: tên ngắn của hai hệ thống ngoài ở mục 2, không phải service nội bộ.

Các tên này dùng để đồng bộ mô hình, không bắt buộc tạo một ứng dụng riêng cho mỗi service.

## 5. Tên trạng thái

Giữ đúng tên và chữ hoa/thường dưới đây, không thay bằng `Busy`, `Done`, `Unavailable` hoặc tên tự đặt.

```text
AccountStatus = Active | Locked
ServiceStatus = Draft | Active | Inactive

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

`AccountStatus.Active` không có nghĩa có mọi quyền; khóa tài khoản không hủy quy trình nghiệp vụ và mở lại không khôi phục phiên cũ. `AccessAssignment` lưu vai trò và phạm vi Hub hiện hành, không phải actor.

`ServiceStatus` là trạng thái cho phép phục vụ, gắn với Hub và tài nguyên; không thêm `Inactive` vào `VehicleStatus` hoặc dùng `OutOfService` thay cho thao tác tắt phục vụ. Tài nguyên mới `Draft`; chỉ Operator kích hoạt khi đủ điều kiện. Ngừng phục vụ bị chặn khi còn lượt giữ, phiên sử dụng, lịch sạc hoặc điều phối ràng buộc; với Hub xét cả tài nguyên con. Cấp phát mới phải kiểm tra ServiceStatus của cả Hub và tài nguyên trong cùng kiểm tra cạnh tranh. IoT không tự mở lại `Inactive`.

## 6. Cách viết tên trên sơ đồ

- Tên actor, UC, hoạt động và phần giải thích viết tiếng Việt.
- Tên thành phần, đối tượng và trạng thái dùng tiếng Anh như các bảng trên; tên thành phần/kiểu đối tượng viết `PascalCase`.
- Tên thao tác và sự kiện tiếng Anh viết `lowerCamelCase`, ví dụ `cancelVehicleReservation`, `handoverConfirmed`. Cùng một thao tác hoặc sự kiện thì không đổi tên giữa các hình.
- Nếu biểu diễn một đối tượng cụ thể, dùng dạng `reservation:VehicleReservation`, `vehicle:SharedVehicle`, `trip:Trip`.

Tên nào chưa có hoặc cần đổi thì gửi mình thống nhất trước, để bài các bạn ghép lại không bị mỗi người gọi một kiểu.
