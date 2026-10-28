# Sơ đồ hành vi Submission 2

Dùng [thuật ngữ chung](../../uml-conventions.md) và [phong cách PlantUML của nhóm](../../../phase-1/diagrams/plantuml/README.md): nền trắng, viền đen, không bóng đổ. Không bọc điều kiện bằng `[[...]]` vì đó là cú pháp hyperlink.

Các tên thư mục bài gốc dưới đây được lưu tại `local/phase-2-submissions/` trên máy tổng hợp, không nằm trong Git. Toàn bộ hình và mã nguồn cần để biên dịch báo cáo đã được tích hợp vào thư mục Phase 2; không cần bài gốc để build lại.

## Sơ đồ tổng quát có Admin

`system-context.puml` và `system-use-case.puml` kế thừa bố cục, nội dung của Submission 1 và bổ sung `ACT-ADM` cùng nhóm quản trị dùng chung `GEN`. Không thêm quan hệ kế thừa Admin/Operator và không ghi đè hình của Submission 1. Hai hình dùng Smetana tích hợp, xuất vào `diagrams/system/`.

```bash
node docs/phase-2/diagrams/plantuml/render-system.mjs /duong-dan/plantuml.jar
```

UC-GEN-01/02/03 và UC-OPS-04/05 đều có use-case diagram chi tiết riêng tại `uc-gen-01/02/03.puml` và `uc-ops-04/05.puml`: association với ACT-ADM hoặc ACT-OPR; include kiểm tra quyền, kiểm tra nghiệp vụ và lưu/audit; extend tra cứu lại kết quả khi mất phản hồi theo EF-02. Không thêm khung ghi chú dưới hình. Không dùng include để nối việc thêm tài nguyên với việc kích hoạt hoặc nối quản lý tài khoản với cấp quyền, vì đây là các UC độc lập. Mỗi UC có đặc tả, sequence và activity riêng. Các nguồn còn lại gồm `sequence-*`, `activity-*`, `state-account.puml` và `state-resource-service-status.puml`. Mỗi hình giữ nguyên vẹn, không chia nhỏ; xuất vào `diagrams/use-case/`, `sequence/`, `activity/` và `state/`.

```bash
node docs/phase-2/diagrams/plantuml/render-management.mjs /duong-dan/plantuml.jar
```

Giữ nguyên include/extend và AF/EF của 18 UC ban đầu. `AccountStatus` tách khỏi phân quyền; `ServiceStatus` tách khỏi trạng thái vật lý. Bản ghi mới Draft; Operator kiểm tra trước khi kích hoạt. Không tự ngừng tài nguyên còn ràng buộc hoặc phục hồi OutOfService bằng thao tác bật.

## SUB-SIM - Bảo Anh

- `sequence-uc-sim-01.puml`: mở cấu hình, tham số/lưu nháp, xác nhận, khởi chạy, thực thi nền và xem tiến độ trong một hình.
- `sequence-uc-sim-02.puml`: kiểm tra kết quả, so sánh chỉ số, đánh giá và mở quy trình điều phối trong một hình.
- `activity-uc-sim-01.puml`: cấu hình/xác nhận và khởi chạy/thực thi nền trong một luồng liền mạch.
- `activity-uc-sim-02.puml`: kiểm tra kết quả và đánh giá/bàn giao đề xuất trong một luồng liền mạch.
- `state-simulation-run.puml`: vòng đời `Draft → Running → Completed | Failed`.

Các hình dùng `sim-style.puml`. Snapshot lấy từ trạng thái đã được SEMH chấp nhận, không phải gọi trực tiếp thiết bị IoT. Snapshot đầu vào bất biến; tính toán cập nhật bản sao làm việc riêng.

`SimulationRun.Draft` là bước chuẩn bị nội bộ sau khi có snapshot, không phải kịch bản lưu nháp. AF-01 chỉ lưu `SimulationScenario`, chưa tạo lần chạy. Chạy lại tạo run và snapshot mới, không mở lại run cũ. Khuyến nghị chỉ bàn giao sang UC-OPS-03, không tự đổi dữ liệu thật.

Khối `ref` kiểm tra truy cập đại diện cho tương tác với `AccessService`: kiểm tra phiên, quyền và phạm vi; trả lỗi và kết thúc yêu cầu nếu không hợp lệ. Không tiếp tục đọc/ghi sau khi bị từ chối. Tiến trình nền đã khởi chạy không bị hủy khi đóng UI hoặc hết phiên.

`analysisReady` phân biệt tác vụ NIFR-SIM-01 chưa xong với kết quả phân tích rỗng; không thêm trạng thái vào `SimulationRunStatus`. Mở UC-OPS-03 chỉ chuẩn bị dữ liệu điền trước, không lưu hoặc phê duyệt `RedistributionPlan` trong SUB-SIM.

## SUB-RES và SUB-TRIP

- `state-vehicle-reservation.puml`: vòng đời `Pending`, `Confirmed`, `Fulfilled`, `Cancelled`, `Expired`, `Rejected`; thời hạn 10 phút tính từ khi xác nhận. Hủy hoặc hết hạn không mặc định đưa xe về `Available`.
- `sequence-uc-trip-01/02.puml`, `activity-uc-trip-01/02.puml`, `state-trip.puml`, `state-shared-vehicle.puml`: tích hợp từ sáu mã nguồn trong `Tường Vi - SUB Trip/`, chuẩn hóa xuống dòng và bỏ nhãn “Bonus” khỏi tiêu đề hai state diagram; giữ nguyên nội dung nghiệp vụ và các tệp nguồn của thành viên.

Hai state diagram SUB-TRIP giữ ghi chú của tác giả về các chuyển trạng thái chưa được baseline quy định (`Trip.Interrupted`, sạc xe dùng chung và xe chờ sạc). Không tự suy diễn pin thấp thành `Charging` hoặc mất kết nối thành `Interrupted`.

Biên dịch bảy hình của SUB-RES/SUB-TRIP:

```bash
node docs/phase-2/diagrams/plantuml/render-res-trip.mjs /duong-dan/plantuml.jar
```

## SUB-OPS - Minh Anh

Bảy ảnh trong `Minh Anh - SUB OPS/` được giữ nguyên khi tích hợp: ba sequence, ba activity và state `Incident`. Danh sách nguồn/đích nằm trong `mockups/figma-exports-sub-ops.json`.

`state-redistribution-plan.puml` bổ sung vòng đời kế hoạch theo UC-OPS-03: `Draft → Approved → InProgress → Completed`, hoặc hủy trước khi hoàn tất. Phê duyệt không tự xác nhận vận chuyển; hủy không tự hoàn tác vị trí xe. `Recommended` có trong danh mục trạng thái nhưng chưa có quy tắc vào/ra trong đặc tả hiện tại, nên sơ đồ ghi rõ điểm này, không tự tạo chuyển trạng thái.

Render state mới từ thư mục này:

```bash
java -Djava.awt.headless=true -jar /duong-dan/plantuml.jar -charset UTF-8 \
  -tsvg -o ../state state-redistribution-plan.puml
mv ../state/state-redistribution-plan.svg ../state/redistribution-plan.svg
rsvg-convert -f pdf -o ../state/redistribution-plan.pdf ../state/redistribution-plan.svg
```

## Compile local

### SUB-PARK và SUB-CHG

Tích hợp 15 SVG từ hai thư mục bài nộp của Ngọc Hân và Hương Giang; bảng nguồn/đích nằm ở `../park-chg-imports.json`. Giữ nguyên các thư mục bài nộp. Bản tích hợp sửa dòng activation bị dính vào thông điệp trong sequence CHG-03 và bỏ luồng duyệt thủ công Pending chưa có trong baseline của ParkingReservation. Hai state chart ChargingSession/ChargingPoint được bổ sung theo danh mục trạng thái và yêu cầu hiện hành; không tự phục hồi phiên Interrupted hoặc ghi đè OutOfService bằng thao tác kích hoạt.

Sequence CHG-02 được xuất lại với Arial; khi chuyển PDF, glyph được chuyển thành path vector để tránh lỗi font rỗng của Cairo. Nguồn khôi phục từ metadata SVG được lưu tại các tệp `activity-uc-park-01/02.puml`, `state-parking-space.puml`, cùng các nguồn đã tích hợp trước đó. Các hình PARK liên quan hết hạn được đồng bộ BR-PARK-02: không tự đưa chỗ lỗi về Available, kiểm tra lại check-in và giữ chỗ nguyên tử. Sáu hình CHG dùng BR-CHG-03/04 cho thời lượng, cổng tương thích và hạn mức công suất; các hình không liên quan giữ nguyên.

Chạy `node docs/phase-2/diagrams/plantuml/render-park-chg.mjs /duong-dan/plantuml.jar` để xuất đủ 17 PDF vector, gồm 12 sequence/activity và 5 state chart. Mỗi hình được chèn nguyên vẹn trên một trang A4 dọc.

Yêu cầu Java, PlantUML JAR và `rsvg-convert`. State chart dùng Smetana tích hợp; không gửi mã lên PlantUML Server.

```bash
node docs/phase-2/diagrams/plantuml/render-sim.mjs /duong-dan/plantuml.jar
```

Script tạo SVG/PDF vector tại `diagrams/sequence/`, `diagrams/activity/` và `diagrams/state/`. Mỗi UC có một sequence và một activity, không dùng `newpage` để chia hình. Báo cáo chèn nguyên sơ đồ trên trang A4 dọc; người đọc có thể phóng to PDF để xem chi tiết.

```bash
cd docs/phase-2/group-report
latexmk -xelatex -interaction=nonstopmode -halt-on-error \
  -jobname=phase-2-group-report-outline -outdir=output/pdf main.tex
```

UI Mockup và phần các thành viên khác giữ nguyên để bổ sung sau.
