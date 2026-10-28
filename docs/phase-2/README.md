# Submission 2 - Báo cáo tích hợp phân tích và thiết kế

Submission 2 được soạn tiếp trên nội dung Submission 1, không nộp một báo cáo chỉ có UI và diagram mới. Bản đã nộp Submission 1 trong `docs/phase-1/` được giữ nguyên; bản đang làm tiếp nằm trong `docs/phase-2/group-report/`.

[Đọc báo cáo tích hợp](group-report/output/pdf/phase-2-group-report-outline.pdf). Tên tệp PDF được giữ để không làm hỏng các liên kết đã chia sẻ; nội dung bên trong đã chuyển sang bố cục tích hợp.

- [Thuật ngữ dùng chung](uml-conventions.md): tên phân hệ, actor, đối tượng, thành phần và trạng thái.
- [Danh sách màn hình website](ui-screen-inventory.md): màn hình, form và các trạng thái cần thiết kế trên Figma.
- [Bảy báo cáo cá nhân](individual-work/README.md): bản trích theo phân công, dùng trực tiếp nội dung và hình của báo cáo nhóm; GEN nằm trong báo cáo Bảo Anh dưới nhãn nội dung chung.

## Bố cục báo cáo

1. **Phần I - Tổng quan và đặc tả dự án:** kế thừa Submission 1, cập nhật vai trò và phạm vi Admin.
2. **Phần II - Yêu cầu hệ thống:** kế thừa BR, FR, NIFR, NFR; cập nhật quản trị và phân quyền dùng chung.
3. **Phần III - Mô hình, đặc tả và thiết kế use case:**
   - Mô hình toàn hệ thống: Actor Catalog, danh mục 23 use case và use-case diagram tổng quát.
   - Thiết kế giao diện dùng chung: đăng nhập, điều hướng theo vai trò, thành phần và trạng thái giao diện.
   - Nhóm quản trị dùng chung GEN: UC-GEN-01, UC-GEN-02, UC-GEN-03; không phải phân hệ thứ tám.
   - Bảy phân hệ SUB-HUB, SUB-RES, SUB-TRIP, SUB-PARK, SUB-CHG, SUB-OPS và SUB-SIM.

Trong mỗi use case, nội dung được đặt liền nhau theo thứ tự:

1. Use-case Diagram.
2. Use Case Specification.
3. UI Mockup.
4. Sequence Diagram.
5. Activity Diagram.

State chart đặt sau các use case trong phân hệ quản lý đối tượng. Vòng đời `SharedVehicle` đặt tại SUB-TRIP và chỉ xuất hiện một lần, dù có chuyển trạng thái liên quan đến RES, CHG và OPS. Không tách trạng thái thành một phần riêng hoặc lặp một vòng đời dưới nhiều use case.

Mục lục hiển thị mô hình toàn hệ thống, các mục giao diện dùng chung, tên use case và đối tượng có state chart. Các đề mục bên trong mỗi use case có số trong nội dung nhưng không làm mục lục dài thêm.

## Nội dung đã hoàn thiện

Nội dung phân tích của Submission 1, sơ đồ use case và bảng đặc tả được tích hợp cùng mockup và diagram Phase 2. Đã bổ sung đủ hình SUB-PARK và SUB-CHG theo khung hiện tại: 12 sequence/activity và 5 state chart. Hai state chart ChargingSession/ChargingPoint được bổ sung khi tổng hợp. Các hình được chèn nguyên vẹn trên trang A4 dọc; báo cáo dùng PDF vector để người đọc phóng to.

Đã cập nhật riêng việc phân biệt `ACT-ADM` và `ACT-OPR` theo quyết định của nhóm: stakeholder, phạm vi, FR/BR dùng chung, bảng quyền, Actor Catalog, sơ đồ context/tổng quát và convention. Admin phụ trách tài khoản, quyền và danh mục ban đầu; không mặc nhiên kế thừa quyền vận hành hoặc kỹ thuật. Sơ đồ mới nằm trong `diagrams/system/`, không ghi đè Submission 1 đã nộp.

Đã bổ sung UC-OPS-04/05 và UC-GEN-01/02/03 với đặc tả, use-case diagram, sequence, activity, UI và prototype Figma; thêm state Account và ServiceStatus. Tổng danh mục là 23 UC, các mã cũ giữ nguyên. Admin và Operator tách quyền; thêm/sửa/bật/tắt không ghi đè telemetry. Quan hệ include/extend và phân loại AF/EF cũ giữ nguyên; chưa chốt MVP. Đây là bản phân tích, thiết kế và prototype; không đồng nghĩa đã hiện thực backend, thiết bị hoặc kiểm thử runtime.

Bản rút gọn giữ đủ các UC và hình, bỏ metadata lặp trong bảng đặc tả và ghép UI vào khoảng trống phù hợp. Quy tắc hết hạn chỗ đỗ không ghi đè OutOfService hoặc check-in cạnh tranh. Lịch sạc demo được xác định tại BR-CHG-01 đến BR-CHG-04: ưu tiên/FIFO, thời lượng ước tính, cổng tương thích và hạn mức công suất Hub. Chỉ cập nhật bản tích hợp Submission 2, không sửa bản Submission 1 đã nộp hoặc các tệp nguồn thành viên.

Không thêm chương checklist, ma trận truy vết hoặc hướng dẫn làm việc vào PDF báo cáo. Nội dung hướng dẫn tổng hợp chỉ nằm trong README này.

## Phân công

UI Mockup website do cả bảy thành viên cùng làm trên Figma, gồm giao diện dùng chung và màn hình của các use case. Sequence, activity và state chart được phân công theo phân hệ:

| Thành viên | Phân hệ | Use case | State chart |
| --- | --- | --- | --- |
| Nguyễn Quốc Trung | SUB-HUB | UC-HUB-01, UC-HUB-02, UC-HUB-03 | Không thêm state chart cho thao tác tra cứu |
| Phan Võ Bảo Trâm | SUB-RES | UC-RES-01, UC-RES-02 | `VehicleReservation` |
| Lê Nguyễn Tường Vi | SUB-TRIP | UC-TRIP-01, UC-TRIP-02 | `Trip`, `SharedVehicle` |
| Nguyễn Ngọc Hân | SUB-PARK | UC-PARK-01, UC-PARK-02, UC-PARK-03 | `ParkingReservation`, `ParkingSpace` |
| Trần Thị Hương Giang | SUB-CHG | UC-CHG-01, UC-CHG-02, UC-CHG-03 | `ChargingRequest`, `ChargingSession`, `ChargingPoint` |
| Nguyễn Thị Minh Anh | SUB-OPS | UC-OPS-01–UC-OPS-05 | `Incident`, `RedistributionPlan` |
| Trần Nhật Bảo Anh | SUB-SIM | UC-SIM-01, UC-SIM-02 | `SimulationRun` |

Phần I do Bảo Anh phụ trách, Phần II do Quốc Trung phụ trách, mô hình use case toàn hệ thống do Tường Vi phụ trách. Bảo Anh tổng hợp báo cáo. State chart là bonus theo đề bài.

## Tệp đang làm tiếp

```text
group-report/
├── main.tex
├── cover-page.tex
├── sections/
│   ├── 01-project-details.tex     Phần I
│   ├── 02-requirements.tex        Phần II
│   ├── 02-use-case-design.tex     Ghép toàn bộ Phần III
│   ├── 01-ui-design.tex           Giao diện dùng chung trong Phần III
│   └── use-cases/
│       ├── 00-common-administration.tex
│       ├── 00-system-model.tex
│       ├── 01-sub-hub.tex
│       ├── 02-sub-res.tex
│       ├── 03-sub-trip.tex
│       ├── 04-sub-park.tex
│       ├── 05-sub-chg.tex
│       ├── 06-sub-ops.tex
│       └── 07-sub-sim.tex
└── output/pdf/phase-2-group-report-outline.pdf

mockups/                          UI dùng chung và theo use case
diagrams/sequence/                Sequence diagram
diagrams/activity/                Activity diagram
diagrams/state/                   State chart
```

Các tên tệp `01-ui-design.tex` và `02-use-case-design.tex` được giữ để tiếp tục sử dụng những đường dẫn đang có; số phần trong PDF do cấu trúc LaTeX quyết định, không phụ thuộc tiền tố tên tệp.

Phần I, II và nội dung phân tích của từng use case đã được đưa vào nguồn Submission 2. Từ đây điền và sửa trên các tệp trong Phase 2, không sửa ngược bản đã nộp Phase 1. Hình use case vẫn dùng các tài sản có sẵn tại `docs/phase-1/diagrams/plantuml/output/`; nếu cần sửa hình cho Submission 2, xuất bản mới vào thư mục Phase 2 và đổi đường dẫn hình tương ứng.

## Chèn nội dung

Mỗi use case có sẵn bảng đặc tả và các vị trí thêm mockup, sequence, activity. Không tạo lại một mục use case thứ hai ở cuối báo cáo.

Ví dụ UC-HUB-01:

- UI: `mockups/uc-hub-01.pdf`.
- Sequence và activity: dùng đường dẫn đã ghi trong `sections/use-cases/01-sub-hub.tex`.
- Những ảnh JPG của SUB-HUB và PDF vector của SUB-SIM đã chèn được giữ nguyên.

Lệnh `\InsertArtifact` chèn hình nếu tệp tồn tại; nhánh dự phòng không tạo hình giả hoặc lời nhắc trong bản nộp. Hiện các tệp hình được tham chiếu trong phần use case đều đã có. Giữ nguồn sơ đồ để sửa về sau và tuân theo [quy tắc PlantUML](../phase-1/diagrams/plantuml/README.md).

Hình giữ nguyên tỉ lệ. Các sequence/activity dài của HUB và SIM vẫn để nguyên một hình trên trang A4 dọc, giới hạn chiều cao riêng cho từng hình. Không chia hình thành nhiều diagram nhỏ.

## Biên dịch

```bash
cd docs/phase-2/group-report
latexmk -xelatex -interaction=nonstopmode -halt-on-error \
  -jobname=phase-2-group-report-outline -outdir=output/pdf main.tex
```

Bản PDF chuẩn để kiểm tra và tổng hợp là tệp trong `output/pdf/`. Bản `main.pdf` cũ đã được chuyển vào kho local để tránh nhầm với bản nộp.

## Lưu trữ bài gốc và tài sản

Bài gốc của sáu thành viên được giữ nguyên trong `local/phase-2-submissions/` tại máy tổng hợp và không đưa vào Git. Báo cáo sử dụng bản đã tích hợp trong `diagrams/` và `mockups/`; các mã PlantUML có thể chỉnh sửa được giữ trong `diagrams/plantuml/`. Bộ logo SEMH nằm ở `assets/branding/` tại root dự án. Tệp tạm LaTeX và ảnh kiểm tra không nằm trong bộ tài liệu nộp.

Deadline trên LMS: **25/10/2026**. Review dự kiến trên lớp: **Tuần 11**.
