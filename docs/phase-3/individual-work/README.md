# Báo cáo cá nhân Submission 3

Bảy báo cáo lấy phần thiết kế tương ứng từ báo cáo nhóm Phase 3. Bìa ghi đúng họ tên, MSSV, lớp L02 và nhóm K24 Warriors.

| Sinh viên | MSSV | Phần riêng | PDF |
| --- | --- | --- | --- |
| Nguyễn Quốc Trung | 2413707 | SUB-HUB | [Mở PDF](nguyen-quoc-trung-2413707/output/pdf/phase-3-2413707-individual-report.pdf) |
| Phan Võ Bảo Trâm | 2413576 | SUB-RES | [Mở PDF](phan-vo-bao-tram-2413576/output/pdf/phase-3-2413576-individual-report.pdf) |
| Lê Nguyễn Tường Vi | 2413937 | SUB-TRIP | [Mở PDF](le-nguyen-tuong-vi-2413937/output/pdf/phase-3-2413937-individual-report.pdf) |
| Nguyễn Ngọc Hân | 2410951 | SUB-PARK | [Mở PDF](nguyen-ngoc-han-2410951/output/pdf/phase-3-2410951-individual-report.pdf) |
| Trần Thị Hương Giang | 2410845 | SUB-CHG | [Mở PDF](tran-thi-huong-giang-2410845/output/pdf/phase-3-2410845-individual-report.pdf) |
| Nguyễn Thị Minh Anh | 2410126 | SUB-OPS | [Mở PDF](nguyen-thi-minh-anh-2410126/output/pdf/phase-3-2410126-individual-report.pdf) |
| Trần Nhật Bảo Anh | 2410155 | SUB-SIM; GEN và tổng hợp nội dung chung | [Mở PDF](tran-nhat-bao-anh-2410155/output/pdf/phase-3-2410155-individual-report.pdf) |

Mỗi bản gồm kiến trúc hệ thống, mô hình lớp và quy ước dùng chung để đọc độc lập; Class Diagram, mô tả lớp/phương thức của phân hệ được giao; các bảng hợp đồng được dẫn chiếu và test case liên quan. Bảo Anh có thêm GEN, tiếp nhận trạng thái/audit và kế hoạch kiểm chứng NFR dưới phạm vi nội dung chung của nhóm.

Nội dung kiến trúc và các hợp đồng dùng chung được ghi rõ trong phạm vi báo cáo. Không chép phần thiết kế riêng của sáu phân hệ còn lại vào từng bản. Các bảng test chỉ ghi kết quả mong đợi, chưa ghi kết quả thực thi.

## Nguồn và biên dịch

Mỗi sinh viên có một `main.tex`; cấu hình bìa và cách trình bày nằm trong `shared/report-setup.tex`. Nội dung chính nạp trực tiếp từ `../group-report/sections/`; hình dùng lại từ `../diagrams/` và `../architecture/`.

Từ thư mục gốc dự án, xuất cả bảy PDF:

```bash
node docs/phase-3/individual-work/build.mjs
```

Hoặc chọn MSSV:

```bash
node docs/phase-3/individual-work/build.mjs 2410155 2413707
```

Cần Node.js, XeLaTeX và `latexmk`. Script trích cấu hình trình bày, các bảng hợp đồng còn được dẫn chiếu và test case từ nguồn nhóm vào thư mục tạm, rồi compile từ `main.tex` từng sinh viên. Các phần trích giữ nguyên nội dung; số mục/hình/bảng được đánh lại trong từng bản. File phụ và log nằm trong thư mục build tạm được in khi chạy; chỉ PDF cuối được xuất vào `<thu-muc-sinh-vien>/output/pdf/`.

Dùng lệnh Node ở trên để tạo đủ phần trích trước khi compile. Nguồn và tài nguyên dùng chung đều nằm trong `docs/`.
