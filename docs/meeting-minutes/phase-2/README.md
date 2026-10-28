# Biên bản họp — Phase 2

| Buổi | Thời gian | Nội dung | PDF |
| --- | --- | --- | --- |
| 01 | 30/09/2026, 21h30 | Tìm hiểu kiến thức, xác định các nội dung cần làm và phân công công việc | [Đọc biên bản](meeting-01/output/pdf/meeting-minutes-01.pdf) |
| 02 | 07/10/2026, 21h30 | Thống nhất mẫu UI và bắt đầu thiết kế chi tiết trên Figma | [Đọc biên bản](meeting-02/output/pdf/meeting-minutes-02.pdf) |
| 03 | 24/10/2026, 20h30 | Rà soát, chốt báo cáo nhóm, báo cáo cá nhân và bộ tài liệu Submission 2 | [Đọc biên bản](meeting-03/output/pdf/meeting-minutes-03.pdf) |

Mỗi buổi có `main.tex` chứa nội dung và `cover-page.tex` chứa thông tin bìa. Ba biên bản dùng template chung trong `assets/latex-template/`.

Biên dịch từ thư mục của buổi tương ứng:

```bash
latexmk -xelatex -interaction=nonstopmode -halt-on-error \
  -jobname=meeting-minutes-01 -outdir=output/pdf main.tex
```

Với buổi 02 hoặc 03, đổi `-jobname` thành `meeting-minutes-02` hoặc `meeting-minutes-03` tương ứng.
