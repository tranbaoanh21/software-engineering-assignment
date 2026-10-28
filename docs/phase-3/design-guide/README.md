# Kiến thức nền Phase 3

Tài liệu học tiếp nối tài liệu Phase 2, giữ template HCMUT, lý thuyết từ đầu, hình giải thích ký hiệu và ví dụ hoàn chỉnh. Không phải bài thiết kế Phase 3 đã điền sẵn cho nhóm.

- [PDF](output/pdf/phase-3-design-guide.pdf)
- Nguồn chính: `phase-3-design-guide.tex`; nội dung chia trong `sections/`.
- Hình ký hiệu: TikZ trong LaTeX. Năm hình ví dụ có nguồn PlantUML trong `figures/`, bản SVG/PDF vector trong `figures/output/`.

## Nội dung

1. Từ yêu cầu tới kiến trúc: view, layer/tier, module, cohesion/coupling và lựa chọn kiến trúc.
2. Deployment View: node/device, môi trường thực thi, artifact, deploy/manifest, đường giao tiếp và local/production.
3. Development/Implementation View: package, component, provided/required interface, port, dependency và dependency inversion.
4. Class diagram: thuộc tính, operation, visibility, static/abstract, enum, multiplicity và từng loại quan hệ.
5. Class/method descriptions: input/output, điều kiện, invariant, lỗi, side effect, transaction, cạnh tranh và idempotency.
6. Test case bonus: các mức test, test double, biên, bảng quyết định, trạng thái và evidence.
7. Ví dụ đăng ký khóa học: hai view kiến trúc, ba hình class diagram bổ sung nhau, hợp đồng cho đủ 16 operation và các test thiết kế.
8. Áp dụng cho SEMH: baseline 23 UC, trách nhiệm từng phân hệ, IoT giả lập, SUB-SIM và bài tập có gợi ý đáp án.

Các tên lớp/method mới trong phần gợi ý là ứng viên thiết kế, không tự thay baseline hay chốt công nghệ cho nhóm. Khung báo cáo Phase 3 đã được đồng bộ 23 UC trong lần rà soát riêng; xem `../group-report/` và `../README.md` để phân việc.

Quy chuẩn thuật ngữ nguồn: `docs/phase-2/uml-conventions.md` tính từ root dự án.

## Dựng hình và biên dịch

Chạy trong thư mục này:

```sh
node render-examples.mjs /path/to/plantuml.jar
latexmk -xelatex -interaction=nonstopmode -halt-on-error -file-line-error \
  -outdir=output/pdf phase-3-design-guide.tex
```

Cần Java, PlantUML JAR, `rsvg-convert`, XeLaTeX và latexmk. Có thể chỉ định `UML_JAVA_BIN`, `UML_RSVG_BIN`. Muốn compile lại khi chưa sửa sơ đồ, chỉ cần lệnh latexmk vì hình vector đã có sẵn.

Ví dụ đăng ký khóa học là thiết kế minh họa ngoài SEMH; các test trong tài liệu chưa được chạy trên ứng dụng. Tài liệu không khẳng định nhóm đã implement hoặc đạt NFR. Nguồn đối chiếu gồm đề bài, đặc tả OMG UML, tài liệu PlantUML và hướng dẫn kiến trúc Microsoft; liên kết nằm ở cuối PDF.
