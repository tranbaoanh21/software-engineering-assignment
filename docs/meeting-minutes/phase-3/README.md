# Biên bản họp — Phase 3

| Buổi | Ngày | Nội dung | PDF |
| --- | --- | --- | --- |
| 01 | 01/11/2026 | Chuẩn bị Phase 3, thống nhất kiến trúc, thiết kế lớp và phân công bảy phân hệ | [Đọc biên bản](meeting-01/output/pdf/meeting-minutes-01.pdf) |
| 02 | 07/11/2026 | Rà soát và refine hợp đồng liên phân hệ, test case và bộ báo cáo Submission 3 | [Đọc biên bản](meeting-02/output/pdf/meeting-minutes-02.pdf) |

Mỗi buổi có `main.tex`, `cover-page.tex` và PDF, sử dụng mẫu chung trong `docs/assets/latex-template/`.

Biên dịch từ thư mục từng buổi, thay `01` bằng `02` khi cần:

```bash
latexmk -xelatex -interaction=nonstopmode -halt-on-error \
  -jobname=meeting-minutes-01 -outdir=/tmp/semh-meeting-phase3-01 main.tex
mkdir -p output/pdf
cp /tmp/semh-meeting-phase3-01/meeting-minutes-01.pdf output/pdf/
```
