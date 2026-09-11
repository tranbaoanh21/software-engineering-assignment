# Quy ước chung của dự án Smart E-Mobility Hub

Tài liệu này là nguồn tham chiếu chung cho toàn bộ nhóm. Trước khi viết requirement, use case, diagram hoặc báo cáo, mọi thành viên phải dùng đúng tên, mã và trạng thái được quy định tại đây. Không tự tạo thêm thuật ngữ đồng nghĩa cho cùng một khái niệm.

Nếu phát hiện nội dung chưa được quy định, thành viên ghi lại câu hỏi và gửi nhóm trưởng cấp tên hoặc mã chính thức. Không tự đổi các mã đã được người khác sử dụng.

## 1. Tên hệ thống và cách dùng ngôn ngữ

- Tên đầy đủ: **Smart E-Mobility Hub**.
- Tên tiếng Việt: **Hệ thống điều phối phương tiện điện trong Khu đô thị ĐHQG-HCM**.
- Mã hệ thống: `SEMH`.
- Báo cáo và tên use case trên UML dùng tiếng Việt.
- Tên class, method, trạng thái và thuật ngữ kỹ thuật dùng tiếng Anh theo quy ước trong tài liệu này.
- Lần đầu nhắc đến một thuật ngữ nên ghi cả hai tên, ví dụ: `Lượt đặt phương tiện (Vehicle Reservation)`.

Không dùng lẫn các tên `trạm`, `bãi`, `điểm` để thay cho `Mobility Hub`. Không dùng lẫn `cổng sạc`, `ổ sạc` và `trụ sạc`; tên chính thức là `Charging Point` - cổng sạc.

## 2. Bảy phân hệ nghiệp vụ

| Mã | Tên phân hệ | Trách nhiệm chính |
|---|---|---|
| `HUB` | Tra cứu Hub và tài nguyên | Cung cấp thông tin Hub, xe, chỗ đỗ, cổng sạc và gợi ý Hub phù hợp. |
| `RES` | Đặt phương tiện dùng chung | Tạo, theo dõi, hủy và xử lý hết hạn lượt đặt phương tiện. |
| `TRIP` | Quản lý chuyến đi | Nhận xe, bắt đầu chuyến đi, trả xe và kết thúc chuyến đi. |
| `PARK` | Quản lý chỗ đỗ xe cá nhân | Tìm, đặt, sử dụng và giải phóng chỗ đỗ cho xe điện cá nhân. |
| `CHG` | Quản lý sạc và lịch sạc | Tiếp nhận yêu cầu, lập lịch, ưu tiên và theo dõi phiên sạc. |
| `OPS` | Giám sát và điều phối vận hành | Giám sát mạng lưới, xử lý sự cố và điều chuyển tài nguyên giữa các Hub. |
| `SIM` | What-if Simulation và khuyến nghị | Cấu hình, chạy, so sánh kịch bản và cung cấp khuyến nghị điều phối. |

Một use case chỉ có một phân hệ sở hữu chính. Nếu use case cần dữ liệu hoặc kết quả từ phân hệ khác, ghi phần phụ thuộc thay vì tạo bản sao use case.

## 3. Stakeholder, actor và hệ thống bên ngoài

### 3.1. Stakeholder

| Mã | Tên chính thức | Mối quan tâm |
|---|---|---|
| `SH-STU` | Sinh viên | Tìm và sử dụng phương tiện, chỗ đỗ và tài nguyên sạc thuận tiện. |
| `SH-OPR` | Đơn vị vận hành | Theo dõi trạng thái, xử lý sự cố và điều phối tài nguyên. |
| `SH-MGT` | Đơn vị quản lý Khu đô thị ĐHQG-HCM | Hiệu quả phục vụ, mức sử dụng tài nguyên và khả năng mở rộng. |
| `SH-MNT` | Nhân viên kỹ thuật | Nhận thông tin sự cố và cập nhật kết quả xử lý ngoài thực tế. |

Stakeholder là bên sử dụng, quản lý, chịu ảnh hưởng hoặc quan tâm đến hệ thống. Stakeholder không nhất thiết xuất hiện trên use-case diagram.

### 3.2. Actor

| Mã | Tên trên UML | Mô tả |
|---|---|---|
| `ACT-STU` | Sinh viên | Người tìm và sử dụng xe dùng chung hoặc đặt chỗ đỗ, lịch sạc cho xe cá nhân. |
| `ACT-OPR` | Nhân viên vận hành | Người giám sát Hub, xử lý sự cố, điều phối tài nguyên và chạy mô phỏng. |
| `ACT-MNT` | Nhân viên kỹ thuật | Người tiếp nhận công việc kỹ thuật và xác nhận kết quả khắc phục sự cố. |
| `ACT-DAT` | Nguồn dữ liệu trạng thái | Hệ thống bên ngoài cung cấp dữ liệu cảm biến hoặc dữ liệu giả lập. |

Quy tắc sử dụng actor:

- Actor là vai trò, không phải tên một người cụ thể.
- Dùng đúng tên trong bảng trên ở requirement, use case và diagram.
- `Sinh viên dùng xe chung` và `Sinh viên có xe điện cá nhân` là hai ngữ cảnh sử dụng của `ACT-STU`, chưa tách thành actor mới nếu chưa có khác biệt rõ về quyền.
- Không đưa `Database`, `Controller`, `Service` hoặc giao diện web thành actor.
- Đồng hồ hệ thống hoặc tác vụ định kỳ được mô tả bằng trigger của non-interactive requirement, không mặc định tạo actor `Timer`.

### 3.3. Hệ thống và nguồn dữ liệu bên ngoài

| Mã | Tên | Vai trò |
|---|---|---|
| `EXT-STATE` | State Data Source | Cung cấp trạng thái xe, mức pin, chỗ đỗ, cổng sạc và sự kiện vận hành. |

Dữ liệu của `EXT-STATE` có thể đến từ cảm biến thật hoặc dữ liệu mô phỏng. Không mô tả phần cứng cụ thể nếu đề tài chưa yêu cầu.

## 4. Thuật ngữ nghiệp vụ chính

| Tên chuẩn | Tên tiếng Việt | Ý nghĩa |
|---|---|---|
| `MobilityHub` | Mobility Hub | Địa điểm tập hợp xe, chỗ đỗ và cổng sạc. |
| `Vehicle` | Phương tiện | Khái niệm chung cho phương tiện điện trong hệ thống. |
| `SharedVehicle` | Phương tiện dùng chung | Phương tiện thuộc mạng lưới và được sinh viên đặt để sử dụng. |
| `PrivateVehicle` | Phương tiện cá nhân | Phương tiện của sinh viên, sử dụng dịch vụ đỗ hoặc sạc. |
| `ParkingSpace` | Chỗ đỗ | Một vị trí đỗ cụ thể tại Hub. |
| `ChargingPoint` | Cổng sạc | Một tài nguyên sạc cụ thể tại Hub. |
| `VehicleReservation` | Lượt đặt phương tiện | Quyền giữ trước một phương tiện dùng chung trong thời hạn xác định. |
| `ParkingReservation` | Lượt đặt chỗ đỗ | Quyền giữ trước một chỗ đỗ cho phương tiện cá nhân. |
| `Trip` | Chuyến đi | Khoảng thời gian từ khi nhận xe đến khi trả xe. |
| `ChargingRequest` | Yêu cầu sạc | Nhu cầu sạc do sinh viên hoặc hoạt động vận hành tạo ra. |
| `ChargingSession` | Phiên sạc | Khoảng thời gian một phương tiện thực tế sử dụng cổng sạc. |
| `Incident` | Sự cố | Sự kiện làm tài nguyên hoặc quy trình không hoạt động bình thường. |
| `RedistributionPlan` | Kế hoạch điều chuyển | Kế hoạch chuyển phương tiện giữa các Hub. |
| `SimulationScenario` | Kịch bản mô phỏng | Tập đầu vào giả định dùng cho What-if Simulation. |
| `SimulationRun` | Lần chạy mô phỏng | Một lần thực thi kịch bản trên trạng thái mạng lưới xác định. |
| `Recommendation` | Khuyến nghị | Phương án điều phối được tạo từ trạng thái hoặc kết quả mô phỏng. |

## 5. Trạng thái chuẩn

Tên trạng thái trong requirement, use-case flow, state diagram, class và code phải giống nhau.

### 5.1. Tài nguyên

```text
VehicleStatus = Available | Reserved | InUse | Charging | OutOfService
ParkingSpaceStatus = Available | Reserved | Occupied | OutOfService
ChargingPointStatus = Available | Reserved | Charging | OutOfService
HubStatus = Normal | NearCapacity | Full | OutOfService
```

### 5.2. Quy trình nghiệp vụ

```text
VehicleReservationStatus = Pending | Confirmed | Fulfilled | Cancelled | Expired | Rejected
ParkingReservationStatus = Pending | Confirmed | CheckedIn | Completed | Cancelled | Expired | Rejected
TripStatus = InProgress | Completed | Interrupted
ChargingRequestStatus = Pending | Scheduled | Charging | Completed | Cancelled | Rejected
IncidentStatus = Open | Acknowledged | InProgress | Resolved | Closed
RedistributionPlanStatus = Draft | Recommended | Approved | InProgress | Completed | Cancelled
SimulationRunStatus = Draft | Running | Completed | Failed
```

Không tự thêm trạng thái `Busy`, `Used`, `Unavailable` hoặc `Done` để thay cho một trạng thái đã có. Trường hợp thực sự cần trạng thái mới phải nêu rõ sự kiện đưa đối tượng vào và ra khỏi trạng thái đó.

## 6. Quy tắc đặt mã

### 6.1. Mã theo phân hệ

```text
SUB-HUB
SUB-RES
SUB-TRIP
SUB-PARK
SUB-CHG
SUB-OPS
SUB-SIM
```

### 6.2. Mã cho phần tổng quan và đặc tả dự án

Các mã dưới đây giúp truy vết từ vấn đề ban đầu đến nhu cầu, user story và phạm vi đã chốt:

```text
PB-[SỐ]                 Vấn đề cần giải quyết
SH-[VAI TRÒ]            Stakeholder
SN-[VAI TRÒ]-[SỐ]       Nhu cầu của stakeholder
US-[PHÂN HỆ]-[SỐ]       User story
OBJ-[SỐ]                Mục tiêu dự án
SCP-IN-[SỐ]             Nội dung thuộc phạm vi
SCP-OUT-[SỐ]            Nội dung ngoài phạm vi
```

Ví dụ: `SN-STU-01`, `US-RES-01`, `OBJ-01`, `SCP-IN-01`. Mã stakeholder dùng tên viết tắt ổn định của vai trò, chẳng hạn `SH-STU`, `SH-OPR`, `SH-MNT` và `SH-MGT`. User story được đánh mã theo phân hệ chịu trách nhiệm chính; một user story có thể liên quan đến nhiều requirement nhưng không được đổi mã khi chỉnh câu chữ.

### 6.3. Functional requirement

Định dạng: `FR-[PHÂN HỆ]-[SỐ]`.

```text
FR-HUB-01
FR-RES-01
FR-TRIP-01
```

Mỗi FR chỉ mô tả một khả năng quan sát được của hệ thống. Câu chuẩn:

```text
FR-RES-01: Hệ thống phải cho phép Sinh viên đặt một phương tiện
đang ở trạng thái Available.
```

Không ghi giao diện, framework, API, database hoặc tên class vào FR nghiệp vụ.

### 6.4. Non-interactive functional requirement - bonus

Định dạng: `NIFR-[PHÂN HỆ]-[SỐ]`.

```text
NIFR-RES-01: Khi một lượt đặt phương tiện hết hạn, hệ thống phải tự động
chuyển lượt đặt sang Expired và giải phóng phương tiện.
```

NIFR vẫn mô tả hệ thống phải làm gì nhưng không bắt đầu trực tiếp từ thao tác của người dùng. Mỗi NIFR phải có trigger, điều kiện, xử lý và kết quả. Không nhầm `NIFR` với `NFR`: `NIFR` là chức năng tự động; `NFR` là yêu cầu chất lượng.

### 6.5. Business rule

Định dạng: `BR-[PHÂN HỆ]-[SỐ]`.

```text
BR-RES-01: Một phương tiện chỉ có tối đa một lượt đặt Confirmed
tại cùng một thời điểm.
```

BR phải là quy tắc, điều kiện, giới hạn hoặc bất biến nghiệp vụ. Không viết lại hành động của FR dưới một mã BR khác.

### 6.6. Use case

Định dạng: `UC-[PHÂN HỆ]-[SỐ]`.

```text
UC-HUB-01: Tra cứu Hub phù hợp
UC-RES-01: Đặt phương tiện dùng chung
UC-TRIP-01: Nhận phương tiện đã đặt
```

Tên use case dùng cấu trúc **động từ + đối tượng hoặc kết quả**. Không dùng tên quá rộng như `Quản lý hệ thống` và không tách thao tác nhỏ như `Nhấn nút xác nhận` thành use case.

### 6.7. Non-functional requirement

NFR dùng mã theo thuộc tính chất lượng, không theo phân hệ:

```text
NFR-PERF-01  Hiệu năng
NFR-SEC-01   Bảo mật và phân quyền
NFR-CON-01   Tính nhất quán
NFR-REL-01   Độ tin cậy và chịu lỗi
NFR-USA-01   Tính dễ sử dụng
NFR-AUD-01   Khả năng truy vết và audit
NFR-MNT-01   Khả năng bảo trì và mở rộng
```

Mỗi NFR phải có đối tượng áp dụng, tiêu chí đo, điều kiện đo và cách kiểm tra dự kiến.

```text
NFR-PERF-01: Danh sách Hub phải được hiển thị trong vòng 2 giây
trong điều kiện dữ liệu của môi trường demo.
```

### 6.8. Assumption và constraint

```text
ASM-GEN-01  Assumption áp dụng cho toàn hệ thống
ASM-CHG-01  Assumption của phân hệ sạc
CON-GEN-01  Constraint áp dụng cho toàn dự án
CON-SIM-01  Constraint của phân hệ mô phỏng
```

Assumption là điều nhóm tạm coi là đúng để tiếp tục phân tích. Constraint là giới hạn phải tuân theo do đề bài, thời gian, nguồn lực hoặc môi trường áp đặt.

### 6.9. Không tái sử dụng mã

- Mã tăng dần từ `01` trong từng nhóm.
- Không đổi số chỉ để sắp xếp lại tài liệu.
- Mục bị loại bỏ được đánh dấu `Deprecated`, không cấp mã đó cho nội dung mới.
- Một nội dung đổi tên nhưng không đổi bản chất thì giữ nguyên mã.
- Một nội dung bị tách thành hai thì giữ mã cũ cho phần chính và cấp mã mới cho phần còn lại.

## 7. Danh mục 18 use case của Submission 1

Danh mục này được giữ ở mức gần với báo cáo tham khảo: đủ bao phủ các luồng nghiệp vụ chính nhưng không tách các thao tác nhỏ thành use case độc lập. Cả 18 use case đều phải có use-case specification trong báo cáo nhóm. Mỗi thành viên sở hữu một phân hệ và chịu trách nhiệm cho toàn bộ use case của phân hệ đó.

Các mã bên dưới được xem là mốc chuẩn trước khi giao việc. Nếu cần gộp hoặc tách sau thời điểm này, chủ phân hệ phải báo nhóm trưởng để cập nhật đồng bộ requirement, diagram và traceability.

### HUB - Tra cứu Hub và tài nguyên

| ID | Tên use case |
|---|---|
| `UC-HUB-01` | Tra cứu Hub phù hợp |
| `UC-HUB-02` | Xem trạng thái tài nguyên tại Hub |
| `UC-HUB-03` | Xem Hub thay thế |

### RES - Đặt phương tiện dùng chung

| ID | Tên use case |
|---|---|
| `UC-RES-01` | Đặt phương tiện dùng chung |
| `UC-RES-02` | Hủy lượt đặt phương tiện |

### TRIP - Quản lý chuyến đi

| ID | Tên use case |
|---|---|
| `UC-TRIP-01` | Nhận phương tiện đã đặt |
| `UC-TRIP-02` | Trả phương tiện và kết thúc chuyến đi |

### PARK - Quản lý chỗ đỗ xe cá nhân

| ID | Tên use case |
|---|---|
| `UC-PARK-01` | Đặt chỗ đỗ cho xe cá nhân |
| `UC-PARK-02` | Check-in phương tiện cá nhân |
| `UC-PARK-03` | Check-out phương tiện cá nhân |

### CHG - Quản lý sạc và lịch sạc

| ID | Tên use case |
|---|---|
| `UC-CHG-01` | Đăng ký nhu cầu sạc |
| `UC-CHG-02` | Theo dõi lịch và phiên sạc |
| `UC-CHG-03` | Điều chỉnh lịch sạc ưu tiên |

### OPS - Giám sát và điều phối vận hành

| ID | Tên use case |
|---|---|
| `UC-OPS-01` | Giám sát mạng lưới Mobility Hub |
| `UC-OPS-02` | Xử lý sự cố vận hành |
| `UC-OPS-03` | Điều phối phương tiện giữa các Hub |

### SIM - What-if Simulation và khuyến nghị

| ID | Tên use case |
|---|---|
| `UC-SIM-01` | Chạy kịch bản What-if Simulation |
| `UC-SIM-02` | Phân tích kết quả và khuyến nghị điều phối |

## 8. Danh mục non-interactive functional requirement ban đầu - bonus

| ID | Trigger | Xử lý tự động |
|---|---|---|
| `NIFR-HUB-01` | Nhận dữ liệu trạng thái mới | Cập nhật mức sử dụng và tình trạng tài nguyên của Hub. |
| `NIFR-RES-01` | Lượt đặt phương tiện hết hạn | Chuyển lượt đặt sang `Expired` và giải phóng phương tiện. |
| `NIFR-PARK-01` | Lượt đặt chỗ đỗ hết hạn | Chuyển lượt đặt sang `Expired` và giải phóng chỗ đỗ. |
| `NIFR-CHG-01` | Danh sách chờ sạc thay đổi | Tính lại độ ưu tiên dựa trên mức pin và lịch sử dụng gần. |
| `NIFR-CHG-02` | Cổng sạc được lập lịch bị lỗi | Đánh dấu cổng sạc không khả dụng và tính lại lịch bị ảnh hưởng. |
| `NIFR-OPS-01` | Nhận sự kiện lỗi tài nguyên | Đánh dấu tài nguyên `OutOfService` và mở sự cố tương ứng. |
| `NIFR-OPS-02` | Mức sử dụng Hub vượt ngưỡng | Tạo cảnh báo nguy cơ quá tải cho Nhân viên vận hành. |
| `NIFR-SIM-01` | Một lần chạy mô phỏng hoàn tất | Tạo danh sách khuyến nghị điều phối từ kết quả mô phỏng. |

## 9. Quy tắc viết use-case specification

Mỗi use case chi tiết dùng đúng các trường sau:

```text
Use Case ID
Use Case Name
Owning Subsystem
Primary Actor
Supporting Actors
Goal
Trigger
Preconditions
Success Postconditions
Failure Postconditions
Main Flow
Alternative Flows
Exception Flows
Related Requirements
Related Business Rules
Dependencies
```

Quy tắc viết flow:

- Bước của actor và phản hồi của hệ thống phải tách rõ.
- Main flow chỉ mô tả luồng thành công thông thường.
- Alternative flow là cách hợp lệ khác để đạt mục tiêu.
- Exception flow mô tả tình huống lỗi hoặc không thể tiếp tục.
- Không ghi màu nút, vị trí màn hình, API, bảng database hoặc class.
- Mỗi flow phải kết thúc ở trạng thái xác định, không để `hệ thống xử lý phù hợp`.

## 10. Quy tắc cho use-case diagram

- Actor nằm ngoài system boundary; use case nằm bên trong.
- Diagram tổng quát thể hiện bảy phân hệ hoặc các nhóm use case chính.
- Mỗi phân hệ có diagram riêng nếu diagram tổng quát không thể đọc rõ.
- Association chỉ thể hiện actor tham gia use case, không thể hiện thứ tự.
- `include` dùng khi hành vi luôn xảy ra và được tái sử dụng.
- `extend` dùng khi hành vi chỉ bổ sung trong một điều kiện xác định.
- Lỗi nhập liệu, tài nguyên hết chỗ hoặc mất kết nối thường là exception flow; không tự động tách thành use case độc lập.
- Tên trên diagram phải giống hoàn toàn tên trong danh mục use case.

## 11. Traceability bắt buộc

Mỗi chủ phân hệ phải duy trì liên kết tối thiểu:

```text
Stakeholder Need
  -> Functional Requirement
  -> Business Rule
  -> Use Case
  -> Phase 2 Diagram
  -> Phase 3 Class/Method
  -> Test Case hoặc MVP
```

Bảng theo dõi dùng các cột:

| Subsystem | Use Case | Actor | FR | BR | Owner | Phase 2 | Phase 3 | MVP |
|---|---|---|---|---|---|---|---|---|

Không chấp nhận use case không liên kết với FR. Không chấp nhận FR không thuộc phạm vi hoặc không phục vụ nhu cầu stakeholder nào.

## 12. Quy tắc đặt tên file diagram

```text
ucd-system-overview.puml
ucd-hub.puml
ucd-res.puml
act-uc-res-01.puml
seq-uc-res-01.puml
stm-vehicle.puml
cls-res.puml
```

- `ucd`: use-case diagram;
- `act`: activity diagram;
- `seq`: sequence diagram;
- `stm`: state-machine diagram;
- `cls`: class diagram;
- dùng chữ thường và kebab-case;
- tên file có use case phải chứa đúng ID use case.

## 13. Quy trình thêm hoặc thay đổi nội dung

1. Thành viên ghi nội dung đề xuất, lý do và phần bị ảnh hưởng.
2. Nhóm trưởng kiểm tra trùng lặp và cấp mã tiếp theo.
3. Chủ phân hệ cập nhật requirement, use case và traceability của mình.
4. Nhóm trưởng cập nhật tài liệu quy ước nếu thay đổi ảnh hưởng toàn hệ thống.
5. Không sửa mã hoặc tên đã chốt trong diagram riêng mà chưa cập nhật nguồn chung.

Mục tiêu của quy trình này là cho phép từng thành viên làm độc lập mà sản phẩm vẫn ghép thành một hệ thống thống nhất.
