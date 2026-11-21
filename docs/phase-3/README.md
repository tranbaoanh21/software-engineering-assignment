# Phase 3 — System Design

Thiết kế kế thừa 23 UC, bảy phân hệ, GEN và bốn vai trò người dùng từ Submission 2.

- [Báo cáo Phase 3 riêng — 72 trang](group-report/output/pdf/phase-3-group-report-outline.pdf)
- [Submission 3 tích hợp Phase 1–3 — 236 trang](group-report/output/pdf/submission-3-integrated-report.pdf) · [Bản LMS — 18,34 MB](group-report/output/pdf/submission-3-integrated-report-lms.pdf)
- [Nguồn LaTeX Phase 3](group-report/main.tex)
- [Quy ước thiết kế](design-conventions.md)
- [Hai biên bản họp Phase 3](../meeting-minutes/phase-3/README.md)
- [Tài liệu học Phase 3](design-guide/README.md) · [Ôn thiết kế SEMH trong sáu lượt](design-guide/output/pdf/phase-3-study-guide.pdf)
- [Bàn giao và lệnh biên dịch](../ban-giao.md)

## Nội dung hiện tại

1. **Kiến trúc hệ thống:** phương án công nghệ, Deployment View, Development/Implementation View, dữ liệu Hub và cơ chế xử lý dùng chung.
2. **Thiết kế lớp và phương thức:** mô hình lớp tổng thể, GEN, tích hợp/audit và đủ bảy phân hệ. Nội dung giữ 192 dòng signature trong các bảng phương thức, gồm cả phương thức được nhắc lại giữa các phần.
3. **Test Case (bonus):** 23 ca luồng chính và 9 ca rủi ro/tích hợp; kiểm tra tranh chấp cơ bản bằng hai tài khoản demo. Các kiểm chứng NFR quy mô lớn nằm trong kế hoạch riêng.

Kiến trúc dùng modular monolith + layered architecture; React/TypeScript/Vite, NestJS, PostgreSQL/Prisma và Docker Compose/Nginx. Dữ liệu IoT giả lập đi qua backend vào DB; Leaflet hiển thị bản đồ và tài nguyên từ API. Không có payment, Azure hoặc message broker trong phương án hiện tại.

Các bảng test ghi điều kiện, thao tác và kết quả mong đợi; chưa có kết quả thực thi ứng dụng.

Trong bản tích hợp, thiết kế lớp/phương thức nằm ngay sau các UC và state chart của GEN hoặc phân hệ tương ứng. Mô hình lớp và hợp đồng dùng chung đặt trước GEN; kiến trúc và test case đặt cuối. Bản Phase 3 riêng vẫn giữ bố cục chỉ gồm phần thiết kế.

## Nguồn và hình

| Nội dung | Đường dẫn |
| --- | --- |
| Kiến trúc | `group-report/sections/` |
| Test case | [group-report/sections/05-test-cases.tex](group-report/sections/05-test-cases.tex) |
| GEN và bảy phân hệ | `group-report/sections/class-design/` |
| Kiểu dữ liệu, thuật ngữ và owner dùng chung | `group-report/sections/common/`, `design-conventions.md` |
| Nguồn sơ đồ PlantUML | `diagrams/plantuml/` |
| Nguồn sơ đồ TikZ | `diagrams/tikz/` |
| Class Diagram dùng trong báo cáo | `diagrams/class/` |
| Hai view kiến trúc | `architecture/` |
| Bài gốc thành viên tại máy tổng hợp | `../local/phase-3-submissions/` |

Hình tích hợp đã nằm trong `docs/`; biên dịch không phụ thuộc thư mục `local/`. Giữ bản gốc thành viên khi chỉnh nội dung tổng hợp. [Bảy báo cáo cá nhân Phase 3](individual-work/README.md) đã có đủ nguồn và PDF theo phân hệ; bản Bảo Anh có thêm GEN và tổng hợp nội dung chung.

## Biên dịch

Chạy từ thư mục gốc dự án:

```bash
cd docs/phase-3/group-report
latexmk -xelatex -interaction=nonstopmode -halt-on-error -file-line-error \
  -jobname=phase-3-group-report-outline -outdir=/tmp/semh-build-phase-3 main.tex
cp /tmp/semh-build-phase-3/phase-3-group-report-outline.pdf output/pdf/
```

Chỉ render sơ đồ khi đã thay nguồn và cần cập nhật hình:

```bash
# Chạy tại thư mục gốc dự án; thay đường dẫn JAR theo máy.
node docs/phase-3/diagrams/plantuml/render-design.mjs /path/to/plantuml.jar
```

Sau khi sửa Phase 3, biên dịch lại cả bản riêng lẫn bản tích hợp theo [hướng dẫn bàn giao](../ban-giao.md).
