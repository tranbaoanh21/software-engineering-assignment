# Template LaTeX dùng chung

Thư mục này chứa bộ khung dùng cho báo cáo nhóm, báo cáo cá nhân và biên bản họp. Hình thức được làm lại theo `assignment-reference.pdf`: trang bìa có khung viền, font gần VnTeX, tiêu đề đen, header/footer của Trường Đại học Bách Khoa và số trang dạng `Trang x/y`.

## Các file chính

- `hcmut-report.sty`: quy định font, lề trang, trang bìa, header/footer, mục, bảng và chú thích.
- `metadata.tex`: thông tin môn học, giảng viên, đề tài và niên khoá.
- `main.tex`: bản mẫu hoàn chỉnh, có danh sách bảy thành viên.
- `sections/sample-content.tex`: nội dung minh hoạ; thay file này khi bắt đầu viết bài thật.

## Biên dịch bản mẫu

Chạy lệnh sau từ `assets/latex-template/`:

```bash
latexmk -xelatex -interaction=nonstopmode -halt-on-error \
  -jobname=template-preview -outdir=output/pdf main.tex
```

Phải dùng XeLaTeX, không dùng `latexmk -pdf`, vì template xử lý font Unicode trực tiếp.

## Dùng cho một báo cáo mới

Sao chép `main.tex`, `metadata.tex` và thư mục `sections/` vào nơi viết báo cáo. Trong file chính, khai báo đúng đường dẫn tới `assets/`, sau đó nạp style dùng chung:

```tex
\newcommand{\HCMUTAssetPath}{../../../../assets}
\usepackage{../../../../assets/latex-template/hcmut-report}
```

Chỉnh các dòng `\renewcommand` trong `metadata.tex`; không chỉnh trực tiếp `hcmut-report.sty` cho từng bài. Nếu cần thay đổi hình thức dùng cho cả nhóm, hãy sửa style chung và biên dịch lại tất cả báo cáo bị ảnh hưởng.
