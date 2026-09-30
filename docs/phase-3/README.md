# Phase 3 - System Design

Phase 3 chuyển requirement và behavioral design thành kiến trúc, cấu trúc mã nguồn và thiết kế lớp có thể hiện thực. Bản bố cục báo cáo nằm trong `group-report/`.

- `group-report/`: LaTeX và PDF có đầy đủ đề mục của Submission 3, không dùng ô giữ chỗ;
- `architecture/`: quyết định kiến trúc và source của deployment/implementation view;
- `diagrams/`: class diagram cùng các sơ đồ thiết kế liên quan;
- `test-cases/`: test case bonus và evidence chạy test;
- `individual-work/`: phần thiết kế do từng thành viên phụ trách khi nhóm phân công.

Báo cáo gồm:

- baseline và architectural drivers;
- Deployment View;
- Development/Implementation View;
- class diagram và mô tả toàn bộ method;
- test case bonus.

Deployment view và implementation view được trình bày một lần ở cấp hệ thống. Phần class/method được chia theo bảy phân hệ; dưới mỗi phân hệ là các UC tương ứng, kèm mapping từ Screen ID và behavioral diagram đến class, method, interface và test ưu tiên. Cách này giữ Phase 3 ăn khớp trực tiếp với 18 UC đã khóa ở hai phase trước.

- Deadline trên LMS: **08/11/2026**
- Review dự kiến trên lớp: **Tuần 13**

Biên dịch bản cấu trúc:

```bash
cd docs/phase-3/group-report
latexmk -xelatex -interaction=nonstopmode -halt-on-error \
  -jobname=phase-3-group-report-outline -outdir=output/pdf main.tex
```
