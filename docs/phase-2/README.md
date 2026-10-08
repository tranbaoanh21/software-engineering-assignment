# Submission 2 - Giao diện và biểu đồ hành vi

Bản khung dùng để thống nhất bố cục bài nộp của nhóm. Các mục đã có số thứ tự, mục lục, danh sách hình và vị trí điền nội dung; nội dung trong ngoặc vuông được thay bằng bài làm khi tổng hợp.

[Đọc PDF khung báo cáo](group-report/output/pdf/phase-2-group-report-outline.pdf).

[Thuật ngữ dùng chung — Submission 2](uml-conventions.md): tên và mã phân hệ, actor, hệ thống ngoài, đối tượng nghiệp vụ, thành phần trong sequence và trạng thái để dùng thống nhất khi vẽ sơ đồ.

## Nội dung báo cáo

1. **Thiết kế giao diện tổng thể:** đăng nhập và kiểm soát truy cập, bố cục theo ba vai trò, thành phần và trạng thái giao diện dùng chung, luồng điều hướng tổng quát.
2. **Thiết kế giao diện và hành vi theo phân hệ:** bảy phân hệ, giữ nguyên mã và tên của 18 use case ở Submission 1. Mỗi use case có ba mục: UI Mockup, Sequence Diagram và Activity Diagram; mỗi mục có hình và phần giải thích. State chart của các đối tượng nghiệp vụ được đặt sau các use case trong phân hệ tương ứng.

Vòng đời `SharedVehicle` được đặt cuối SUB-TRIP, sau state chart của `Trip`. Hình bao quát các chuyển trạng thái liên quan đến đặt xe, chuyến đi, sạc và xử lý sự cố; chỉ xuất hiện một lần, không tách thành chương riêng.

Mục lục hiển thị đến tên use case và đối tượng có state chart. Các đề mục UI, sequence và activity vẫn có số thứ tự trong nội dung nhưng không lặp lại trên mục lục.

Theo đề bài, UI Mockup là group work; Sequence Diagram và Activity Diagram là individual work; State-chart Diagram là bonus. Nhóm thống nhất chuẩn bị mockup và cặp sequence/activity cho toàn bộ 18 use case. Phần state chart là nội dung bổ sung, không phải điều kiện bắt buộc của Submission 2.

Báo cáo không có chương baseline, ma trận truy vết, checklist, hướng dẫn làm việc hay working demonstration. Phần demonstration bằng chuỗi màn hình thuộc báo cáo cuối theo đề.

## Phần mỗi thành viên chuẩn bị

Cả bảy thành viên cùng làm UI Mockup website trên Figma, gồm giao diện dùng chung ở Phần I và giao diện của 18 use case ở Phần II. Nhóm cùng đề xuất mẫu, chọn một bộ giao diện và chỉnh sửa trên file chung; thống nhất màu sắc, kiểu chữ, thành phần và luồng điều hướng. UI trong từng phân hệ vẫn là phần làm chung, không giao riêng theo bảng dưới.

Phần thiết kế hành vi mới chia riêng theo phân hệ: mỗi thành viên chuẩn bị sequence, activity, state chart nếu có và phần giải thích tương ứng.

| Thành viên | Phân hệ | Use case | State chart |
| --- | --- | --- | --- |
| Nguyễn Quốc Trung | SUB-HUB | UC-HUB-01, UC-HUB-02, UC-HUB-03 | Không thêm state chart riêng cho thao tác tra cứu |
| Phan Võ Bảo Trâm | SUB-RES | UC-RES-01, UC-RES-02 | `VehicleReservation` |
| Lê Nguyễn Tường Vi | SUB-TRIP | UC-TRIP-01, UC-TRIP-02 | `Trip`, `SharedVehicle` |
| Nguyễn Ngọc Hân | SUB-PARK | UC-PARK-01, UC-PARK-02, UC-PARK-03 | `ParkingReservation`, `ParkingSpace` |
| Trần Thị Hương Giang | SUB-CHG | UC-CHG-01, UC-CHG-02, UC-CHG-03 | `ChargingRequest`, `ChargingSession`, `ChargingPoint` |
| Nguyễn Thị Minh Anh | SUB-OPS | UC-OPS-01, UC-OPS-02, UC-OPS-03 | `Incident`, `RedistributionPlan` |
| Trần Nhật Bảo Anh | SUB-SIM | UC-SIM-01, UC-SIM-02 | `SimulationRun` |

Trần Nhật Bảo Anh tổng hợp và kiểm soát nội dung báo cáo. Mỗi thành viên hoàn thành phần thiết kế hành vi của phân hệ mình, đồng thời cùng cả nhóm hoàn thiện UI để thông tin hiển thị, thao tác và phản hồi khớp với Submission 1.

Mockup đăng nhập dùng chung đặt tại `mockups/ui-login.pdf`, gồm thông báo sai thông tin, hết phiên, thiếu quyền và thao tác đăng xuất. Tài khoản cùng vai trò được cấp sẵn; không thêm đăng ký, khôi phục mật khẩu, OTP hoặc tự chọn vai trò. Ba UC của SUB-HUB cho phép tra cứu công khai; 15 UC còn lại kiểm tra phiên và quyền trước truy cập dữ liệu. Sequence/activity thể hiện nhánh từ chối theo `FR-GEN-03`, không chép lại quy trình đăng nhập trong từng UC. Phiên hết hiệu lực sau đăng xuất hoặc 30 phút không có yêu cầu được bảo vệ hợp lệ; nghiệp vụ đang chạy không tự bị hủy.

Với mỗi use case, gửi sequence diagram và giải thích tương tác, activity diagram và giải thích các nhánh. Nội dung phải dựa trên luồng chính, luồng thay thế và luồng ngoại lệ của bản Submission 1 đã chốt. Giữ nguyên actor, thuật ngữ và tên trạng thái; dữ liệu IoT đi qua `EXT-STATE/ACT-DAT`, dịch vụ bản đồ qua `EXT-MAP/ACT-MAP` khi có liên quan.

State chart mô tả toàn bộ vòng đời của đối tượng, bao gồm các chuyển do use case, sự kiện bên ngoài và thời gian tự động. Mỗi đối tượng có một hình; không tách vòng đời thành các hình rời cho từng use case. Ví dụ `VehicleReservation` được trình bày tại SUB-RES; use case nhận xe trong SUB-TRIP sử dụng cùng mô hình đó. `SharedVehicle` đặt tại SUB-TRIP, do Lê Nguyễn Tường Vi thực hiện, gồm cả các chuyển do SUB-RES, SUB-CHG và SUB-OPS. Khi giải thích một UC, có thể dẫn đến hình trạng thái liên quan thay vì chép lại hình.

Thành viên có thể gửi nội dung bằng Docs, DOCX hoặc Markdown và đính kèm nguồn sơ đồ để nhóm trưởng tổng hợp sang LaTeX. Mockup dùng chung có thể đặt một lần rồi dẫn đến cùng hình trong các mục sử dụng nó; bổ sung hình khác khi cần trình bày nhiều màn hình hoặc nhiều nhánh.

## Tệp để điền nội dung

```text
group-report/
├── main.tex
├── cover-page.tex
├── sections/
│   ├── 01-ui-design.tex
│   ├── 02-use-case-design.tex
│   └── use-cases/
│       ├── 01-sub-hub.tex
│       ├── 02-sub-res.tex        UC và vòng đời VehicleReservation
│       ├── 03-sub-trip.tex       UC và vòng đời Trip, SharedVehicle
│       ├── 04-sub-park.tex       UC và vòng đời ParkingReservation, ParkingSpace
│       ├── 05-sub-chg.tex        UC và vòng đời yêu cầu, phiên và cổng sạc
│       ├── 06-sub-ops.tex        UC và vòng đời Incident, RedistributionPlan
│       └── 07-sub-sim.tex        UC và vòng đời SimulationRun
└── output/pdf/phase-2-group-report-outline.pdf

mockups/                         UI theo vai trò và theo use case
diagrams/sequence/               Sequence diagram
diagrams/activity/               Activity diagram
diagrams/state/                  State-chart diagram (bonus)
```

Mỗi use case có các mục LaTeX riêng để thay hình và lời giải thích trực tiếp. Ví dụ với UC-HUB-01:

- Mockup: `mockups/uc-hub-01.pdf`.
- Sequence: `diagrams/sequence/uc-hub-01.pdf`.
- Activity: `diagrams/activity/uc-hub-01.pdf`.

Các lệnh `\InsertArtifact` đã chỉ đến đường dẫn tương ứng. Khi có hình PDF, biên dịch sẽ tự chèn hình; khi chưa có, báo cáo hiển thị lời nhắc trong ngoặc vuông, không vẽ khung chữ nhật giả sơ đồ. Có thể thêm lệnh chèn hình cho các màn hình hoặc sơ đồ bổ sung và chỉnh đường dẫn khi dùng tên tệp khác. Giữ nguồn sơ đồ để sửa về sau; quy tắc vẽ PlantUML nằm ở [hướng dẫn chung](../phase-1/diagrams/plantuml/README.md).

Hình giữ nguyên tỉ lệ và được giới hạn theo chiều rộng trang, không kéo giãn. Chiều cao tối đa mặc định là `0.68\textheight`; có thể chọn riêng cho hình dài bằng `\InsertArtifact[0.80\textheight]{đường-dẫn}{chú-thích}{nhãn}{placeholder}`. Mỗi state chart đã có đường dẫn PDF riêng ở `diagrams/state/`, và không đổi đường dẫn khi chuyển vị trí trình bày.

## Biên dịch

```bash
cd docs/phase-2/group-report
latexmk -xelatex -interaction=nonstopmode -halt-on-error \
  -jobname=phase-2-group-report-outline -outdir=output/pdf main.tex
```

Deadline trên LMS: **25/10/2026**. Review dự kiến trên lớp: **Tuần 11**.
