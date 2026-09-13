# PlantUML diagrams

Thư mục này chứa mã nguồn PlantUML cho các sơ đồ của Phase 1. Sơ đồ ngữ cảnh dùng bộ máy `elk`, còn sơ đồ phân hệ dùng `vizjs`; cả hai đều được tích hợp trong PlantUML nên không cần gửi mã lên PlantUML Server hoặc cài riêng Graphviz.

## Quy tắc trình bày dùng chung

- Dùng nền trắng, viền và mũi tên đen, tắt bóng đổ; không dùng màu trang trí không mang ý nghĩa.
- Ưu tiên `left to right direction`. Actor con người đặt bên trái, external system đặt bên phải và các use case nằm trong system boundary.
- Sơ đồ toàn hệ thống chỉ thể hiện bảy nhóm chức năng cấp cao và giữ mã `SUB-*` trong tên. Chi tiết `UC-*`, `<<include>>` và `<<extend>>` thuộc sơ đồ của từng use case.
- Dùng `package` để gom các nhóm nghiệp vụ; tên hiển thị viết bằng tiếng Việt tự nhiên, mã ổn định đặt trong ngoặc ở dòng cuối.
- External system phải nằm ngoài boundary, có stereotype rõ ràng và chỉ xuất hiện khi có trao đổi thật sự với use case. Trong baseline hiện tại, lớp IoT/dữ liệu được gom thành `IoT & State Data Gateway (EXT-STATE / ACT-DAT)`.
- Giảm giao cắt đường nối bằng cách sắp xếp actor và use case theo luồng nghiệp vụ. Nhãn quan hệ phải ngắn, nằm sát đường và không che phần tử khác.
- Không đưa database, class, service nội bộ hoặc đối tượng dữ liệu thành actor. Quan hệ `include`/`extend` chỉ dùng khi đúng ngữ nghĩa, không dùng để làm sơ đồ trông chi tiết hơn.
- Lưu mã nguồn `.puml` tại thư mục này; sinh cả `.svg` và `.pdf` vector vào `output/`. Báo cáo LaTeX luôn nhúng bản PDF.

Cấu hình phong cách tối thiểu cho use-case diagram:

```plantuml
left to right direction
skinparam backgroundColor white
skinparam shadowing false
skinparam usecase {
  BackgroundColor white
  BorderColor black
  ArrowColor black
}
skinparam actor {
  BackgroundColor white
  BorderColor black
}
skinparam rectangle {
  BackgroundColor white
  BorderColor black
}
skinparam package {
  BackgroundColor white
  BorderColor black
}
```

## Biên dịch

Yêu cầu Java 17 trở lên và file `plantuml.jar`. Từ thư mục `docs/phase-1/diagrams/plantuml/`, chạy:

```bash
JAVA_TOOL_OPTIONS=-Djava.awt.headless=true \
  java -jar /duong-dan/plantuml.jar -charset UTF-8 -tsvg -o output \
  system-context.puml subsystem-map.puml system-use-case.puml
```

Chuyển SVG sang PDF vector để LaTeX sử dụng:

```bash
rsvg-convert -f pdf -o output/system-context.pdf output/system-context.svg
rsvg-convert -f pdf -o output/subsystem-map.pdf output/subsystem-map.svg
rsvg-convert -f pdf -o output/system-use-case.pdf output/system-use-case.svg
```

Sau khi sửa `.puml`, phải tạo lại cả SVG và PDF, biên dịch báo cáo rồi kiểm tra chữ, đường nối, caption và khả năng đọc trên trang A4.
