# Phase 1 - Phân tích bối cảnh và yêu cầu hệ thống

Phase 1 tập trung vào việc hiểu đúng bài toán và xác định hệ thống phải làm gì. Đây là nền cho UI, các behavioral diagram, class diagram, kiến trúc và MVP ở những phase sau. Nếu requirement chưa rõ hoặc các thành viên hiểu nghiệp vụ khác nhau, toàn bộ tài liệu phía sau sẽ không thể thống nhất.

- Deadline trên LMS: **27/09/2026**
- Review dự kiến trên lớp: **Tuần 7**
- Đề bài gốc: [`../../BTL_SoftwareEngineering_HK261_v1.pdf`](../../BTL_SoftwareEngineering_HK261_v1.pdf)
- Mô tả chung của dự án: [`../../README.md`](../../README.md)
- Quy ước tên, mã, trạng thái và traceability: [`project-conventions.md`](project-conventions.md)
- Nguồn LaTeX của báo cáo group work: [`group-report/main.tex`](group-report/main.tex)

## 1. Nội dung phải hoàn thành

Submission #1 gồm ba phần bắt buộc và một phần bonus.

### 1.1. Project details specification - làm theo nhóm

Phần này phải trình bày:

- Bối cảnh di chuyển trong Khu đô thị ĐHQG-HCM;
- Vấn đề cần giải quyết;
- Lý do hệ thống cần được xây dựng;
- Các stakeholder liên quan;
- Vai trò, nhu cầu và mong đợi của từng stakeholder;
- Mục tiêu của dự án;
- Phạm vi hệ thống;
- System boundary;
- Assumption và constraint.

Đọc xong phần này, một người chưa biết đề tài phải trả lời được:

1. Vì sao hệ thống này cần tồn tại?
2. Ai sử dụng hoặc chịu ảnh hưởng bởi hệ thống?
3. Hệ thống chịu trách nhiệm xử lý những việc nào?
4. Những việc nào nằm ngoài phạm vi?

### 1.2. Functional requirements

Phần yêu cầu chức năng gồm:

- Danh sách functional requirement của toàn hệ thống;
- Các business rule mà chức năng phải tuân theo;
- Use-case diagram cho toàn hệ thống - làm theo nhóm;
- Use-case detail/scenario cho use case từng thành viên phụ trách - làm cá nhân.

Mỗi functional requirement phải có mã riêng, actor hoặc nguồn kích hoạt, hành vi của hệ thống và kết quả cần đạt được.

### 1.3. Non-functional requirements - làm theo nhóm

Nhóm phải xác định các yêu cầu chất lượng chung, bao gồm những vấn đề quan trọng như:

- Tính nhất quán khi nhiều yêu cầu cùng tranh chấp một tài nguyên;
- Tốc độ phản hồi;
- Khả năng cập nhật trạng thái gần thời gian thực;
- Phân quyền giữa sinh viên và người vận hành;
- Tính dễ sử dụng;
- Khả năng ghi lại lịch sử thay đổi;
- Khả năng xử lý khi xe, cổng sạc hoặc nguồn dữ liệu gặp lỗi;
- Khả năng bảo trì và mở rộng.

Không viết các câu chung chung như “hệ thống phải nhanh”, “hệ thống phải bảo mật” hoặc “giao diện phải thân thiện”. Mỗi NFR phải có tiêu chí để kiểm tra được.

### 1.4. Non-interactive functional requirements - bonus

Đây là những chức năng hệ thống tự thực hiện khi có sự kiện hoặc khi đạt một điều kiện nào đó. Các trường hợp phù hợp với đề tài gồm:

- Tự động giải phóng xe khi lượt đặt hết hạn;
- Tự động cập nhật mức sử dụng của Hub khi trạng thái tài nguyên thay đổi;
- Phát cảnh báo khi Hub gần đầy;
- Ưu tiên yêu cầu sạc cho xe pin thấp hoặc có lịch sử dụng gần;
- Đánh dấu tài nguyên không còn sẵn sàng khi nhận sự kiện lỗi;
- Tạo khuyến nghị điều phối sau khi chạy mô phỏng.

Phần bonus được thực hiện sau khi các nội dung bắt buộc đã ổn định.

## 2. Kiến thức nền cần nắm

### 2.1. Bối cảnh, vấn đề và giải pháp

Ba phần này có vai trò khác nhau.

**Bối cảnh** mô tả môi trường mà hệ thống tồn tại:

> Khu đô thị ĐHQG-HCM có nhiều trường, ký túc xá, khu dịch vụ và đầu mối giao thông. Sinh viên cần tiếp tục di chuyển từ ga Metro đến các khu vực bằng phương tiện điện.

**Vấn đề** mô tả khó khăn cần giải quyết:

> Xe, chỗ đỗ và cổng sạc đều có giới hạn và phân bố ở nhiều Hub. Nếu không theo dõi và điều phối thống nhất, một số Hub có thể thiếu xe trong khi nơi khác quá tải.

**Giải pháp** mô tả vai trò của hệ thống:

> Smart E-Mobility Hub theo dõi trạng thái tài nguyên, hỗ trợ sinh viên đặt và sử dụng tài nguyên, đồng thời giúp người vận hành điều phối toàn mạng lưới.

Phase 1 không biến phần giải pháp thành danh sách công nghệ. React, Node.js hay PostgreSQL là quyết định cài đặt ở phase sau, không phải vấn đề nghiệp vụ.

### 2.2. Stakeholder và actor

**Stakeholder** là cá nhân hoặc tổ chức sử dụng, quản lý, cung cấp dữ liệu, chịu ảnh hưởng hoặc quan tâm đến hệ thống.

**Actor** là vai trò trực tiếp tương tác với hệ thống trong một use case.

| Đối tượng | Stakeholder | Actor | Mối quan tâm hoặc tương tác |
|---|---:|---:|---|
| Sinh viên dùng xe chung | Có | Có | Tìm, đặt, nhận và trả xe |
| Sinh viên có xe điện cá nhân | Có | Có | Đặt chỗ đỗ và đăng ký sạc |
| Đơn vị vận hành | Có | Có | Theo dõi, xử lý sự cố, điều phối và mô phỏng |
| Đơn vị quản lý khu đô thị | Có | Có thể không | Quan tâm đến hiệu quả vận hành và khả năng phục vụ |
| Nguồn dữ liệu cảm biến hoặc giả lập | Không phải con người | Có thể là actor phụ | Gửi cập nhật trạng thái vào hệ thống |

Actor là vai trò, không phải tên một người cụ thể.

### 2.3. Mục tiêu, phạm vi và system boundary

**Mục tiêu** là kết quả dự án muốn đạt được:

- Giúp sinh viên tìm và sử dụng phương tiện phù hợp;
- Sử dụng hiệu quả xe, chỗ đỗ và cổng sạc;
- Giảm tình trạng Hub quá tải hoặc thiếu tài nguyên;
- Hỗ trợ người vận hành ra quyết định bằng dữ liệu và mô phỏng.

**Trong phạm vi:**

- Theo dõi Hub, xe, chỗ đỗ và cổng sạc;
- Tìm phương tiện và Hub;
- Đặt, nhận và trả phương tiện;
- Đặt chỗ đỗ;
- Đăng ký và lập lịch sạc;
- Ghi nhận và xử lý sự cố trên phần mềm;
- Điều phối phương tiện;
- Chạy What-if Simulation và đưa ra khuyến nghị.

**Ngoài phạm vi:**

- Chế tạo xe, cảm biến hoặc cổng sạc;
- Sửa chữa phần cứng ngoài thực tế;
- Xây dựng bản đồ 3D phức tạp;
- Triển khai thật cho toàn bộ Khu đô thị ĐHQG-HCM;
- Xây dựng mô hình AI dự báo phức tạp;
- Điều khiển vật lý việc vận chuyển xe giữa các Hub.

System boundary phải phân biệt rõ phần mềm làm gì và con người làm gì. Hệ thống có thể đề xuất chuyển xe từ Hub A sang Hub B, nhưng nhân viên vận hành mới là người thực tế vận chuyển xe.

### 2.4. Assumption và constraint

**Assumption** là điều nhóm tạm xem là đúng để tiếp tục phân tích:

- Mỗi phương tiện có mã định danh duy nhất;
- Mỗi xe tại một thời điểm thuộc một Hub hoặc đang trong chuyến đi;
- Dữ liệu cảm biến có thể được thay bằng dữ liệu giả lập;
- Người vận hành có quyền cập nhật trạng thái sự cố.

**Constraint** là giới hạn dự án phải tuân theo:

- Phải có MVP để demo;
- Được tự chọn ngôn ngữ lập trình;
- Backend không bắt buộc có database;
- Dữ liệu có thể được hard-code;
- Bài cuối nộp bằng một file PDF;
- Việc dùng Generative AI phải được khai báo rõ.

Assumption nào ảnh hưởng đến nghiệp vụ phải được ghi lại. Khi assumption thay đổi, các requirement liên quan cũng phải được kiểm tra lại.

### 2.5. Functional requirement, business rule và NFR

**Functional requirement** trả lời hệ thống phải làm gì:

> FR-RES-01: Hệ thống phải cho phép sinh viên đặt một phương tiện đang sẵn sàng.

**Business rule** là quy tắc nghiệp vụ mà chức năng phải tuân theo:

> BR-RES-01: Một phương tiện chỉ có tối đa một lượt đặt đang hiệu lực tại cùng một thời điểm.

**Non-functional requirement** mô tả chất lượng hoặc điều kiện vận hành:

> NFR-CON-01: Khi có nhiều yêu cầu đặt cùng một xe, hệ thống chỉ được tạo tối đa một lượt đặt thành công.

### 2.6. Tiêu chuẩn của một requirement tốt

Một requirement phải:

- Rõ ràng;
- Chỉ chứa một ý chính;
- Cần thiết đối với stakeholder hoặc mục tiêu dự án;
- Khả thi trong phạm vi bài tập;
- Không mâu thuẫn với requirement khác;
- Có thể kiểm tra được;
- Có ID để theo dõi;
- Liên kết được với stakeholder need và use case.

Mẫu functional requirement:

```text
FR-[NHÓM]-[SỐ]: Hệ thống phải cho phép [actor] [thực hiện hành động]
trên [đối tượng] trong [điều kiện nếu có].
```

Ví dụ:

```text
FR-HUB-01: Hệ thống phải cho phép sinh viên xem danh sách Mobility Hub.

FR-HUB-03: Hệ thống phải hiển thị trạng thái và mức pin của các phương tiện
tại Hub được chọn.

FR-RES-01: Hệ thống phải cho phép sinh viên đặt một phương tiện đang ở
trạng thái Available.
```

Mẫu non-functional requirement:

```text
NFR-[NHÓM]-[SỐ]: [Thành phần hoặc chức năng] phải đạt [tiêu chí đo được]
trong [điều kiện kiểm tra].
```

Ví dụ:

```text
NFR-AUTH-01: Chỉ tài khoản có vai trò Operator mới được thay đổi trạng thái
hoạt động của cổng sạc.

NFR-PERF-01: Các màn hình chính phải phản hồi trong vòng 2 giây trong điều
kiện dữ liệu và số người dùng của môi trường demo.
```

Tránh dùng `nhanh`, `tối ưu`, `thông minh`, `thân thiện` hoặc `bảo mật cao` nếu không có tiêu chí đi kèm.

### 2.7. Use-case diagram

Use-case diagram cho biết:

- Actor nào tương tác với hệ thống;
- Actor muốn đạt mục tiêu gì;
- Use case nào bắt buộc dùng lại hành vi của use case khác;
- Use case nào chỉ mở rộng trong một điều kiện;
- Những use case nào nằm trong system boundary.

Quy tắc chung:

- Actor đứng ngoài system boundary;
- Use case nằm trong system boundary;
- Tên use case dùng động từ và đối tượng, ví dụ `Reserve Vehicle`;
- Đường actor - use case thể hiện sự tham gia, không thể hiện thứ tự;
- `include` dùng cho hành vi luôn xảy ra và được dùng lại;
- `extend` dùng cho hành vi bổ sung chỉ xảy ra trong một điều kiện;
- Không đưa nút bấm, trang UI, controller, database hoặc API vào diagram.

### 2.8. Use-case detail/scenario

Mọi use-case detail dùng cùng một cấu trúc:

```text
Use Case ID:
Use Case Name:
Primary Actor:
Supporting Actors:
Goal:
Trigger:
Preconditions:
Postconditions on success:
Postconditions on failure:
Main Flow:
Alternative Flows:
Exception Flows:
Related Business Rules:
Related Requirements:
```

Main flow phải xen kẽ rõ hành động của actor và phản hồi của hệ thống. Không viết chi tiết kiểu “bấm nút màu xanh”, cũng không đưa tên controller, API hoặc database vào phần này.

Ví dụ ngắn:

```text
1. Sinh viên chọn một phương tiện.
2. Hệ thống hiển thị thông tin và mức pin của phương tiện.
3. Sinh viên xác nhận đặt xe.
4. Hệ thống kiểm tra lại trạng thái phương tiện.
5. Hệ thống tạo lượt đặt và chuyển phương tiện sang Reserved.
6. Hệ thống hiển thị thông tin đặt xe thành công.
```

Exception flow phải ghi rõ cách xử lý khi xe vừa được người khác đặt, xe gặp sự cố hoặc sinh viên không đủ điều kiện tạo thêm lượt đặt.

## 3. Phạm vi nghiệp vụ theo phân hệ

Nhóm chia nghiệp vụ thành bảy phân hệ và chốt 18 use case ở mức mục tiêu người dùng. Cả 18 use case đều được đặc tả trong báo cáo nhóm. Mỗi thành viên nhận một phân hệ làm một nhiệm vụ thống nhất; use case trọng tâm là use case sẽ tiếp tục được phát triển thành các artifact cá nhân ở phase sau.

| Mã | Phân hệ | Use case cá nhân cốt lõi |
|---|---|---|
| `HUB` | Tra cứu Hub và tài nguyên | `UC-HUB-01` - Tra cứu Hub phù hợp |
| `RES` | Đặt phương tiện dùng chung | `UC-RES-01` - Đặt phương tiện dùng chung |
| `TRIP` | Quản lý chuyến đi | `UC-TRIP-02` - Trả phương tiện và kết thúc chuyến đi |
| `PARK` | Quản lý chỗ đỗ xe cá nhân | `UC-PARK-01` - Đặt chỗ đỗ cho xe cá nhân |
| `CHG` | Quản lý sạc và lịch sạc | `UC-CHG-01` - Đăng ký nhu cầu sạc |
| `OPS` | Giám sát và điều phối vận hành | `UC-OPS-02` - Xử lý sự cố vận hành |
| `SIM` | What-if Simulation và khuyến nghị | `UC-SIM-01` - Chạy kịch bản What-if Simulation |

Danh mục hiện tại có 18 use case tương tác và 8 non-interactive functional requirement ứng viên cho phần bonus. Danh mục đầy đủ, actor, thuật ngữ và trạng thái được quản lý tại [`project-conventions.md`](project-conventions.md).

### 3.1. Actor chính

1. **Student:** tìm và sử dụng xe điện dùng chung; đặt chỗ đỗ hoặc đăng ký sạc cho xe cá nhân.
2. **Operator:** theo dõi mạng lưới, xử lý sự cố, điều phối tài nguyên, quản lý lịch sạc và chạy mô phỏng.
3. **Maintenance Staff:** tiếp nhận công việc kỹ thuật và xác nhận kết quả khắc phục sự cố.
4. **State Data Source:** nguồn dữ liệu cảm biến hoặc dữ liệu giả lập cập nhật trạng thái tài nguyên.

### 3.2. Các trạng thái cần thống nhất

Phase 1 chưa yêu cầu state diagram, nhưng requirement và use case sẽ không rõ nếu chưa thống nhất trạng thái cơ bản.

**Vehicle:**

```text
Available, Reserved, InUse, Charging, OutOfService
```

**Vehicle Reservation:**

```text
Pending, Confirmed, Fulfilled, Cancelled, Expired, Rejected
```

**Parking Space:**

```text
Available, Reserved, Occupied, OutOfService
```

**Charging Point:**

```text
Available, Reserved, Charging, OutOfService
```

Các trạng thái còn lại và ý nghĩa đầy đủ được quy định tại [`project-conventions.md`](project-conventions.md). Không dùng nhiều tên khác nhau cho cùng một trạng thái.

## 4. Quy ước đặt ID

Requirement và use case được đánh mã theo phân hệ, không đánh theo actor:

```text
FR-RES-01   Functional requirement của phân hệ đặt phương tiện
BR-RES-01   Business rule của phân hệ đặt phương tiện
UC-RES-01   Use case của phân hệ đặt phương tiện

FR-CHG-01   Functional requirement của phân hệ sạc
BR-CHG-01   Business rule của phân hệ sạc
UC-CHG-01   Use case của phân hệ sạc
```

NFR được đánh mã theo thuộc tính chất lượng, ví dụ `NFR-PERF-01`, `NFR-SEC-01` và `NFR-CON-01`. Toàn bộ quy tắc cấp mã, giữ mã và đặt tên file diagram nằm trong [`project-conventions.md`](project-conventions.md).

Non-interactive functional requirement của phần bonus dùng mã `NIFR-[PHÂN HỆ]-[SỐ]`, ví dụ `NIFR-RES-01`. `NIFR` là chức năng hệ thống tự kích hoạt; `NFR` là yêu cầu chất lượng. Hai loại này không được ghi chung một danh sách.

## 5. Quy trình thực hiện Phase 1

### Bước 1: Đọc và đánh dấu đề bài

- Ghi lại mọi actor, hành động, trạng thái và giới hạn được đề nhắc đến;
- Phân biệt nội dung bắt buộc với ví dụ hoặc khả năng mở rộng;
- Ghi những điểm chưa rõ thành câu hỏi để nhóm thảo luận.

### Bước 2: Chốt project context

- Viết context;
- Viết problem statement;
- Xác định stakeholder và stakeholder need;
- Viết mục tiêu;
- Chốt in-scope, out-of-scope và system boundary;
- Ghi assumption và constraint.

### Bước 3: Lập requirement catalog

- Viết functional requirement;
- Viết business rule;
- Viết non-functional requirement;
- Đặt ID;
- Loại bỏ requirement trùng hoặc mâu thuẫn;
- Kiểm tra requirement có thể chứng minh bằng UI, diagram, code hoặc test ở phase sau.

### Bước 4: Xây dựng use-case model

- Chốt actor;
- Chốt tên use case;
- Xác định quan hệ actor - use case;
- Xác định `include`, `extend` nếu cần;
- Vẽ use-case diagram toàn hệ thống;
- Đối chiếu diagram với requirement catalog.

### Bước 5: Viết use-case detail

- Mỗi use case có mục tiêu và trigger rõ;
- Viết preconditions và postconditions;
- Viết main flow;
- Viết alternative flow;
- Viết exception flow;
- Liên kết business rule và requirement;
- Tự kiểm tra theo checklist chung.

### Bước 6: Tích hợp và kiểm tra

- Ghép các phần thành một tài liệu;
- Chuẩn hóa thuật ngữ và format;
- Kiểm tra traceability;
- Sửa nội dung mâu thuẫn;
- Kiểm tra diagram khi xuất ra PDF;
- Đọc lại toàn bộ như người chấm bài.

## 6. Tự kiểm tra và traceability

### 6.1. Câu hỏi tự kiểm tra bắt buộc

1. Nội dung có đúng đề bài không?
2. Thuật ngữ có khớp glossary không?
3. Actor có đúng vai trò không?
4. Requirement có rõ và kiểm tra được không?
5. Main flow có xen kẽ actor và hệ thống không?
6. Có alternative flow và exception flow quan trọng chưa?
7. Preconditions và postconditions có rõ không?
8. Nội dung có mâu thuẫn với business rule hoặc phần khác không?

### 6.2. Bảng traceability tối thiểu

| Stakeholder need | Requirement | Use case | Trạng thái |
|---|---|---|---|
| Sinh viên cần tìm Hub phù hợp | FR-HUB-01 | UC-HUB-01 | Draft |
| Sinh viên cần giữ trước một xe | FR-RES-01 | UC-RES-01 | Draft |
| Operator cần theo dõi toàn mạng lưới | FR-OPS-01 | UC-OPS-01 | Draft |
| Operator cần đánh giá kịch bản giả định | FR-SIM-01 | UC-SIM-01 | Draft |

Requirement không liên kết được với stakeholder need hoặc use case phải được kiểm tra lại. Use case không có requirement tương ứng cho thấy requirement catalog đang thiếu.

## 7. Definition of Done

### Project context

- Bối cảnh, vấn đề và mục tiêu được trình bày rõ;
- Có danh sách stakeholder và nhu cầu của từng bên;
- Có in-scope, out-of-scope và system boundary;
- Assumption và constraint không bị trộn lẫn.

### Functional requirements

- Mỗi requirement có ID;
- Mỗi requirement chỉ chứa một ý chính;
- Actor hoặc nguồn kích hoạt được xác định rõ;
- Không đưa công nghệ cài đặt vào requirement nghiệp vụ;
- Requirement liên kết được với stakeholder need và use case.

### Use-case diagram

- Có system boundary;
- Actor nằm ngoài hệ thống;
- Use case nằm trong hệ thống;
- Tên use case thống nhất với requirement catalog;
- Quan hệ `include` và `extend` được dùng đúng;
- Diagram bao phủ các chức năng chính của Student và Operator.

### Use-case specification

- Có đủ 18 use-case specification trong báo cáo nhóm;
- Mỗi thành viên hoàn thiện toàn bộ use case thuộc phân hệ được giao;
- Một use case trọng tâm của mỗi thành viên được dùng làm phần cá nhân xuyên suốt các phase;
- Có trigger, preconditions và postconditions;
- Có main flow rõ ràng;
- Có alternative flow và exception flow cần thiết;
- Có business rule và requirement liên quan;
- Được người phụ trách tự kiểm tra theo checklist chung.

### Non-functional requirements

- Có các nhóm chất lượng quan trọng;
- Mỗi NFR có tiêu chí kiểm tra;
- Không dùng từ mơ hồ mà không giải thích;
- Tiêu chí phù hợp với phạm vi MVP.

### Bản nộp cuối

- Không còn nội dung trùng hoặc mâu thuẫn;
- ID và thuật ngữ thống nhất;
- Diagram đọc được khi xuất PDF;
- Không còn comment, placeholder hoặc phần chưa hoàn thành;
- Việc sử dụng AI được ghi lại trung thực;
- Tất cả thành viên đã đọc bản cuối và giải thích được phần của mình.

## 8. Những việc chưa cần làm trong Phase 1

- Chọn framework và database cuối cùng;
- Thiết kế API;
- Thiết kế database schema;
- Viết sequence diagram;
- Viết activity diagram;
- Viết class diagram;
- Viết method description;
- Vẽ deployment view;
- Làm giao diện hoàn chỉnh;
- Xây toàn bộ MVP.

Nhóm có thể phác thảo hoặc thử nhanh để kiểm tra một giả định, nhưng không để việc chọn công nghệ và code chiếm thời gian của requirement.
