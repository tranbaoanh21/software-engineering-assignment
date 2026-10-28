# Danh sách màn hình website — Submission 2

Nhóm thiết kế UI trên Figma dựa trên 18 UC ban đầu và năm UC bổ sung trong Submission 2, tổng cộng 23 UC. Tên actor, đối tượng và trạng thái giữ theo [thuật ngữ dùng chung](uml-conventions.md). UI là phần cả nhóm cùng làm; danh sách dưới đây không thay đổi phân công diagram theo phân hệ.

## 1. Tổng số màn hình và cách đếm

**Bộ UI hiện có gồm 22 trang chính**, gồm 17 trang ban đầu, ba trang quản trị và hai trang quản lý tài nguyên. Các form, hộp thoại xác nhận và trạng thái kết quả không tính thành trang chính mới.

| Nhóm giao diện | Số trang |
| --- | ---: |
| Dùng chung: đăng nhập, khám phá Hub, chi tiết Hub | 3 |
| Sinh viên: hoạt động, lượt đặt xe, chuyến đi, chỗ đỗ, sạc | 5 |
| Nhân viên vận hành: giám sát, sạc, sự cố, điều chuyển, mô phỏng, tài nguyên | 10 |
| Quản trị viên: tài khoản, quyền, danh mục ban đầu | 3 |
| Nhân viên kỹ thuật: công việc được giao | 1 |
| **Tổng** | **22** |

Đây là phương án tổ chức giao diện của nhóm, không phải số màn hình bắt buộc trong đề bài. Một trang có thể phục vụ nhiều use case; một use case cũng có thể đi qua nhiều trang.

Trong file này:

- **Trang chính** là một màn hình có mục đích và bố cục riêng, được đánh số 01–17.
- **Hộp thoại, panel và tab** là phần mở bên trong một trang; không cộng thành trang chính mới.
- **Trạng thái giao diện** là phiên bản của cùng trang, chẳng hạn lượt đặt còn hiệu lực, đã hủy hoặc hết hạn.

Số frame Figma lớn hơn 22 vì cần thể hiện thao tác và các trạng thái quan trọng. Không lấy số trang chính làm số ảnh phải nộp. Khi triển khai, nhóm có thể tách một form dài thành route riêng mà không phát sinh use case mới.

## 2. Danh mục 22 trang chính

| STT | Trang | Người sử dụng | Mục đích |
| --- | --- | --- | --- |
| 01 | Đăng nhập | Bốn vai trò | Xác thực bằng tài khoản được cấp và vào đúng giao diện. |
| 02 | Khám phá Mobility Hub | Người tra cứu công khai, Sinh viên | Tìm Hub trên bản đồ/danh sách, lọc theo nhu cầu và xem Hub thay thế. |
| 03 | Chi tiết Mobility Hub | Người tra cứu công khai, Sinh viên | Xem xe, chỗ đỗ, cổng sạc và chọn tác vụ phù hợp. |
| 04 | Hoạt động của tôi | Sinh viên | Quay lại lượt đặt, chuyến đi, lượt đỗ hoặc yêu cầu sạc của mình. |
| 05 | Chi tiết lượt đặt xe | Sinh viên | Xác nhận đặt, xem thời hạn giữ xe, hủy hoặc chuyển sang nhận xe. |
| 06 | Nhận xe và chuyến đi | Sinh viên | Nhận xe, theo dõi chuyến đi, trả xe và xem kết quả. |
| 07 | Chỗ đỗ của tôi | Sinh viên | Đặt chỗ cho xe cá nhân, check-in và check-out. |
| 08 | Sạc của tôi | Sinh viên | Đăng ký nhu cầu, xem lịch và theo dõi phiên sạc của mình. |
| 09 | Tổng quan mạng lưới | Nhân viên vận hành | Theo dõi Hub, tài nguyên và cảnh báo toàn mạng lưới. |
| 10 | Quản lý sạc | Nhân viên vận hành | Quản lý yêu cầu, lịch, phiên sạc và điều chỉnh lịch theo quyền. |
| 11 | Danh sách sự cố | Nhân viên vận hành | Tìm, lọc và ghi nhận sự cố. |
| 12 | Chi tiết sự cố | Nhân viên vận hành, Nhân viên kỹ thuật | Tiếp nhận, phân công, cập nhật xử lý và kết quả theo quyền. |
| 13 | Danh sách kế hoạch điều chuyển | Nhân viên vận hành | Theo dõi các kế hoạch chuyển xe giữa Hub. |
| 14 | Tạo và chi tiết kế hoạch điều chuyển | Nhân viên vận hành | Lập phương án, phê duyệt, cập nhật tiến độ và kết quả. |
| 15 | Không gian mô phỏng | Nhân viên vận hành | Thiết lập kịch bản, lưu nháp và theo dõi các lần chạy. |
| 16 | Kết quả mô phỏng và khuyến nghị | Nhân viên vận hành | So sánh kết quả với trạng thái cơ sở, đánh giá khuyến nghị. |
| 17 | Công việc kỹ thuật của tôi | Nhân viên kỹ thuật | Mở và xử lý các sự cố được giao. |

| 18 | Quản lý tài khoản | Quản trị viên | Cấp, sửa thông tin, khóa hoặc mở tài khoản; xử lý tên trùng và bảo toàn Admin cuối cùng. |
| 19 | Vai trò và phạm vi truy cập | Quản trị viên | Cấp hoặc thu hồi vai trò và phạm vi Hub; xác nhận trước khi lưu. |
| 20 | Danh mục tài nguyên ban đầu | Quản trị viên | Khai báo Hub hoặc tài nguyên Draft; không kích hoạt hoặc sửa telemetry. |
| 21 | Danh sách tài nguyên | Nhân viên vận hành | Thêm thiết bị tại Hub được giao, sửa thông tin được phép. |
| 22 | Trạng thái phục vụ tài nguyên | Nhân viên vận hành | Kiểm tra ràng buộc, kích hoạt/ngừng phục vụ và xem kết quả bị chặn. |

Trang 12 có hai phiên bản theo quyền nhưng dùng chung cấu trúc. Trang 18–20 nằm trong page Figma `Screens · Quản trị`; trang 21–22 trong `Screens · Vận hành`. Admin không được điều hướng mặc định sang giao diện Operator.

## 3. Nội dung cần thiết kế trong từng trang

### 01. Đăng nhập

- Form tài khoản, mật khẩu và nút đăng nhập.
- Trạng thái đang gửi, thiếu thông tin, sai thông tin và đăng nhập thành công.
- Sau đăng nhập, chuyển tới trang 04, 09 hoặc 17 theo quyền của tài khoản; quay về tác vụ trước đó khi phù hợp. Admin phải có điểm vào quản trị riêng, không chuyển mặc định tới trang vận hành 09; điểm vào hiện tại là trang 18.
- Trường hợp phiên hết hạn và người dùng cần đăng nhập lại.
- Menu tài khoản và vị trí đăng xuất trên bố cục dùng chung.

Tài khoản do Quản trị viên cấp và quản lý vai trò, phạm vi truy cập; tài khoản Quản trị viên đầu tiên được khởi tạo khi thiết lập hệ thống. Không có tự chọn vai trò, đăng ký, quên mật khẩu, OTP hoặc SSO. Sau đăng nhập lại, đọc trạng thái hiện tại và yêu cầu người dùng xác nhận lại; không tự gửi lại thao tác thay đổi dữ liệu trước đó.

### 02. Khám phá Mobility Hub

**Use case:** UC-HUB-01, UC-HUB-03.

- Bản đồ kết hợp danh sách Hub; chọn Hub ở một bên thì làm nổi bật ở bên còn lại.
- Ô tìm địa điểm, dùng vị trí hiện tại hoặc nhập vị trí thủ công.
- Panel bộ lọc theo nhu cầu trong đặc tả, thẻ Hub với khoảng cách và tài nguyên tóm tắt.
- Chế độ xem Hub thay thế: giữ thông tin Hub ban đầu, nhu cầu tìm kiếm và các lựa chọn phù hợp khác.
- Hành động mở rộng phạm vi, thay đổi tiêu chí và mở chi tiết Hub.

**Trạng thái cần thể hiện:** đang tải, không có Hub phù hợp, từ chối quyền vị trí, địa điểm không hợp lệ, không tải được dữ liệu và dữ liệu có thể đã cũ. Không có Hub thay thế thì hướng dẫn đổi tiêu chí, không tự tạo kết quả.

### 03. Chi tiết Mobility Hub

**Use case:** UC-HUB-02; điểm vào các nghiệp vụ đặt và sử dụng tài nguyên.

- Tên, vị trí, trạng thái Hub và thời điểm cập nhật.
- Tab xe dùng chung: mã xe, loại xe, pin, trạng thái và hành động chọn xe.
- Tab chỗ đỗ cá nhân: thông tin chỗ đỗ và khả năng đặt.
- Tab cổng sạc: thông tin và trạng thái cổng, liên kết đăng ký sạc.
- Hành động làm mới hoặc tìm Hub thay thế khi không đáp ứng nhu cầu.

**Trạng thái cần thể hiện:** Hub đầy/hết tài nguyên, Hub ngừng phục vụ, Hub không tồn tại, dữ liệu cũ và chưa có trạng thái tài nguyên hợp lệ. Tra cứu vẫn công khai; thao tác được bảo vệ mới yêu cầu đăng nhập.

### 04. Hoạt động của tôi

- Thẻ lượt đặt xe còn hiệu lực, kèm thời gian còn lại và liên kết tới trang 05.
- Thẻ chuyến đi đang diễn ra, liên kết tới trang 06.
- Thẻ lượt giữ chỗ/đỗ xe cá nhân, liên kết tới trang 07.
- Thẻ yêu cầu hoặc phiên sạc, liên kết tới trang 08.
- Khi chưa có hoạt động, có hành động tìm Hub.

Chỉ hiển thị hoạt động thuộc Sinh viên đang đăng nhập. Trang này tổng hợp các chức năng đã có, không bổ sung một use case quản lý mới.

Navbar sau đăng nhập giữ nguyên sáu mục và thứ tự trên mọi màn hình Sinh viên: **Khám phá Hub · Hoạt động của tôi · Lượt đặt xe · Chuyến đi · Chỗ đỗ của tôi · Sạc của tôi**. Chỉ trạng thái mục đang chọn thay đổi theo trang. `Lượt đặt xe` mở lượt đặt hiện tại; đặt mới vẫn bắt đầu từ chọn Hub và phương tiện. Các trang Hub có cả phiên bản công khai (Khám phá Hub, Đăng nhập) và phiên bản đã đăng nhập; ảnh đại diện trong báo cáo dùng phiên bản Sinh viên đã đăng nhập.

### 05. Chi tiết lượt đặt xe

**Use case:** UC-RES-01, UC-RES-02.

- Panel/hộp xác nhận trước khi đặt: phương tiện, Hub nhận, pin và điều kiện giữ xe.
- Lượt đặt được xác nhận: mã lượt đặt, xe, Hub, thời điểm hết hạn và thời gian còn lại trong giới hạn 10 phút.
- Hộp xác nhận hủy, có lựa chọn quay lại mà không thay đổi lượt đặt.
- Phiên bản đã hủy, hết hạn hoặc đã dùng để nhận xe; chỉ hiện thao tác còn phù hợp.
- Hành động nhận xe chuyển sang trang 06.

**Nhánh cần vẽ:** đã có lượt đặt hiệu lực; xe vừa bị người khác đặt; xe không đủ điều kiện; gửi yêu cầu nhưng mất phản hồi. Trường hợp mất phản hồi phải kiểm tra lại kết quả, không hướng người dùng tạo lượt đặt trùng.

### 06. Nhận xe và chuyến đi

**Use case:** UC-TRIP-01, UC-TRIP-02.

- Bước xác định phương tiện: mã xe hoặc QR, có cách nhập mã thủ công.
- Bước chờ xác nhận bàn giao và phản hồi nếu xe không khớp lượt đặt.
- Chuyến đi đang diễn ra: xe, Hub xuất phát, thời điểm bắt đầu, thời lượng và dữ liệu trạng thái hiện có.
- Quy trình trả xe: Hub tiếp nhận, hướng dẫn đưa xe vào vị trí, khóa hoặc bàn giao an toàn.
- Bước chờ xác nhận trả xe.
- Chuyến đi hoàn tất: Hub xuất phát/đích, thời điểm, thời lượng và bản tóm tắt sử dụng.

**Nhánh cần vẽ:** lượt đặt hết hạn, xe lỗi trước bàn giao, chưa nhận được xác nhận, Hub không thể tiếp nhận và chưa xác nhận được việc trả xe an toàn. Không coi việc bấm nút là xác nhận vật lý. Chuyến đi hoàn tất không đồng nghĩa xe luôn trở lại Available.

### 07. Chỗ đỗ của tôi

**Use case:** UC-PARK-01, UC-PARK-02, UC-PARK-03.

- Khu vực các lượt đặt/đỗ thuộc Sinh viên, mở chi tiết trong cùng trang.
- Form đặt chỗ: Hub, phương tiện cá nhân và thông tin phân bổ chỗ theo đặc tả.
- Lượt giữ chỗ được xác nhận: mã lượt đặt, vị trí, thời điểm hết hạn; giới hạn giữ chỗ tối đa 20 phút.
- Check-in: hướng dẫn tới đúng chỗ, chờ dữ liệu xác nhận và kết quả đã vào bãi.
- Đang đỗ: thông tin phương tiện, vị trí và hành động check-out.
- Check-out: chờ xác nhận xe đã rời chỗ, sau đó hiển thị hoàn tất.
- Phiên bản lượt giữ chỗ đã hết hạn.

**Nhánh cần vẽ:** không còn chỗ, chỗ vừa bị giữ, nhận diện sai vị trí, chưa có dữ liệu xác nhận hoặc xe vẫn còn tại chỗ. Chỗ đỗ xe cá nhân không được dùng thay quy trình trả xe dùng chung của SUB-TRIP.

### 08. Sạc của tôi

**Use case:** UC-CHG-01, UC-CHG-02, với quyền Sinh viên.

- Danh sách yêu cầu và phiên sạc của mình, mở chi tiết bằng panel hoặc vùng nội dung.
- Form đăng ký: phương tiện cá nhân, Hub, thời hạn mong muốn hoặc kế hoạch sử dụng.
- Yêu cầu Pending: đã tiếp nhận nhưng chưa phân bổ cổng/lịch.
- Yêu cầu Scheduled: cổng và thời gian dự kiến khi đã có dữ liệu.
- Phiên đang sạc: mức pin, tiến độ, thời điểm cập nhật và thời gian dự kiến khi có.
- Phiên đã kết thúc hoặc gặp sự cố, kèm giải thích trạng thái.

Phân biệt ChargingRequest và ChargingSession. Không có nút để Sinh viên chỉnh mức ưu tiên hoặc điều khiển điện trực tiếp.

### 09. Tổng quan mạng lưới

**Use case:** UC-OPS-01.

- Chỉ số tổng quan, bản đồ và bảng trạng thái Hub.
- Số xe khả dụng, mức sử dụng chỗ đỗ, tình trạng sạc và thời điểm cập nhật.
- Danh sách cảnh báo, bộ lọc Hub/tài nguyên/trạng thái.
- Panel chi tiết Hub, cảnh báo hoặc sự cố.
- Liên kết tới trang 12 để xử lý sự cố hoặc trang 14 để lập kế hoạch điều chuyển.

**Nhánh cần vẽ:** thiếu một phần dữ liệu, dữ liệu cũ hoặc gián đoạn nguồn trạng thái. Cảnh báo mất cân bằng không có nghĩa kế hoạch điều chuyển đã tự được phê duyệt.

### 10. Quản lý sạc

**Use case:** UC-CHG-01, UC-CHG-02, UC-CHG-03, với quyền Nhân viên vận hành.

- Tab yêu cầu: phương tiện, Hub, pin, ưu tiên và trạng thái.
- Tab lịch: yêu cầu được phân bổ theo cổng và thời gian.
- Tab phiên sạc: các phiên thuộc phạm vi quản lý và dữ liệu trạng thái.
- Form tạo nhu cầu sạc cho phương tiện thuộc mạng lưới.
- Panel chi tiết yêu cầu/phiên; dùng lại thành phần của trang 08 khi phù hợp.
- Form điều chỉnh ưu tiên và phân bổ lịch theo đặc tả; hiển thị tác động dự kiến và xác nhận thay đổi.

**Nhánh cần vẽ:** yêu cầu đã bắt đầu sạc nên không được điều chỉnh theo UC-CHG-03; cổng không phù hợp; lịch xung đột hoặc dữ liệu vừa thay đổi. Không tự thêm thao tác tạm dừng phiên đang sạc hay điều khiển điện.

### 11. Danh sách sự cố

**Use case:** UC-OPS-02.

- Bảng sự cố: mã, Hub, tài nguyên, mức độ, trạng thái và người xử lý.
- Tìm kiếm và lọc theo các trường liên quan.
- Form ghi nhận sự cố thủ công: tài nguyên, mô tả và thông tin cần thiết trong đặc tả.
- Nếu sự cố trùng đang mở, liên kết tới bản ghi đó thay vì báo đã tạo mới.
- Chọn sự cố để mở trang 12.

### 12. Chi tiết sự cố

**Use case:** UC-OPS-02.

- Nguồn phát hiện, tài nguyên ảnh hưởng, thời điểm, dữ liệu trạng thái và mô tả.
- Tiếp nhận/phân loại sự cố.
- Form phân công hoặc đổi người xử lý, ghi hạn dự kiến và lý do khi cần.
- Tiến độ và lịch sử xử lý.
- Form kỹ thuật: nguyên nhân, hành động khắc phục, kết quả kiểm tra và kết luận đạt/chưa đạt.
- Nhân viên vận hành xem kết quả và xác nhận đóng sự cố khi hợp lệ.

Vẽ hai phiên bản theo quyền: vận hành được tiếp nhận/phân công/đóng; kỹ thuật chỉ cập nhật công việc được giao. Nếu kiểm tra chưa đạt thì sự cố tiếp tục xử lý, tài nguyên chưa được đưa trở lại phục vụ. Không coi việc đóng sự cố là phép gán tài nguyên thành Available.

### 13. Danh sách kế hoạch điều chuyển

**Use case:** UC-OPS-03.

- Bảng kế hoạch: mã, Hub nguồn/đích, số xe, thời gian dự kiến và trạng thái.
- Bộ lọc Hub/trạng thái.
- Tạo kế hoạch mới hoặc mở kế hoạch hiện có ở trang 14.
- Thể hiện liên kết nguồn cảnh báo/khuyến nghị khi kế hoạch có nguồn đó.

### 14. Tạo và chi tiết kế hoạch điều chuyển

**Use case:** UC-OPS-03.

- Form Hub nguồn, Hub đích, danh sách phương tiện và thời gian dự kiến.
- Thông tin khả dụng của xe, khả năng tiếp nhận và tác động dự kiến của phương án.
- Lưu nháp, sửa phương án và xem lại trước phê duyệt.
- Hộp xác nhận phê duyệt; hệ thống kiểm tra lại phương án trước khi chấp nhận.
- Tiến độ thực hiện, kết quả và lịch sử.
- Hộp hủy kế hoạch có lý do theo phạm vi đặc tả.

**Nhánh cần vẽ:** xe vừa bị đặt/bị lỗi, Hub đích không còn khả năng tiếp nhận, không có quyền phê duyệt hoặc cập nhật thất bại. Phê duyệt không có nghĩa xe đã được di chuyển vật lý; tiến độ thực hiện được ghi nhận riêng.

### 15. Không gian mô phỏng

**Use case:** UC-SIM-01.

- Danh sách kịch bản đã lưu; tạo mới, mở hoặc sao chép kịch bản để điều chỉnh.
- Form tham số: phạm vi Hub, khoảng thời gian, nhu cầu giả định và các tham số đã được đặc tả trong Phase 1.
- Xem lại cấu hình và mốc trạng thái cơ sở trước khi chạy.
- Lưu kịch bản nháp mà chưa tạo lần chạy.
- Danh sách các lần chạy, phân biệt với danh sách kịch bản.
- Chi tiết lần chạy: đang chạy, hoàn tất hoặc thất bại; người dùng có thể rời trang rồi mở lại tiến độ.

Có thể dùng tab và các bước trong cùng không gian, không dồn tất cả vào một form dài. Nhóm phải thiết kế rõ tham số sai, không tạo được snapshot và tiến trình chạy lỗi. Không thêm loại tham số mới chỉ để giao diện nhiều lựa chọn hơn.

### 16. Kết quả mô phỏng và khuyến nghị

**Use case:** UC-SIM-02.

- Tóm tắt lần chạy, kịch bản và mốc snapshot.
- Chỉ số/biểu đồ theo Hub và thời gian; so sánh giá trị cơ sở với mô phỏng.
- Bộ lọc Hub/chỉ số.
- Danh sách khuyến nghị và panel chi tiết: hành động, tài nguyên tác động, cơ sở và tác động dự kiến.
- Phần xem lại tham số/giả định mà không chạy lại.
- Hành động tạo kế hoạch điều chuyển, mở trang 14 với dữ liệu đề xuất điền trước.

**Nhánh cần vẽ:** hoàn tất nhưng không có khuyến nghị; lần chạy chưa hoàn tất; dữ liệu kết quả thiếu; không mở được quy trình tạo kế hoạch. Khuyến nghị không tự sửa dữ liệu vận hành thật, vẫn phải xem lại và phê duyệt kế hoạch.

### 17. Công việc kỹ thuật của tôi

**Use case:** phần tham gia của ACT-MNT trong UC-OPS-02.

- Danh sách sự cố được giao, với Hub, tài nguyên, mức độ, hạn dự kiến và trạng thái.
- Bộ lọc công việc, trạng thái chưa có công việc.
- Mở trang 12 theo quyền kỹ thuật để tiếp nhận, cập nhật tiến độ và ghi kết quả.

Không tạo một trang chi tiết khác chỉ vì người xem là Nhân viên kỹ thuật. Dùng lại bố cục nhưng phải vẽ rõ phiên bản quyền kỹ thuật. Không có quyền phê duyệt điều chuyển, chạy mô phỏng hoặc quản lý tài khoản.

## 4. Thành phần và trạng thái dùng chung

Chuẩn bị một bộ thành phần trên Figma để các trang dùng thống nhất:

- Thanh điều hướng theo vai trò, menu tài khoản, breadcrumb hoặc nút quay lại.
- Nút, ô nhập, chọn danh sách, bộ lọc, tab, bảng và phân trang nếu cần.
- Thẻ Hub/tài nguyên, nhãn trạng thái, thời điểm cập nhật và thông tin tiến độ.
- Hộp xác nhận, panel chi tiết và thông báo kết quả.

| Trạng thái | Cách thể hiện |
| --- | --- |
| Đang tải | Phân biệt tải dữ liệu với đang gửi thao tác; tránh gửi lặp. |
| Danh sách rỗng | Phân biệt chưa có dữ liệu với không có kết quả theo bộ lọc. |
| Nhập liệu sai | Chỉ rõ trường sai, giữ nội dung đã nhập để sửa. |
| Thành công | Nêu kết quả thực tế và hành động tiếp theo. |
| Lỗi xử lý | Không báo thành công khi chưa xác nhận được; hướng dẫn kiểm tra/thử lại phù hợp. |
| Dữ liệu cũ | Có thời điểm cập nhật và cảnh báo; không tự ghi đè dữ liệu bằng giá trị giả định. |
| Trạng thái chưa xác định | Không đồng nghĩa tài nguyên hết chỗ, bị lỗi hoặc đang khả dụng. |
| Tài nguyên không còn khả dụng | Nêu nguyên nhân và phương án khác khi có. |
| Phiên hết hạn | Yêu cầu đăng nhập lại, không tự gửi lại thao tác thay đổi dữ liệu. |
| Thiếu quyền | Không tiết lộ dữ liệu ngoài quyền hoặc vẫn cho thao tác bằng đường khác. |
| Chờ xác nhận bên ngoài | Chỉ báo hoàn tất sau khi có xác nhận hợp lệ, đặc biệt nhận/trả xe và check-in/out. |

Các phản hồi đơn giản có thể dùng cùng component. Nhánh làm đổi cách người dùng tiếp tục thao tác thì cần một frame/variant hoặc mô tả tương tác rõ trên prototype. Không phải mọi enum trạng thái đều cần một trang riêng.

## 5. Liên hệ giữa 23 use case và các trang

| Use case | Trang chính liên quan |
| --- | --- |
| UC-HUB-01 — Tra cứu Hub phù hợp | 02 |
| UC-HUB-02 — Xem trạng thái tài nguyên tại Hub | 03 |
| UC-HUB-03 — Xem Hub thay thế | 02, mở 03 khi chọn Hub |
| UC-RES-01 — Đặt phương tiện dùng chung | 03 → 05 |
| UC-RES-02 — Hủy lượt đặt phương tiện | 05 |
| UC-TRIP-01 — Nhận phương tiện đã đặt | 05 → 06 |
| UC-TRIP-02 — Trả phương tiện và kết thúc chuyến đi | 06 |
| UC-PARK-01 — Đặt chỗ đỗ cho xe cá nhân | 03 → 07, hoặc mở trực tiếp 07 |
| UC-PARK-02 — Check-in phương tiện cá nhân | 07 |
| UC-PARK-03 — Check-out phương tiện cá nhân | 07 |
| UC-CHG-01 — Đăng ký nhu cầu sạc | 08 với Sinh viên; 10 với Nhân viên vận hành |
| UC-CHG-02 — Theo dõi lịch và phiên sạc | 08 với Sinh viên; 10 với Nhân viên vận hành |
| UC-CHG-03 — Điều chỉnh lịch sạc ưu tiên | 10 |
| UC-OPS-01 — Giám sát mạng lưới Mobility Hub | 09 |
| UC-OPS-02 — Xử lý sự cố vận hành | 11 → 12 với vận hành; 17 → 12 với kỹ thuật |
| UC-OPS-03 — Điều phối phương tiện giữa các Hub | 13 → 14; có thể đi từ 09 hoặc 16 |
| UC-OPS-04 — Thêm và cập nhật thông tin tài nguyên | 21 |
| UC-OPS-05 — Kích hoạt hoặc ngừng phục vụ tài nguyên | 21 → 22 |
| UC-SIM-01 — Chạy kịch bản What-if Simulation | 15 |
| UC-SIM-02 — Phân tích kết quả và khuyến nghị điều phối | 16; mở 14 nếu tạo kế hoạch |
| UC-GEN-01 — Quản lý tài khoản | 18 |
| UC-GEN-02 — Quản lý vai trò và phạm vi truy cập | 19 |
| UC-GEN-03 — Thiết lập danh mục tài nguyên ban đầu | 20 |

Trang 01 phục vụ xác thực dùng chung; trang 04 là điểm vào các hoạt động cá nhân. Không cần tạo UC mới chỉ để đặt tên cho các trang này.

## 6. Đưa mockup vào báo cáo Phase 2

- Trong Phần III của báo cáo tích hợp, mục Thiết kế giao diện dùng chung đặt đăng nhập, bố cục theo vai trò, bộ thành phần, trạng thái dùng chung và luồng điều hướng.
- Trong từng UC thuộc bảy phân hệ ở Phần III, đặt mockup/form/trạng thái sau sơ đồ use case và bảng đặc tả, trước sequence và activity; bổ sung hình khi một UC có nhiều bước đáng kể.
- Một mockup dùng cho nhiều UC có thể đặt một lần rồi dẫn lại, không phải thiết kế nhiều bản khác nhau cho cùng trang.
- Luồng trên prototype và nội dung hiển thị phải khớp với sequence, activity và đặc tả Phase 1. Tên trạng thái dùng đúng quy chuẩn; có thể kèm nhãn tiếng Việt cho người dùng.

## 7. Phần bổ sung quản trị và tài nguyên

- UC-GEN-01 → trang 18; prototype cấp/sửa/khóa/mở, lỗi trùng tên và chặn Admin cuối cùng.
- UC-GEN-02 → trang 19; prototype xem lại, lưu hoặc thu hồi quyền.
- UC-GEN-03 → trang 20; prototype khai báo Hub/thiết bị và kết quả Draft.
- UC-OPS-04 → trang 21; prototype thêm/sửa thông tin, không sửa telemetry.
- UC-OPS-05 → trang 22; prototype xác nhận ngừng/kích hoạt và trường hợp xe còn lượt đặt.

Các trạng thái là dữ liệu minh họa của prototype; không có backend hoặc thiết bị thật được điều khiển từ Figma. Báo cáo chỉ xuất một màn hình đại diện cho mỗi UC mới.

## 8. Không nằm trong bộ UI hiện tại

Không thêm đăng ký, khôi phục mật khẩu, OTP, SSO, thanh toán, ví, chat hỗ trợ, quản trị Azure/thiết bị IoT hoặc điều khiển điện trực tiếp. Chức năng thêm/sửa thông tin và bật/tắt phục vụ đã có yêu cầu FR-OPS-04–FR-OPS-07; không mở rộng sang xóa lịch sử, chuyển Hub bằng sửa thông tin hoặc điều khiển điện trực tiếp. Nhóm làm website, không thiết kế thêm một mobile app riêng.

UI quản trị tài khoản, phân quyền và danh mục ban đầu theo `FR-GEN-04`–`FR-GEN-08` đã có thiết kế riêng. Không mở rộng quyền Operator để thay cho UI Admin.

**Khối lượng hiện có là 22 trang chính, các form/panel/hộp thoại của chúng và các trạng thái quan trọng.** Tổng frame Figma chỉ chốt được sau khi thống nhất cách gộp và sử dụng component; không cộng mỗi trạng thái thành một chức năng mới.
