# Báo cáo cá nhân Submission 2

Mỗi báo cáo lấy trực tiếp nội dung tương ứng từ `../group-report/sections/`, dùng chung hình tại `../diagrams/`, `../mockups/` và các use-case diagram của Submission 1. Không chép lại đặc tả hoặc sửa riêng diagram trong từng thư mục cá nhân.

| Sinh viên | MSSV | Nội dung | PDF |
| --- | --- | --- | --- |
| Trần Nhật Bảo Anh | 2410155 | Phần I; SUB-SIM; GEN là nội dung chung được tổng hợp | [Mở](tran-nhat-bao-anh-2410155/output/pdf/phase-2-2410155-individual-report.pdf) |
| Nguyễn Quốc Trung | 2413707 | Phần II; SUB-HUB | [Mở](nguyen-quoc-trung-2413707/output/pdf/phase-2-2413707-individual-report.pdf) |
| Lê Nguyễn Tường Vi | 2413937 | Mô hình use case toàn hệ thống; SUB-TRIP | [Mở](le-nguyen-tuong-vi-2413937/output/pdf/phase-2-2413937-individual-report.pdf) |
| Phan Võ Bảo Trâm | 2413576 | SUB-RES | [Mở](phan-vo-bao-tram-2413576/output/pdf/phase-2-2413576-individual-report.pdf) |
| Nguyễn Ngọc Hân | 2410951 | SUB-PARK | [Mở](nguyen-ngoc-han-2410951/output/pdf/phase-2-2410951-individual-report.pdf) |
| Trần Thị Hương Giang | 2410845 | SUB-CHG | [Mở](tran-thi-huong-giang-2410845/output/pdf/phase-2-2410845-individual-report.pdf) |
| Nguyễn Thị Minh Anh | 2410126 | SUB-OPS, gồm UC-OPS-04/05 | [Mở](nguyen-thi-minh-anh-2410126/output/pdf/phase-2-2410126-individual-report.pdf) |

UI Mockup là phần cả nhóm cùng làm. Mỗi báo cáo giữ các màn hình, sequence, activity và state chart thuộc phạm vi tương ứng. Các báo cáo không chứa toàn bộ Phần II có một đoạn tóm tắt quy tắc truy cập chung để các tham chiếu trong đặc tả đọc được độc lập.

Bìa dùng mẫu HCMUT, ghi Submission 2, họ tên, MSSV, lớp L02 và nhóm K24 Warriors. Số mục, số bảng và hình được đánh lại trong từng báo cáo; mã UC/FR/BR và nội dung giữ theo báo cáo nhóm.

## Compile

Từ root workspace, xuất cả bảy PDF:

```bash
node docs/phase-2/individual-work/build.mjs
```

Hoặc chọn một hay nhiều MSSV:

```bash
node docs/phase-2/individual-work/build.mjs 2410155 2413707
```

PDF nằm tại `<thu-muc-sinh-vien>/output/pdf/phase-2-<MSSV>-individual-report.pdf`. Mỗi thư mục có `main.tex`; cấu hình chung ở `shared/report-setup.tex`. Cần XeLaTeX, `latexmk`, template và tài sản của repo để compile lại. Các PDF đã xuất có thể nộp độc lập.
