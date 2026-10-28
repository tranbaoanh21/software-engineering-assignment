# Điều kiện kiểm tra quản trị và tài nguyên

Các kịch bản dưới đây dành cho bước hiện thực/kiểm thử sau; chưa phải kết quả kiểm thử backend.

- UC-GEN-01: tên đăng nhập trùng bị từ chối; khóa tài khoản chặn phiên cũ; mở lại yêu cầu đăng nhập mới; không khóa Admin hoạt động cuối cùng; lịch sử nghiệp vụ giữ nguyên.
- UC-GEN-02: quyền bị thu hồi hết hiệu lực ở yêu cầu được bảo vệ tiếp theo; hai yêu cầu đồng thời không được thu hồi cả hai Admin cuối cùng; không cấp quyền qua dữ liệu vai trò do client tự gửi.
- UC-GEN-03: Hub/tài nguyên mới Draft; mã trùng bị từ chối; thiết bị phải có Hub hợp lệ; không ghi Available hoặc thay đổi telemetry khi khai báo.
- UC-OPS-04: Operator chỉ thêm/sửa trong Hub được giao; định danh, loại và Hub cố định; sửa thông tin không đổi trạng thái phục vụ, trạng thái vật lý hay lịch sử.
- UC-OPS-05: tài nguyên hoặc Hub còn lượt giữ/phiên/lịch/kế hoạch ràng buộc không được tắt; lỗi dữ liệu kiểm tra thì giữ trạng thái; kích hoạt không phục hồi OutOfService; cạnh tranh đặt/tắt không tạo trạng thái mâu thuẫn.
- Phân quyền: Admin không gọi được chức năng vận hành chỉ vì là Admin; Operator không gọi được chức năng quản trị tài khoản; Kỹ thuật không phê duyệt điều phối hoặc bật tài nguyên qua quyền Operator.
- Giao dịch: lưu thay đổi và audit cùng nhau; rollback khi lỗi; tải lại khi phiên bản thay đổi; dùng requestId để tra cứu kết quả khi mất phản hồi, tránh ghi lặp.
- Audit không chứa mật khẩu hoặc token. Tài khoản không lưu mật khẩu dạng rõ.

Prototype Figma thể hiện luồng và trạng thái bằng dữ liệu minh họa. Cần chạy các kịch bản trên dịch vụ thật khi có implementation; không dùng prototype để chứng minh tính nguyên tử, bảo mật hoặc khả năng chịu tải.
