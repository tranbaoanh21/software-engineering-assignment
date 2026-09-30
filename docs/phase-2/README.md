# Phase 2 - UI và behavioral diagrams

Phase 2 chuyển 18 use case của Submission 1 thành UI mockup và các behavioral diagram có thể kiểm tra. Hiện tại nhóm chỉ giữ khung báo cáo để phân công và tiếp tục điền nội dung; chưa có báo cáo Phase 2 hoàn chỉnh.

Trong báo cáo, nội dung được gom theo phân hệ. Mỗi phân hệ trình bày bộ mockup trước, sau đó lần lượt đi qua từng UC với Screen ID, sequence diagram, activity diagram và dẫn chiếu state chart. State chart dùng chung chỉ đặt một lần ở phần mô hình trạng thái.

- `group-report/`: mã LaTeX và PDF của khung báo cáo;
- `mockups/` và `diagrams/`: vị trí dành cho mockup và sơ đồ sẽ thực hiện ở Phase 2.

Nội dung theo đề:

- UI design - Mockup: group work;
- Sequence diagrams: individual work;
- Activity diagrams: individual work;
- State-chart diagrams: bonus.

- Deadline trên LMS: **25/10/2026**
- Review dự kiến trên lớp: **Tuần 11**

Biên dịch bản cấu trúc:

```bash
cd docs/phase-2/group-report
latexmk -xelatex -interaction=nonstopmode -halt-on-error \
  -jobname=phase-2-group-report-outline -outdir=output/pdf main.tex
```
