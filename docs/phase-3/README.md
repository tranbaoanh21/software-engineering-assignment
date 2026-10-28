# Phase 3 - System Design

Báo cáo Phase 3 là tài liệu thiết kế riêng, chưa ghép lại Phase 1–2. Đầu vào là báo cáo Phase 2 đã chốt: **23 use case, bảy phân hệ, GEN dùng chung và bốn vai trò người dùng**.

- [Khung báo cáo PDF](group-report/output/pdf/phase-3-group-report-outline.pdf)
- [Nguồn chính](group-report/main.tex)
- [Kiến thức nền Phase 3](design-guide/output/pdf/phase-3-design-guide.pdf)
- [Nguồn tài liệu học và cách compile](design-guide/README.md)

## Bố cục báo cáo

1. Cơ sở và quyết định kiến trúc.
2. Deployment View: môi trường, sơ đồ, node/artifact, kết nối, cấu hình và xử lý gián đoạn.
3. Development/Implementation View: module, phụ thuộc, interface, xử lý nền và cơ chế dùng chung.
4. Thiết kế lớp và phương thức: sơ đồ tổng thể; GEN và bảy phân hệ. Mỗi phạm vi có class diagram, mô tả lớp, đặc tả phương thức và các UC được hỗ trợ.
5. Test Case (bonus): chiến lược, đặc tả, từng phạm vi nghiệp vụ, NFR và kết quả khi thực thi.

Đã đồng bộ UC-GEN-01/02/03, UC-OPS-04/05; không thêm trạng thái hủy cho SimulationRun. Không dùng các mã SCR tự đặt khác với danh mục màn hình Phase 2.

## Nội dung chung đã điền

Các bảng chung nằm ngay trong báo cáo: 18 đối tượng nghiệp vụ, 14 tập trạng thái, tên UI/service, quy ước UML, kiểu dữ liệu/đơn vị, OperationContext, OperationResult/OperationError, StateEvent/AuditEntry, owner logic của lớp, xử lý nền và cơ chế cạnh tranh/quyền/audit. Các ngưỡng NFR và kịch bản kiểm tra dùng đúng baseline Phase 2 hiện hành.

Nguồn dùng chung nằm trong `group-report/sections/common/`; các file này được input trực tiếp vào Phần I và IV, không cần chép lại trong từng phân hệ. Các kiểu kỹ thuật mới là quy ước thiết kế Phase 3, không phải use case hoặc trạng thái nghiệp vụ mới.

Công nghệ, runtime, provider map, lưu trữ vật lý, topology và các sơ đồ/phương thức chi tiết còn chờ nhóm lựa chọn và phân công. Tên package/module là quy ước logic, không khóa kiến trúc deploy hoặc stack.

## Cách điền và chuẩn bị phân việc

- Phân công Submission 3 sẽ được nhóm trưởng chốt sau. Bảng thành viên trong PDF ghi phạm vi kế thừa Submission 2, không coi đó là quyết định phân việc Phase 3 mới.
- Phần kiến trúc và class diagram tổng thể cần thống nhất chung. GEN cùng các hợp đồng dữ liệu dùng chung được tổng hợp tại một nơi.
- Các file của bảy phân hệ giữ thứ tự và mã cũ để thuận tiện giao việc.
- Mỗi phạm vi có một file trong `group-report/sections/class-design/`.
- Chỉnh trực tiếp các trường trong bảng; lặp môi trường `ClassDescription` cho từng lớp, `MethodDescription` cho từng phương thức. Không có giới hạn năm trường cố định như macro UC cũ.
- Mọi operation được khai báo trên class diagram đều phải có mô tả, gồm interface, tác vụ nền và helper được vẽ. Không giới hạn ở entry point của UC.
- Class dùng chung định nghĩa tại một owner, các phân hệ khác tham chiếu. SharedVehicle giữ tại phần TRIP; định nghĩa thêm phải được nhóm thống nhất.
- Test case là bonus. Kết quả thực tế và Pass/Fail chỉ điền khi đã chạy.

Các hướng dẫn điền nằm trong comment LaTeX. PDF có nội dung chung đã soạn và placeholder ngắn cho phần còn chờ thực hiện; không vẽ khung chữ nhật thay hình, không lặp lại UC specification của Phase 1.

## Vị trí sơ đồ

- `architecture/deployment-view.pdf`
- `architecture/implementation-view.pdf`
- `diagrams/class/system-class-overview.pdf`
- `diagrams/class/00-gen.pdf` và `01-sub-hub.pdf` tới `07-sub-sim.pdf`

Đây là các đường dẫn dự kiến được gọi bởi nguồn LaTeX, chưa phải sơ đồ đã hoàn thành. Chưa có file hình thì PDF hiển thị placeholder ngắn. Với PlantUML, giữ source và xuất SVG/PDF vector theo quy chuẩn chung.

## Biên dịch

```bash
cd docs/phase-3/group-report
latexmk -xelatex -interaction=nonstopmode -halt-on-error -file-line-error \
  -jobname=phase-3-group-report-outline -outdir=output/pdf main.tex
```

PDF chuẩn nằm trong `output/pdf/`. Khi đã hoàn tất, các phần thiết kế có thể ghép vào báo cáo tổng hợp, không phải viết lại định nghĩa lớp/phương thức theo từng UC.
