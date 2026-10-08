# Activity, Sequence và State-chart Diagram

Tài liệu học có sáu phần: ba phần lý thuyết và ký hiệu, sau đó là ba ví dụ ngoài đề tài Smart E-Mobility Hub. Ví dụ lần lượt là đăng ký khóa học, đặt hàng và thanh toán, vòng đời đơn sản xuất.

- Nguồn LaTeX: `phase-2-diagrams-guide.tex`.
- PDF: `output/pdf/phase-2-diagrams-guide.pdf`.
- Các ví dụ mới: `figures/example-*.puml`; hình vector SVG và PDF nằm trong `figures/output/`.
- Các hình ký hiệu nhỏ được vẽ trực tiếp bằng TikZ trong nguồn LaTeX.

## Biên dịch PDF

Chạy trong thư mục này, với XeLaTeX và latexmk đã có trong PATH:

```sh
latexmk -xelatex -interaction=nonstopmode -halt-on-error -file-line-error -outdir=output/pdf phase-2-diagrams-guide.tex
```

## Dựng lại ví dụ sau khi sửa PlantUML

Cần Node.js, Java, PlantUML JAR và `rsvg-convert`:

```sh
node render-examples.mjs /path/to/plantuml.jar
```

Script dựng các ví dụ, chuyển sang PDF vector và dịch một số nhãn trong hình tổng quan state chart để tránh đường cong và viền composite do Smetana dàn tự động. Các nút, đường nối và nội dung không thay đổi. Có thể chỉ định đường dẫn chương trình bằng `UML_JAVA_BIN` và `UML_RSVG_BIN`.

Sau đó chạy lại lệnh LaTeX ở trên. Các file hình cũ không có tiền tố `example-` không còn được bản tài liệu này sử dụng.
