# PlantUML diagrams

Thư mục này chứa mã nguồn PlantUML cho các sơ đồ của Phase 1. Sơ đồ ngữ cảnh dùng bộ máy `elk`, còn sơ đồ phân hệ dùng `vizjs`; cả hai đều được tích hợp trong PlantUML nên không cần gửi mã lên PlantUML Server hoặc cài riêng Graphviz.

## Biên dịch

Yêu cầu Java 17 trở lên và file `plantuml.jar`. Từ thư mục `docs/phase-1/diagrams/plantuml/`, chạy:

```bash
JAVA_TOOL_OPTIONS=-Djava.awt.headless=true \
  java -jar /duong-dan/plantuml.jar -charset UTF-8 -tsvg -o output \
  system-context.puml subsystem-map.puml
```

Chuyển SVG sang PDF vector để LaTeX sử dụng:

```bash
rsvg-convert -f pdf -o output/system-context.pdf output/system-context.svg
rsvg-convert -f pdf -o output/subsystem-map.pdf output/subsystem-map.svg
```

Sau khi sửa `.puml`, phải tạo lại cả SVG và PDF, biên dịch báo cáo rồi kiểm tra chữ, đường nối, caption và khả năng đọc trên trang A4.
