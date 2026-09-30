# Final Report

Final Submission là một PDF hợp nhất nội dung cuối của Submission 1, 2 và 3. Đây không phải Phase 4 tạo baseline mới.

Bố cục báo cáo không chia lại máy móc thành ba submission. Nội dung được tổ chức như sau:

- tổng quan kết quả, phạm vi MVP và baseline cấp hệ thống;
- bảy phân hệ và 18 UC; trong từng UC có đặc tả/truy vết, UI, activity, sequence, state liên quan, class/method, test và demonstration;
- deployment view, implementation view và các quyết định kiến trúc dùng chung;
- hướng dẫn chạy, luồng IoT giả lập và working demonstration;
- khai báo sử dụng Generative AI thực tế;
- bài học, giới hạn và phụ lục truy vết.

Biên dịch:

```bash
cd docs/final-report
latexmk -xelatex -interaction=nonstopmode -halt-on-error \
  -jobname=final-report-outline -outdir=output/pdf main.tex
```

Khi chốt Final, context diagram, use-case diagram toàn hệ thống, deployment/component diagram và artefact dùng chung chỉ xuất hiện một lần. UC khác dẫn chiếu bằng mã và số hình; không sao chép cùng mockup, state chart hoặc class diagram chỉ để làm mỗi UC trông đầy hơn.
