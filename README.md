# Smart E-Mobility Hub

Đây là bài tập lớn môn Công nghệ phần mềm học kỳ 261. Nội dung bên dưới được tổng hợp từ đề bài và thông báo trên LMS để cả nhóm theo dõi trong suốt quá trình làm dự án. File đề gốc được lưu tại [`assignment-details/BTL_SoftwareEngineering_HK261_v1.pdf`](assignment-details/BTL_SoftwareEngineering_HK261_v1.pdf).

## 1. Đề tài đang giải quyết bài toán gì?

Khu đô thị ĐHQG-HCM có nhiều trường đại học, ký túc xá, thư viện, khu dịch vụ và các đầu mối giao thông công cộng. Khi Metro số 1 đi vào hoạt động, sinh viên có thể đến ga ĐHQG rồi tiếp tục di chuyển giữa các khu vực bằng xe đạp điện, xe máy điện hoặc những loại phương tiện điện dùng chung khác.

Bài toán vì vậy không dừng ở chuyện quản lý danh sách xe. Hệ thống còn phải phối hợp nhiều loại tài nguyên có giới hạn tại nhiều địa điểm khác nhau:

- Phương tiện nào đang sẵn sàng, đang được sử dụng, đang sạc hoặc đang gặp sự cố?
- Mỗi Hub còn bao nhiêu chỗ đỗ và cổng sạc?
- Xe có đủ pin cho nhu cầu sử dụng sắp tới hay không?
- Khi nhiều người cùng đặt xe, đặt chỗ hoặc đăng ký sạc, tài nguyên nên được phân bổ thế nào?
- Khi một Hub sắp đầy hoặc thiếu xe, đơn vị vận hành nên điều phối ra sao?
- Nếu nhu cầu tăng đột biến hoặc một phần hạ tầng gặp sự cố, toàn mạng lưới sẽ bị ảnh hưởng như thế nào?

Hệ thống cần xây dựng có tên **Smart E-Mobility Hub**, dùng để quản lý và điều phối mạng lưới phương tiện điện trong Khu đô thị ĐHQG-HCM.

## 2. Mobility Hub là gì?

Một Mobility Hub là điểm tập trung các tài nguyên phục vụ việc di chuyển bằng phương tiện điện. Các Hub có thể được đặt tại ga Metro, ký túc xá, khu trường đại học hoặc khu dịch vụ.

Mỗi Hub bao gồm:

- Các vị trí đỗ xe;
- Các cổng sạc;
- Các phương tiện điện dùng chung;
- Thông tin về sức chứa và mức độ sử dụng hiện tại.

Trạng thái của xe, mức pin, tình trạng chỗ đỗ, tình trạng cổng sạc và mức độ sử dụng của Hub được cập nhật gần thời gian thực. Dữ liệu này có thể đến từ thiết bị IoT thật hoặc do nhóm tự mô phỏng.

## 3. Người dùng và nhu cầu của họ

### 3.1. Sinh viên sử dụng phương tiện dùng chung

Sinh viên cần có khả năng:

- Tìm phương tiện và Hub phù hợp với hành trình;
- Xem xe nào đang sẵn sàng và mức pin hiện tại của xe;
- Đặt trước một phương tiện;
- Nhận xe tại Hub;
- Trả xe sau khi kết thúc hành trình;
- Xem hoặc đặt chỗ đỗ phù hợp;
- Gửi yêu cầu sạc khi cần.

Luồng sử dụng chính là: tìm Hub và xe phù hợp, xem tình trạng tài nguyên, đặt xe, nhận xe, thực hiện hành trình rồi trả xe tại một Hub có khả năng tiếp nhận.

### 3.2. Sinh viên sử dụng phương tiện điện cá nhân

Với xe điện cá nhân, nhu cầu chính không phải là thuê xe mà là sử dụng tài nguyên tại Hub. Sinh viên có thể:

- Tìm Hub phù hợp;
- Đặt trước vị trí đỗ;
- Đăng ký một phiên hoặc lịch sạc tại Hub đã chọn.

Khi xử lý yêu cầu, hệ thống phải cân nhắc sức chứa bãi đỗ, số cổng sạc có thể sử dụng, nhu cầu dự kiến và các yêu cầu khác đang chờ xử lý.

### 3.3. Đơn vị vận hành

Đơn vị vận hành cần nhìn được tình trạng của toàn bộ mạng lưới, thay vì chỉ theo dõi từng Hub riêng lẻ. Các công việc chính gồm:

- Theo dõi trạng thái xe và cổng sạc;
- Theo dõi sức chứa và mức độ sử dụng của từng Hub;
- Phát hiện Hub có nguy cơ quá tải hoặc thiếu tài nguyên;
- Điều chuyển phương tiện giữa các Hub;
- Xử lý xe hỏng, cổng sạc ngừng hoạt động và các sự cố vận hành khác;
- Điều chỉnh lịch sạc;
- Hướng người dùng sang Hub thay thế khi cần;
- Chạy mô phỏng What-if để đánh giá một tình huống trước khi áp dụng thay đổi thật.

## 4. Các nhóm chức năng cốt lõi

### 4.1. Quản lý trạng thái mạng lưới

Hệ thống phải biểu diễn được trạng thái hiện tại của các Hub và tài nguyên bên trong chúng. Những dữ liệu quan trọng gồm:

- Trạng thái và vị trí của phương tiện;
- Mức pin của phương tiện;
- Tình trạng trống hoặc đã sử dụng của chỗ đỗ;
- Tình trạng sẵn sàng, đang dùng hoặc gặp sự cố của cổng sạc;
- Sức chứa và mức độ sử dụng của Hub;
- Các sự kiện vận hành đang xảy ra.

Đây là phần nền cho hầu hết chức năng còn lại. Nếu trạng thái không nhất quán, hệ thống có thể cho hai người đặt cùng một xe, nhận thêm xe khi Hub đã đầy hoặc xếp lịch vào một cổng sạc đang hỏng.

### 4.2. Tìm kiếm và lựa chọn tài nguyên

Hệ thống hỗ trợ sinh viên tìm Hub, phương tiện, chỗ đỗ hoặc khả năng sạc phù hợp. Kết quả không nên chỉ dựa vào vị trí mà còn cần xét trạng thái sẵn sàng, mức pin, sức chứa và nhu cầu dự kiến.

### 4.3. Đặt chỗ và sử dụng phương tiện

Nhóm chức năng này bao gồm đặt xe, đặt chỗ đỗ, nhận xe và trả xe. Mỗi lượt đặt cần có vòng đời rõ ràng, gồm lúc tạo yêu cầu, xác nhận, sử dụng, hoàn tất, hủy hoặc hết hạn. Hệ thống cũng phải xử lý trường hợp nhiều yêu cầu cùng nhắm đến một tài nguyên.

### 4.4. Đăng ký và lập lịch sạc

Tài nguyên sạc có giới hạn nên hệ thống cần tiếp nhận yêu cầu, xếp lịch và xác định thứ tự ưu tiên. Đề bài gợi ý ưu tiên những xe có mức pin thấp hoặc có lịch sử dụng gần. Mục tiêu là tận dụng cổng sạc hiệu quả, hạn chế quá tải và giảm thời gian chờ không cần thiết.

### 4.5. Điều phối phương tiện giữa các Hub

Khi xe tập trung quá nhiều tại một nơi nhưng lại thiếu ở nơi khác, đơn vị vận hành cần có phương án phân phối lại. Quyết định điều phối nên dựa trên trạng thái hiện tại, sức chứa còn lại và nhu cầu được dự báo hoặc mô phỏng.

### 4.6. Quản lý sự cố

Hệ thống cần phản ánh được các sự cố như xe hỏng hoặc cổng sạc không thể hoạt động. Sự cố phải ảnh hưởng đúng đến khả năng đặt và phân bổ tài nguyên; một tài nguyên đang lỗi không thể tiếp tục được xem là sẵn sàng.

### 4.7. What-if Simulation

Đây là một chức năng quan trọng của đề tài. Từ trạng thái hiện tại của mạng lưới, người vận hành có thể đưa vào một kịch bản giả định và xem hệ thống có thể diễn biến như thế nào trước khi quyết định áp dụng thay đổi ngoài thực tế.

Các kịch bản mẫu được nêu trong đề gồm:

- Lượng sinh viên đến ga Metro tăng đột biến vào giờ cao điểm;
- Một Hub đạt giới hạn chỗ đỗ;
- Nhu cầu sạc tăng mạnh;
- Một số cổng sạc bị hỏng;
- Quá nhiều phương tiện tập trung tại cùng một khu vực.

Kết quả mô phỏng cần giúp đánh giá ảnh hưởng lên khả năng phục vụ và đưa ra phương án điều phối phù hợp, chẳng hạn:

- Chuyển bớt phương tiện sang Hub khác;
- Điều chỉnh lịch sạc;
- Hướng người dùng đến một Hub thay thế.

What-if Simulation không bắt buộc phải dùng AI hay mô hình dự đoán phức tạp. Nhóm có thể mô phỏng bằng dữ liệu và các quy tắc rõ ràng. Phần này phải thể hiện được đầu vào của kịch bản, cách trạng thái mạng lưới thay đổi, kết quả mô phỏng và lý do đưa ra khuyến nghị.

## 5. Các đối tượng nghiệp vụ chính

Các tài liệu use-case, sequence diagram, class diagram và phần cài đặt sẽ xoay quanh những đối tượng nghiệp vụ sau:

- **Mobility Hub:** một địa điểm chứa các tài nguyên di chuyển;
- **Vehicle:** phương tiện điện dùng chung hoặc phương tiện cá nhân có liên quan đến việc đỗ và sạc;
- **Parking Space:** vị trí đỗ tại một Hub;
- **Charging Point:** cổng sạc có trạng thái và lịch sử dụng riêng;
- **Vehicle Reservation:** lượt đặt phương tiện dùng chung;
- **Parking Reservation:** lượt đặt trước chỗ đỗ;
- **Charging Request/Session:** yêu cầu và phiên sạc được xếp lịch;
- **Trip/Rental:** quá trình nhận, sử dụng và trả phương tiện;
- **Operational Incident:** sự cố ảnh hưởng đến xe, cổng sạc hoặc Hub;
- **Simulation Scenario:** tập hợp điều kiện giả định dùng để chạy mô phỏng;
- **Coordination Recommendation:** phương án điều phối được đưa ra sau khi đánh giá trạng thái hoặc mô phỏng.

## 6. Phạm vi của bài tập

### Trọng tâm cần đầu tư

- Quản lý và chuyển đổi trạng thái;
- Phân bổ tài nguyên có giới hạn;
- Xử lý đặt chỗ;
- Lập lịch sạc;
- Điều phối phương tiện;
- Xử lý sự kiện và sự cố;
- Mô phỏng kịch bản vận hành;
- Phân tích sự tương tác giữa nhiều tác nhân và nhiều quy trình nghiệp vụ;
- Thể hiện các quyết định phân tích, thiết kế và cài đặt bằng tài liệu Công nghệ phần mềm.

### Không thuộc trọng tâm của đề tài

- Phát triển phần cứng IoT thật;
- Xây dựng bản đồ 3D phức tạp;
- Cài đặt một hệ thống phân tán quy mô lớn;
- Dùng AI/ML cho việc dự báo hoặc ra quyết định;
- Xây dựng backend có cơ sở dữ liệu hoàn chỉnh.

Đề cho phép dùng dữ liệu giả lập. Phần demo MVP có thể dùng dữ liệu viết trực tiếp trong mã nguồn và không bắt buộc có database. Trước hết, nhóm cần làm rõ nghiệp vụ và xây dựng được các luồng demo chạy nhất quán; công nghệ sẽ được chọn theo phạm vi MVP.

## 7. Các yêu cầu phi chức năng

Trong Submission #1, nhóm phải xác định các yêu cầu phi chức năng chung cho toàn hệ thống. Phần này cần xem xét:

- Tính nhất quán khi nhiều yêu cầu cùng thay đổi một tài nguyên;
- Tốc độ cập nhật và hiển thị trạng thái gần thời gian thực;
- Khả năng phục hồi hoặc xử lý khi dữ liệu cảm biến, xe hay cổng sạc gặp lỗi;
- Tính dễ sử dụng đối với sinh viên và người vận hành;
- Khả năng theo dõi lịch sử đặt chỗ, sạc, điều phối và sự cố;
- Bảo vệ tài khoản và quyền truy cập theo vai trò;
- Hiệu năng khi số Hub, phương tiện hoặc yêu cầu tăng lên;
- Khả năng bảo trì, kiểm thử và mở rộng hệ thống.

Mỗi yêu cầu phi chức năng phải được mô tả rõ ràng, có tiêu chí kiểm tra được và phù hợp với bối cảnh của dự án.

## 8. Yêu cầu làm việc nhóm

- Nhóm được giảng viên phân ngẫu nhiên;
- Mỗi thành viên đều phải tham gia các phần phân tích yêu cầu, thiết kế kiến trúc và thiết kế chi tiết;
- Nhóm nên họp ít nhất một lần mỗi tuần;
- Buổi họp đầu tiên cần thống nhất cách giao tiếp, mức độ cam kết, các rủi ro thường gặp và cách giải quyết khi có vấn đề;
- Mỗi buổi họp cần có biên bản để theo dõi công việc và quyết định của nhóm;
- Cuối học kỳ, các thành viên sẽ phản hồi và đánh giá hiệu quả làm việc của cá nhân lẫn toàn nhóm.

Việc một số sản phẩm được ghi là “group work” không có nghĩa là chỉ một người làm rồi những người còn lại sử dụng lại. Mọi thành viên vẫn phải hiểu các quyết định chung và tự thực hiện phần cá nhân được giao.

## 9. Các lần nộp bài

### Submission #1 - Phân tích bối cảnh và yêu cầu

Phần làm chung của nhóm:

- Mô tả chi tiết bối cảnh dự án;
- Xác định stakeholder, vai trò và mong đợi của từng bên;
- Xác định mục tiêu, phạm vi và ranh giới của hệ thống;
- Xây dựng use-case diagram cho toàn hệ thống;
- Xây dựng các yêu cầu phi chức năng chung.

Phần làm cá nhân:

- Viết use-case detail/scenario cho use case mà thành viên phụ trách.

Phần bonus:

- Các yêu cầu chức năng không mang tính tương tác.

Deadline theo thông báo trên LMS: **27/09/2026**. Lịch review dự kiến trên lớp: **tuần 7**.

### Submission #2 - UI và các biểu đồ hành vi

Phần làm chung của nhóm:

- Thiết kế UI dưới dạng mockup.

Phần làm cá nhân:

- Sequence diagram;
- Activity diagram.

Phần bonus:

- State-chart diagram.

Deadline theo thông báo trên LMS: **25/10/2026**. Lịch review dự kiến trên lớp: **tuần 11**.

### Submission #3 - Thiết kế hệ thống

Nội dung cần nộp:

- Deployment view;
- Development/Implementation view;
- Class diagram;
- Mô tả lớp và mô tả toàn bộ method xuất hiện trong class diagram.

Phần bonus:

- Test case.

Deadline theo thông báo trên LMS: **08/11/2026**. Lịch review dự kiến trên lớp: **tuần 13**.

### Submission cuối kỳ

Nhóm chỉ nộp **một file PDF**, trong đó phải có:

- Toàn bộ nội dung của Submission #1, #2 và #3;
- Phần trình bày một bản demo hoạt động bằng chuỗi màn hình;
- Tuyên bố rõ nhóm đã sử dụng Generative AI như thế nào, gồm công cụ, phạm vi sử dụng và mức độ đóng góp.

Buổi trình bày của sinh viên dự kiến diễn ra vào **tuần 15**.

> Các deadline và lịch review dự kiến ở trên được lấy từ thông báo trên LMS. Nhóm vẫn nên kiểm tra LMS thường xuyên để không bỏ lỡ thay đổi hoặc hướng dẫn bổ sung từ giảng viên.

## 10. Yêu cầu đối với MVP và phần demo

Nhóm phải phát triển một MVP và trình diễn được toàn bộ dự án. Giảng viên cho phép tự chọn ngôn ngữ và công nghệ, ví dụ HTML, JavaScript, Python hoặc C#.

Các điểm cần nhớ:

- Không bắt buộc phải có database ở backend;
- Có thể hard-code dữ liệu trong mã nguồn;
- Cần chuẩn bị slide trình bày;
- Nên tập demo nhiều lần trước khi trình bày;
- Nội dung trình bày cần đi thẳng vào vấn đề;
- Demo phải đúng, ngắn gọn và có chất lượng;
- Phần trình bày nên nêu những bài học mà nhóm rút ra trong quá trình làm dự án.

MVP không cần bao phủ mọi tình huống có thể xảy ra, nhưng các luồng được chọn để demo phải chạy liền mạch và thể hiện được giá trị cốt lõi của hệ thống. Một giao diện nhiều màn hình nhưng không có logic trạng thái nhất quán sẽ không thể hiện tốt trọng tâm của đề tài.

## 11. Quy định về sử dụng Generative AI

Giảng viên không cấm sử dụng AI, nhưng nhóm bắt buộc phải khai báo minh bạch và sử dụng có trách nhiệm.

AI nên được dùng như công cụ hỗ trợ tìm ý tưởng, tham khảo, rà soát hoặc gợi mở hướng giải quyết. Sau đó, thành viên phải tự phân tích, chỉnh sửa và bổ sung đóng góp của mình. Mỗi người cần hiểu và giải thích được nội dung mà mình nộp.

Những trường hợp lạm dụng AI, sao chép nguyên văn, không hiểu bài hoặc cố tình che giấu mức độ sử dụng có thể bị trừ điểm nặng hoặc không được chấm bài. Vì vậy, trong suốt quá trình làm dự án, nhóm nên ghi lại:

- Công cụ AI đã sử dụng;
- AI được dùng cho công việc nào;
- Đầu ra của AI đã được kiểm tra và thay đổi ra sao;
- Phần đóng góp thực tế của các thành viên.

Thông tin này sẽ giúp nhóm viết tuyên bố sử dụng AI trong tài liệu cuối kỳ một cách trung thực, thay vì phải nhớ lại vào phút cuối.

## 12. Những việc nhóm cần thống nhất sớm

Đề bài chưa quy định chi tiết mọi quy tắc nghiệp vụ. Trước khi làm use-case diagram, nhóm cần họp và thống nhất các vấn đề sau:

- MVP sẽ tập trung vào những luồng nghiệp vụ nào;
- Hệ thống phân biệt xe dùng chung và xe cá nhân ra sao;
- Các trạng thái hợp lệ của xe, chỗ đỗ, cổng sạc và lượt đặt;
- Điều kiện đặt, xác nhận, hủy và hết hạn một lượt đặt;
- Cách tránh xung đột khi nhiều người cùng yêu cầu một tài nguyên;
- Quy tắc ưu tiên sạc;
- Khi nào một Hub được xem là sắp quá tải;
- Quy trình xử lý xe hỏng hoặc cổng sạc hỏng;
- Đầu vào, đầu ra và quy tắc thay đổi trạng thái của What-if Simulation;
- Tiêu chí để hệ thống đề xuất điều chuyển xe, đổi lịch sạc hoặc chuyển người dùng sang Hub khác;
- Phạm vi nào thuộc hệ thống và phạm vi nào do con người hoặc hệ thống ngoài chịu trách nhiệm.

Mỗi quyết định nên được ghi vào biên bản họp. Làm như vậy sẽ giúp use case, UI, sequence diagram, class diagram và MVP không mâu thuẫn với nhau ở các lần nộp sau.

## 13. Tóm tắt mục tiêu

Nhóm cần phân tích, thiết kế và xây dựng một MVP cho hệ thống điều phối mạng lưới phương tiện điện tại ĐHQG-HCM, trong đó nhiều người dùng cùng chia sẻ xe, chỗ đỗ và cổng sạc; đơn vị vận hành phải theo dõi trạng thái, xử lý sự cố, cân bằng tài nguyên giữa các Hub và thử nghiệm các kịch bản What-if trước khi ra quyết định.
