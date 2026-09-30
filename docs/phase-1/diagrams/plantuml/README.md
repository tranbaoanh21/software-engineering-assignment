# PlantUML diagrams

Thư mục này chứa mã nguồn PlantUML cho các sơ đồ của Phase 1. Các sơ đồ dùng những layout engine được tích hợp trong PlantUML nên không cần gửi mã lên PlantUML Server hoặc cài riêng Graphviz.

## Quy tắc trình bày dùng chung

- Dùng nền trắng, viền và mũi tên đen, tắt bóng đổ; không dùng màu trang trí không mang ý nghĩa.
- Chọn hướng bố cục theo khả năng đọc trên trang A4: sơ đồ tổng quát ưu tiên `left to right direction`; sơ đồ chi tiết có nhiều nhánh dùng `top to bottom direction` để tránh hình quá dài. Actor và external system luôn nằm ngoài system boundary.
- Riêng system context diagram dùng thư viện `C4/C4_Context` và `LAYOUT_LANDSCAPE()` để giữ bố cục ba cột: actor ở trái, SEMH ở giữa, external system ở phải. Actor vẫn khai báo bằng `actor` nguyên bản của PlantUML để dùng cùng biểu tượng stick figure với use-case diagram. Dùng `Lay_D` để xếp dọc trong cột và quan hệ có hướng `Rel_R`, `Rel_L`, `BiRel_R` để giữ đường nối ngắn, dễ đọc.
- Sơ đồ toàn hệ thống chỉ thể hiện bảy nhóm chức năng cấp cao và giữ mã `SUB-*` trong tên. Chi tiết `UC-*`, `<<include>>` và `<<extend>>` thuộc sơ đồ của từng use case.
- Dùng `package` để gom các nhóm nghiệp vụ; tên hiển thị viết bằng tiếng Việt tự nhiên, mã ổn định đặt trong ngoặc ở dòng cuối.
- External system phải nằm ngoài boundary, có stereotype rõ ràng và chỉ xuất hiện khi có trao đổi thật sự với use case. Baseline hiện tại dùng `IoT & State Data Gateway (EXT-STATE / ACT-DAT)` cho dữ liệu trạng thái và `Map & Geolocation Service (EXT-MAP / ACT-MAP)` cho vị trí, khoảng cách và vùng tìm kiếm.
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

Yêu cầu Java tương thích với phiên bản `plantuml.jar`. Từ thư mục `docs/phase-1/diagrams/plantuml/`, chạy:

```bash
JAVA_TOOL_OPTIONS=-Djava.awt.headless=true \
  java -jar /duong-dan/plantuml.jar -charset UTF-8 -tsvg -o output \
  system-context.puml subsystem-map.puml system-use-case.puml \
  uc-hub-01.puml uc-hub-02.puml uc-hub-03.puml \
  uc-res-01.puml uc-res-02.puml \
  uc-trip-01.puml uc-trip-02.puml \
  uc-park-01.puml uc-park-02.puml uc-park-03.puml \
  uc-chg-01.puml uc-chg-02.puml uc-chg-03.puml \
  uc-ops-01.puml uc-ops-02.puml uc-ops-03.puml \
  uc-sim-01.puml uc-sim-02.puml
```

Chuyển SVG sang PDF vector để LaTeX sử dụng:

```bash
rsvg-convert -f pdf -o output/system-context.pdf output/system-context.svg
rsvg-convert -f pdf -o output/subsystem-map.pdf output/subsystem-map.svg
rsvg-convert -f pdf -o output/system-use-case.pdf output/system-use-case.svg
rsvg-convert -f pdf -o output/uc-hub-01.pdf output/uc-hub-01.svg
rsvg-convert -f pdf -o output/uc-hub-02.pdf output/uc-hub-02.svg
rsvg-convert -f pdf -o output/uc-hub-03.pdf output/uc-hub-03.svg
rsvg-convert -f pdf -o output/uc-res-01.pdf output/uc-res-01.svg
rsvg-convert -f pdf -o output/uc-res-02.pdf output/uc-res-02.svg
rsvg-convert -f pdf -o output/uc-trip-01.pdf output/uc-trip-01.svg
rsvg-convert -f pdf -o output/uc-trip-02.pdf output/uc-trip-02.svg
rsvg-convert -f pdf -o output/uc-park-01.pdf output/uc-park-01.svg
rsvg-convert -f pdf -o output/uc-park-02.pdf output/uc-park-02.svg
rsvg-convert -f pdf -o output/uc-park-03.pdf output/uc-park-03.svg
rsvg-convert -f pdf -o output/uc-chg-01.pdf output/uc-chg-01.svg
rsvg-convert -f pdf -o output/uc-chg-02.pdf output/uc-chg-02.svg
rsvg-convert -f pdf -o output/uc-chg-03.pdf output/uc-chg-03.svg
rsvg-convert -f pdf -o output/uc-ops-01.pdf output/uc-ops-01.svg
rsvg-convert -f pdf -o output/uc-ops-02.pdf output/uc-ops-02.svg
rsvg-convert -f pdf -o output/uc-ops-03.pdf output/uc-ops-03.svg
rsvg-convert -f pdf -o output/uc-sim-01.pdf output/uc-sim-01.svg
rsvg-convert -f pdf -o output/uc-sim-02.pdf output/uc-sim-02.svg
```

Sau khi sửa `.puml`, phải tạo lại cả SVG và PDF, biên dịch báo cáo rồi kiểm tra chữ, đường nối, caption và khả năng đọc trên trang A4.
