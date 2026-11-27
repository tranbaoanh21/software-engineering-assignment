# SUB-OPS — Giám sát và điều phối vận hành

> **Dự án:** Smart E-Mobility Hub (SEMH) · **Môn:** CO3001 · **Nhóm:** K24 Warriors · **Học kỳ:** 261  
> **Phạm vi:** UC-OPS-01 đến UC-OPS-05; thiết kế lớp và phương thức (Submission 3 / Final Report).  
> **Nguồn chuẩn:** [Final Report](../final-report/README.md), mục III.10, đặc biệt III.10.1–III.10.9 (trang in 159–196). Đây là tài liệu tóm tắt thiết kế, **không phải** cam kết mọi phương thức đã được hiện thực nguyên dạng trong code.

## 1. Vai trò và ranh giới

SUB-OPS phục vụ **nhân viên vận hành (ACT-OPR)** và **nhân viên kỹ thuật (ACT-MNT)** để theo dõi mạng lưới Hub, xử lý sự cố, điều chuyển xe và quản lý quyền phục vụ tài nguyên.

- **Thực thể SUB-OPS sở hữu:** `Incident`, `RedistributionPlan`.
- **Dịch vụ điều phối:** `OperationsService`.
- **Tài nguyên thuộc module khác:** `MobilityHub` (HUB), `SharedVehicle` (TRIP), `ParkingSpace` (PARK), `ChargingPoint` (CHG). SUB-OPS dùng `ResourceRef` và hợp đồng module sở hữu, không tạo bản sao thực thể hay trực tiếp ghi trạng thái vật lý.
- **Dịch vụ dùng chung:** kiểm tra quyền/phạm vi từ GEN; lưu thay đổi, receipt và audit trong giao dịch nhất quán.
- **Khuyến nghị từ SIM:** chỉ điền trước phương án cho OPR xem xét, không tự phê duyệt hay tác động trạng thái thật.

## 2. Use cases

| Mã | Chức năng | Kết quả và giới hạn chính |
| --- | --- | --- |
| **UC-OPS-01** | Giám sát mạng lưới Mobility Hub | Xem snapshot Hub, xe khả dụng, chỗ đỗ, cổng sạc, cảnh báo và Incident; lọc theo Hub/phạm vi. Dữ liệu cũ phải có thời điểm đồng bộ, lỗi nguồn không được giả thành dữ liệu rỗng. **Read-only.** |
| **UC-OPS-02** | Xử lý sự cố vận hành | Ghi nhận/chống trùng sự cố, tiếp nhận, giao MNT, ghi kết quả khắc phục, xác minh an toàn rồi đóng. Không tự khôi phục tài nguyên nếu thiếu bằng chứng kỹ thuật. |
| **UC-OPS-03** | Điều phối phương tiện giữa các Hub | Lập nháp, sửa, phê duyệt, ghi tiến độ và hoàn tất/hủy. Kiểm tra lại khả thi khi phê duyệt và trước tác động thực tế; `Approved` không có nghĩa xe đã di chuyển. |
| **UC-OPS-04** | Thêm và cập nhật thông tin tài nguyên | Tạo thiết bị dưới Hub hiện có ở `Draft`; cập nhật metadata đúng quyền và phiên bản; không ghi đè telemetry hoặc tự kích hoạt. |
| **UC-OPS-05** | Kích hoạt/ngừng phục vụ tài nguyên | Đổi `ServiceStatus` sau kiểm tra điều kiện và ràng buộc sử dụng; không tự hủy đặt xe, chuyến đi, sạc hay đổi `OutOfService` thành `Available`. |

### 2.1. Xử lý sự cố (UC-OPS-02)

```text
Open --(OPR tiếp nhận và phân loại)--> Acknowledged
Acknowledged --(MNT được giao bắt đầu)--> InProgress
InProgress --(kết quả kỹ thuật đạt, owner xác minh)--> Resolved
Resolved --(OPR xác nhận hoàn tất)--> Closed
```

- Khi tạo sự cố mới, kiểm tra sự cố đang mở để hạn chế bản ghi trùng; sự cố mới được gắn với tài nguyên và xử lý lỗi của owner trong giao dịch.
- Việc phân công/giao lại MNT **không tự chuyển** `Acknowledged` thành `InProgress`.
- Kết quả chưa đạt giữ `InProgress` và tài nguyên ngoài khả năng cấp phát.
- `TechnicalResult.serviceable = true` **không đồng nghĩa** `ServiceStatus = Active`; module sở hữu vẫn kiểm tra bằng chứng, tình trạng và các ràng buộc hiện hành.
- Với xe hỏng giữa chuyến, cần xử lý bàn giao và ràng buộc Trip trước khi phục hồi; không ghi đè trạng thái an toàn.

### 2.2. Kế hoạch điều chuyển (UC-OPS-03)

```text
Draft --> Approved --> InProgress --> Completed
   \          \             \
    +----------+-------------+----> Cancelled (trước khi Completed)
```

- `Draft`: khai báo Hub nguồn/đích, danh sách xe, thời gian và khuyến nghị tham chiếu (nếu có).
- `Approved`: OPR được phép duyệt và phương án vẫn khả thi: xe thuộc Hub nguồn, khả dụng, không bị giữ; Hub đích đủ sức chứa.
- `InProgress`: chỉ được ghi khi có thao tác thực hiện hợp lệ. Luồng tích hợp có thể giữ chỗ tiếp nhận ở Hub đích và ràng buộc xe để tránh cấp phát trùng.
- `Completed`: đối chiếu bằng chứng xe đến, cập nhật thông tin qua TRIP/HUB và ghi tiến độ theo giao dịch.
- `Cancelled`: đối chiếu xe chưa rời nguồn, đang vận chuyển hoặc đã đến; không tự hoàn tác việc vận chuyển vật lý đã xảy ra.

**Lưu ý về enum:** Danh mục trạng thái chung ở Phase 2 có `Recommended`; State Chart UC-OPS-03 không quy định sự kiện vào/ra trạng thái này. Khuyến nghị từ SIM không làm kế hoạch tự chuyển trạng thái hay tự được phê duyệt.

### 2.3. Trạng thái phục vụ (UC-OPS-05)

`ServiceStatus` gồm `Draft`, `Active`, `Inactive`, **độc lập với** `VehicleStatus`, `HubStatus` và dữ liệu IoT.

- Kích hoạt: phải đúng quyền, Hub cha đang `Active` (nếu có), có đủ bằng chứng và không còn lỗi chưa xử lý.
- Ngừng phục vụ: cần kiểm tra các ràng buộc đặt chỗ, chuyến đi, lịch/phiên sạc, kế hoạch điều chuyển; với Hub cần xét cả tài nguyên con.
- Chuyển sang chính trạng thái hiện tại không tạo cập nhật/audit thay đổi trùng.
- Không cho IoT tự đổi `Inactive` thành `Active`.

## 3. Thiết kế lớp

### 3.1. Lớp chính

| Lớp | Thuộc tính/kiểu chính | Trách nhiệm |
| --- | --- | --- |
| `OperationsService` | Dependencies: `AccessService`, `ResourceOwnerPort`, `OperationsQueryPort`, `OperationsRepository`, `TransactionPort`, `AuditService` | Điều phối năm UC, quyền Hub, quy tắc nghiệp vụ và giao dịch. |
| `Incident` | `incidentId: UUID`, `resourceRef: ResourceRef`, `severity: IncidentSeverity`, `status: IncidentStatus`, `technicianId?: UUID`, `technicalResult?: TechnicalResult`, các mốc thời gian, `version: Integer` | Bảo vệ vòng đời sự cố; chỉ `Resolved` khi kết quả kỹ thuật đạt và được kiểm tra. |
| `RedistributionPlan` | `planId: UUID`, `sourceHubId: UUID`, `destinationHubId: UUID`, `vehicleIds: List<UUID>`, `recommendationId?: UUID`, `scheduledAt: DateTime`, `status: PlanStatus`, các mốc thời gian, `lastProgress?: PlanProgress`, `version: Integer` | Bảo vệ vòng đời kế hoạch, trạng thái duyệt và ghi nhận tiến độ thực tế. |

### 3.2. Kiểu dữ liệu hỗ trợ

| Kiểu | Ý nghĩa |
| --- | --- |
| `ResourceRef` | `resourceType`, `resourceId`, `hubId`; tìm owner của tài nguyên. |
| `TechnicalResult` | Nguyên nhân, thao tác khắc phục, kiểm tra, `serviceable`, người và thời điểm xác minh. |
| `PlanProgress` | Ghi chú, `actualVehicleIds`, trạng thái hoàn tất và thời điểm ghi nhận. |
| `PlanPatch` | Các trường điều chỉnh khi kế hoạch còn `Draft`. |
| `ChangeContext` | `requestId`, `reason`, `expectedVersion`; chống lặp, audit và kiểm tra cạnh tranh. |
| `IncidentSeverity` | `Low`, `Medium`, `High`, `Critical` — các mức được cụ thể hóa trong thiết kế Submission 3. |
| `IncidentStatus` | `Open`, `Acknowledged`, `InProgress`, `Resolved`, `Closed`. |
| `PlanStatus` | `Draft`, `Approved`, `InProgress`, `Completed`, `Cancelled` trong mô hình nghiệp vụ SUB-OPS. |
| `ServiceStatus` | `Draft`, `Active`, `Inactive`; không phải trạng thái cảm biến. |

### 3.3. Các hợp đồng tích hợp

| Hợp đồng | Phạm vi |
| --- | --- |
| `AccessService` | Xác thực phiên, quyền và Hub scope; hợp đồng chuẩn GEN dùng `TargetRef`. |
| `OperationsQueryPort` | Đọc snapshot Hub, cảnh báo; không ghi dữ liệu. |
| `ResourceOwnerPort` | Đọc tài nguyên, tạo Draft, sửa metadata, đổi trạng thái phục vụ, báo lỗi/khôi phục đã xác minh thông qua owner. |
| `OperationsRepository` | Đọc/lưu `Incident` và `RedistributionPlan` với `expectedVersion`. |
| `TransactionPort` | Giao dịch nguyên tử, idempotency theo `requestId`, trả `ChangeReceipt`. |
| `AuditService` | Ghi nhật ký thay đổi trong cùng giao dịch nghiệp vụ. |

## 4. Phương thức thiết kế

Các chữ ký sau tóm lược nhóm phương thức trong **mục III.10.9.3 của Final Report**. Kiểu trả về thể hiện DTO hoặc đối tượng miền, không mặc định là một HTTP status code.

### 4.1. Domain methods

```ts
// Incident
acknowledge(level: IncidentSeverity, at: DateTime): void
assign(technicianId: UUID, dueAt: DateTime): void
startWork(technicianId: UUID): void
recordTechnicalResult(result: TechnicalResult): void
resolve(at: DateTime): void
close(at: DateTime): void

// RedistributionPlan
revise(patch: PlanPatch): void
approve(operatorId: UUID, at: DateTime): void
start(at: DateTime): void
updateProgress(progress: PlanProgress): void
complete(progress: PlanProgress, at: DateTime): void
cancel(reason: String): void
```

### 4.2. OperationsService — public API thiết kế

```ts
// UC-OPS-01
getNetworkOverview(session: SessionToken, filter: OverviewFilter): NetworkOverview

// UC-OPS-02
getIncident(session: SessionToken, id: UUID): IncidentView
reportIncident(session: SessionToken, input: IncidentInput, ctx: ChangeContext): IncidentView
acknowledgeIncident(session: SessionToken, id: UUID, severity: IncidentSeverity, ctx: ChangeContext): IncidentView
assignIncident(session: SessionToken, id: UUID, technicianId: UUID, dueAt: DateTime, ctx: ChangeContext): IncidentView
startIncidentWork(session: SessionToken, id: UUID, ctx: ChangeContext): IncidentView
submitTechnicalResult(session: SessionToken, id: UUID, result: TechnicalResult, ctx: ChangeContext): IncidentView
closeIncident(session: SessionToken, id: UUID, ctx: ChangeContext): IncidentView

// UC-OPS-03
prepareRedistribution(session: SessionToken, recommendation: Recommendation): RedistributionDraftInput
createRedistributionPlan(session: SessionToken, input: PlanInput, ctx: ChangeContext): PlanView
updateRedistributionPlan(session: SessionToken, id: UUID, patch: PlanPatch, ctx: ChangeContext): PlanView
approveRedistributionPlan(session: SessionToken, id: UUID, ctx: ChangeContext): PlanView
recordRedistributionProgress(session: SessionToken, id: UUID, progress: PlanProgress, ctx: ChangeContext): PlanView
cancelRedistributionPlan(session: SessionToken, id: UUID, ctx: ChangeContext): PlanView

// UC-OPS-04
getManagedResources(session: SessionToken, scope: UUID): List<ResourceSummary>
createResource(session: SessionToken, input: ResourceDraftInput, ctx: ChangeContext): ResourceSummary
updateResource(session: SessionToken, ref: ResourceRef, patch: ResourcePatch, ctx: ChangeContext): ResourceSummary

// UC-OPS-05
getResourceServiceState(session: SessionToken, ref: ResourceRef): ResourceSummary
setResourceServiceStatus(session: SessionToken, ref: ResourceRef, target: ServiceStatus, ctx: ChangeContext): ResourceSummary
getChangeResult(session: SessionToken, requestId: UUID): ChangeReceipt
```

Các helper riêng của `OperationsService` gồm `requirePermission(...)`, `validatePlanFeasibility(...)` và `validateServiceStatusChange(...)`. Chúng không thay thế kiểm tra quyền và ràng buộc **bên trong** giao dịch khi thực hiện command.

### 4.3. ResourceOwnerPort — thao tác ghi trong transaction

```ts
getResource(ref: ResourceRef): ResourceSummary
checkConstraints(tx: Transaction, ref: ResourceRef, target: ServiceStatus): ConstraintResult
createDraft(tx: Transaction, input: ResourceDraftInput, change: ChangeContext): ResourceSummary
updateMetadata(tx: Transaction, ref: ResourceRef, patch: ResourcePatch, change: ChangeContext): ResourceSummary
changeServiceStatus(tx: Transaction, ref: ResourceRef, target: ServiceStatus, change: ChangeContext): ResourceSummary
reportFault(tx: Transaction, ref: ResourceRef, incidentId: UUID, change: ChangeContext): ResourceSummary
applyVerifiedRecovery(tx: Transaction, ref: ResourceRef, incidentId: UUID, result: TechnicalResult, change: ChangeContext): ResourceSummary
```

Các lời gọi có `tx` là **lời gọi nội bộ** trong transaction của application service, không phải endpoint gọi trực tiếp từ client. `ChangeContext.expectedVersion` phải áp dụng đúng **thực thể đích**: phiên bản `Incident`/`Plan` không được dùng nhầm cho phiên bản của tài nguyên thuộc owner.

## 5. Quy tắc giao dịch, an toàn và lỗi

1. **Phân quyền:** mọi truy vấn/command phải xác minh quyền và Hub scope. Command cần kiểm tra lại trong transaction.
2. **Đồng thời:** kiểm tra trạng thái và các bindings còn hiệu lực trong PostgreSQL transaction có mức cô lập phù hợp (thiết kế sử dụng `Serializable`); kiểm soát `version` theo thực thể. Khi xung đột, rollback và không ghi đè cập nhật mới hơn.
3. **Nguyên tử:** cập nhật nghiệp vụ, trạng thái tài nguyên liên quan, audit và receipt phải thống nhất; lỗi một bước không tạo trạng thái từng phần.
4. **Idempotency:** dùng `requestId` để tra biên nhận trước khi gửi lại command nếu phản hồi không rõ; lệnh trùng không được tạo bản ghi hoặc audit thay đổi trùng.
5. **Telemetry:** dữ liệu sự kiện đến muộn không được ghi đè trạng thái mới hơn; telemetry không có quyền trực tiếp kích hoạt `ServiceStatus`.
6. **Dữ liệu giám sát:** trả cảnh báo stale/thiếu dữ liệu đúng thực tế, không suy đoán `Available` hay làm như hệ thống không có cảnh báo.
7. **Không vận chuyển giả:** kế hoạch và khuyến nghị không tự thay đổi vị trí xe. Xác nhận khởi hành/đến nơi cần bằng chứng và owner xử lý.

## 6. Kịch bản kiểm tra cần ưu tiên

| Kịch bản | Kết quả mong đợi |
| --- | --- |
| OPR mở dashboard nhưng mất nguồn telemetry | Giữ snapshot hợp lệ gần nhất kèm dấu thời gian/cảnh báo, không làm như dữ liệu rỗng. |
| Hai nguồn cùng báo một lỗi tài nguyên | Liên kết/chống trùng sự cố đang mở; không tạo hai `Incident` cùng một lỗi. |
| MNT gửi kết quả `serviceable = false` | Incident vẫn `InProgress`, tài nguyên không bị cấp phát. |
| OPR duyệt plan khi xe vừa được đặt | Từ chối, giữ `Draft`, trả nguyên nhân; không ghi đè lượt đặt. |
| OPR ngừng Hub khi có con đang được sử dụng | Từ chối; không tự hủy các nghiệp vụ đang chạy. |
| Hai command sửa cùng version | Chỉ một commit hợp lệ; command còn lại nhận xung đột. |
| Client mất phản hồi sau commit | Tra kết quả bằng `requestId`, không chạy lại thao tác. |
| Xe đến Hub đích trong kế hoạch điều chuyển | Xác minh bằng chứng; cập nhật owner, khả năng tiếp nhận và tiến độ nhất quán. |

> Đây là **các kịch bản cần kiểm chứng**, không phải kết quả test đã chạy. Tham khảo thêm phần Test Case (Bonus) của Final Report.

## 7. Tài liệu đối chiếu

- [Final Report — báo cáo đã chốt](../final-report/README.md), mục III.10.1–10.9 (SUB-OPS) và mục IV.4.2–IV.5 (tích hợp/giao dịch).
- [Báo cáo Phase 3](README.md) và [quy ước thiết kế](design-conventions.md).
- [Nguồn sơ đồ PlantUML Phase 3](diagrams/plantuml/) và [Class Diagram](diagrams/class/).
- [Quy định chung của repository](../../AGENTS.md).

**Phạm vi tài liệu:** mô tả đặc tả và thiết kế nhóm đã đưa vào báo cáo. Để xác nhận endpoint, tên lớp và hành vi đang chạy trên demo, cần đối chiếu thêm mã nguồn tại `apps/api/src/modules/` và kiểm thử thực tế; không mặc định mã nguồn trùng hoàn toàn với chữ ký UML.
