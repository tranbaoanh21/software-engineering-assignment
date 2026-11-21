# Final Report

Báo cáo cuối của nhóm tích hợp nội dung Phase 1–3.

- [Bản Final đã chốt (PDF)](output/pdf/final-report.pdf)
- [Bản tích hợp Phase 1–3 để đối chiếu (PDF)](../phase-3/group-report/output/pdf/submission-3-integrated-report.pdf)
- [Nguồn biên dịch](main.tex)
- [Bàn giao dự án](../ban-giao.md)

## Bố cục

1. Tổng quan và đặc tả dự án.
2. Yêu cầu hệ thống.
3. Phân tích và thiết kế: mô hình toàn hệ thống, UI và lớp dùng chung; GEN và bảy phân hệ. Thiết kế lớp/phương thức đặt trong từng phân hệ, sau các UC và state chart.
4. Kiến trúc hệ thống.
5. Test case.

## Nguồn nội dung

`main.tex` nạp nguồn `../phase-2/group-report/main-integrated.tex` và dùng lại các section/hình trong Phase 1–3. Phần I và II dùng [nguồn biên tập của Final](sections/project-and-requirements.tex). Development/Implementation View dùng [nguồn kiến trúc của Final](sections/implementation-view.tex). Các phần còn lại dùng nguồn của từng phase.

Toàn bộ nguồn và tài nguyên cần để biên dịch nằm trong `docs/`. Các bản lưu tại máy tổng hợp nằm trong `docs/local/`.

## Biên dịch

Chạy từ thư mục gốc dự án:

```bash
cd docs/final-report
latexmk -xelatex -interaction=nonstopmode -halt-on-error -file-line-error \
  -jobname=final-report -outdir=/tmp/semh-build-final main.tex
mkdir -p output/pdf
cp /tmp/semh-build-final/final-report.pdf output/pdf/
```

### Deployment View

[SVG Deployment View](diagrams/deployment-view.svg) là nguồn vector chỉnh sửa trực tiếp. Logo lấy từ [Devicon](https://github.com/devicons/devicon/tree/master/icons) và [Simple Icons](https://github.com/simple-icons/simple-icons/tree/develop/icons), với thông báo bản quyền trong metadata SVG.

Chạy từ thư mục gốc dự án để xuất lại PDF của hình.

```bash
rsvg-convert -f pdf -o docs/final-report/diagrams/deployment-view.pdf \
  docs/final-report/diagrams/deployment-view.svg
```

### Biên dịch sơ đồ Implementation View

Package Diagram dùng phong cách PlantUML của Phase 3. Chạy từ thư mục gốc dự án với Java, PlantUML và rsvg-convert.

```bash
cd docs/final-report/diagrams
java -Djava.awt.headless=true -jar /duong-dan/plantuml.jar -charset UTF-8 -tsvg backend-packages.puml
rsvg-convert -f pdf -o backend-packages.pdf backend-packages.svg
```

Khung Final cũ được lưu tại `docs/local/final-report-outline/` trên máy tổng hợp.
