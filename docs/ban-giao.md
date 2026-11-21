# Bàn giao Smart E-Mobility Hub

[Mục lục tài liệu](README.md)

## Bản đang dùng

- [Submission 3 để nộp LMS](phase-3/group-report/output/pdf/submission-3-integrated-report-lms.pdf) có 236 trang, 18,34 MB theo đơn vị thập phân.
- [Tài liệu ôn Phase 3](phase-3/design-guide/output/pdf/phase-3-study-guide.pdf) và [nguồn LaTeX](phase-3/design-guide/phase-3-study-guide.tex) dùng cho sáu lượt ôn.

## Báo cáo và nguồn biên dịch

| Bản | PDF | Nguồn LaTeX |
| --- | --- | --- |
| Final Report đã chốt | [Mở PDF](final-report/output/pdf/final-report.pdf) | `docs/final-report/main.tex` |
| Submission 3 tích hợp Phase 1–3, 236 trang | [Mở PDF](phase-3/group-report/output/pdf/submission-3-integrated-report.pdf) | `docs/phase-2/group-report/main-integrated.tex` |
| Phase 3 riêng, 72 trang | [Mở PDF](phase-3/group-report/output/pdf/phase-3-group-report-outline.pdf) | `docs/phase-3/group-report/main.tex` |
| Phase 2 gồm Phase 1–2, 172 trang | [Mở PDF](phase-2/group-report/output/pdf/phase-2-group-report-outline.pdf) | `docs/phase-2/group-report/main.tex` |
| Submission 1 đã chốt, 87 trang | [Mở PDF](phase-1/group-report/output/pdf/phase-1-group-report-outline.pdf) | `docs/phase-1/group-report/main.tex` |

Final dùng lại nguồn của bản tích hợp Phase 1–3. Các tên `*-outline.pdf` của bản Phase 1–3 riêng được giữ để các liên kết cũ tiếp tục dùng được. Bản Final cũ và khung báo cáo trước đây nằm trong `docs/local/` tại máy tổng hợp.

Trong bản tích hợp, GEN và từng phân hệ chứa các UC, UI, sequence, activity, state chart rồi đến thiết kế lớp/phương thức. Mô hình lớp dùng chung đặt trước GEN; hai phần cuối là kiến trúc hệ thống và test case.

## Tài liệu đi kèm

- [Bảy báo cáo cá nhân Phase 2](phase-2/individual-work/README.md).
- [Bảy báo cáo cá nhân Phase 3](phase-3/individual-work/README.md).
- [Ba biên bản họp Phase 2](meeting-minutes/phase-2/README.md); biên bản Phase 1 nằm trong `docs/meeting-minutes/phase-1/`.
- [Hai biên bản họp Phase 3](meeting-minutes/phase-3/README.md): 01/11 chuẩn bị và phân công; 07/11 rà soát, refine thiết kế.
- [Quy ước UML Phase 2](phase-2/uml-conventions.md) và [quy ước thiết kế Phase 3](phase-3/design-conventions.md).
- Tài liệu học nằm trong `docs/phase-2/diagram-guide/` và `docs/phase-3/design-guide/`; không phải báo cáo nộp.
- Báo cáo cá nhân Phase 3 đã xuất đủ theo bảy thành viên; GEN và tổng hợp nội dung chung nằm trong bản Bảo Anh. Các test được trích theo phạm vi, chưa ghi kết quả chạy ứng dụng.

## Chỉnh sửa ở đâu

- Tổng quan, yêu cầu và từng UC: `docs/phase-2/group-report/sections/`.
- Kiến trúc, lớp/phương thức và test: `docs/phase-3/group-report/sections/`.
- Hình UI và UML Phase 2: `docs/phase-2/mockups/`, `docs/phase-2/diagrams/`.
- Hình kiến trúc và lớp Phase 3: `docs/phase-3/architecture/`, `docs/phase-3/diagrams/`.
- Mẫu LaTeX và logo: `docs/assets/`.

`main-integrated.tex` dùng lại các section và hình của hai phase. Để biên dịch, lấy nguồn và tài nguyên trong `docs/` từ Git.

## Mốc tiếp tục rà soát

1. [SUB-TRIP](phase-3/group-report/sections/class-design/03-sub-trip.tex) và [SUB-OPS](phase-3/group-report/sections/class-design/06-sub-ops.tex). Chốt ai tiếp nhận báo lỗi khi xe đang chạy và cách xử lý chuyến đi khi xe đã chuyển sang `OutOfService`.
2. [SUB-PARK](phase-3/group-report/sections/class-design/04-sub-park.tex). Đồng bộ điều kiện check-out khi lượt vẫn `CheckedIn`, chỗ đỗ đang lỗi và đã có bằng chứng xe rời chỗ.
3. [SUB-CHG](phase-3/group-report/sections/class-design/05-sub-chg.tex) và [SUB-OPS](phase-3/group-report/sections/class-design/06-sub-ops.tex). Chốt cách bàn giao xe pin thấp từ TRIP sang CHG và cách giữ xe, xác nhận Hub mới khi điều chuyển.
4. [Development/Implementation View](phase-3/group-report/sections/03-implementation-view.tex). Nếu cần hình phục vụ trình bày, ưu tiên thể hiện các lời gọi giữa module. Đối chiếu thêm ca test tích hợp với các luồng đã chốt.

Các mục trên là điểm cần đối chiếu khi hiện thực. Báo cáo cuối đã chốt ghi thiết kế và kết quả kiểm thử mong đợi.

## Biên dịch

Cần XeLaTeX và `latexmk`. Mỗi khối dưới chạy từ thư mục gốc dự án. File phụ được tạo trong `/tmp`, PDF cuối được chép vào `output/pdf/`.

### Submission 3 tích hợp

```bash
cd docs/phase-2/group-report
latexmk -xelatex -interaction=nonstopmode -halt-on-error -file-line-error \
  -jobname=submission-3-integrated-report -outdir=/tmp/semh-build-integrated main-integrated.tex
cp /tmp/semh-build-integrated/submission-3-integrated-report.pdf ../../phase-3/group-report/output/pdf/
```

### Final Report

```bash
cd docs/final-report
latexmk -xelatex -interaction=nonstopmode -halt-on-error -file-line-error \
  -jobname=final-report -outdir=/tmp/semh-build-final main.tex
mkdir -p output/pdf
cp /tmp/semh-build-final/final-report.pdf output/pdf/
```

### Phase 3 riêng

```bash
cd docs/phase-3/group-report
latexmk -xelatex -interaction=nonstopmode -halt-on-error -file-line-error \
  -jobname=phase-3-group-report-outline -outdir=/tmp/semh-build-phase-3 main.tex
cp /tmp/semh-build-phase-3/phase-3-group-report-outline.pdf output/pdf/
```

### Phase 2 riêng

```bash
cd docs/phase-2/group-report
latexmk -xelatex -interaction=nonstopmode -halt-on-error -file-line-error \
  -jobname=phase-2-group-report-outline -outdir=/tmp/semh-build-phase-2 main.tex
cp /tmp/semh-build-phase-2/phase-2-group-report-outline.pdf output/pdf/
```

## Bài gốc và tài liệu riêng

- `docs/local/phase-2-submissions/`: bài gốc Phase 2.
- `docs/local/phase-3-submissions/`: bài gốc Phase 3 theo phân hệ và các phiên bản ảnh đã gửi.
- `docs/local/legacy-pdfs/`: các bản PDF cũ, gồm Final tích hợp Phase 1–3.
- `docs/local/reference/assignment-reference.pdf`: PDF mẫu tham khảo.
- `docs/local/final-report-outline/`: nguồn và PDF khung Final cũ.
- `docs/local/superseded-guide-figures/`: sơ đồ cũ của tài liệu học.
- `docs/local/study/phase-1-study-guide.md`: tài liệu tự học riêng tại máy.

`docs/local/` và các bộ prompt cá nhân của Phase 2 được Git bỏ qua.
