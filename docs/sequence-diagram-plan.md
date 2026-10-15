# Kế Hoạch Chuẩn Hóa Hệ Thống Sequence Diagram (OMG UML 2.5)

Tài liệu này tổng hợp toàn diện kết quả rà soát, chuẩn hóa và nâng cấp hệ thống **Sequence Diagram (Sơ đồ tuần tự)** trong ứng dụng Miro-style whiteboard, bám sát đặc tả quốc tế **OMG Unified Modeling Language (OMG UML) Version 2.5.1 (Chương 17: Interactions)** cùng các chuẩn công nghiệp thực tế từ **StarUML**, **Draw.io** và **Lucidchart**.

---

## 1. Mục Tiêu Và Bối Cảnh

Người dùng yêu cầu:
1. **Khắc phục lỗi cửa sổ Shapes biến mất khi click chọn shape**: Giữ panel thư viện shape mở liên tục để người dùng thoải mái duyệt, chọn, đổi shape và đặt nhiều phần tử liên tiếp mà không bị gián đoạn hay đóng panel.
2. **Khắc phục lỗi click trúng đường thẳng/object lại tạo object mới**: Khi con trỏ chuột click đúng vào một object (nhất là đường thẳng, connector hoặc shape), hệ thống phải nhận diện chính xác (`hitPriority`), chọn đúng đối tượng đó và tự động chuyển về công cụ `select`, chấm dứt hoàn toàn tình trạng tự tạo thêm đường thẳng đè lên.
3. **Rà soát và chuẩn hóa toàn bộ Sequence Diagram**: Bám sát 100% chuẩn StarUML, Draw.io, Lucidchart và OMG UML 2.5.

---

## 2. So Sánh Chi Tiết: Hiện Trạng Codebase vs. StarUML / Draw.io / Lucidchart & OMG UML 2.5

| Thành phần Sequence | OMG UML 2.5.1 Specification | StarUML / Draw.io / Lucidchart | Hiện trạng trong Codebase | Cải tiến & Chuẩn hóa |
| :--- | :--- | :--- | :--- | :--- |
| **Lifeline Header & Stem** | Hình chữ nhật tên `[name] [':' type]` hoặc Stick Actor, bên dưới là đường đứt nét thẳng đứng biểu thị trục thời gian. | Hỗ trợ Lifeline chuẩn, Actor Lifeline, Boundary/Control/Entity (ECB) lifelines. Neo message theo tọa độ dọc. | Có `uml.lifeline`, `uml.sequence-actor`, `uml.boundary`, `uml.control`, `uml.entity`. | Bổ sung căn chỉnh inline text editing chính xác cho khung header (38px) và tên actor (26px), ngăn không cho khung edit che toàn bộ thân lifeline. |
| **Execution Specification (Activation Bar)** | Cột chữ nhật hẹp màu trắng/xám nằm trên trục lifeline biểu thị thời gian đối tượng nắm giữ quyền điều khiển. | Thanh activation kéo dài theo trục dọc, hỗ trợ activation lồng nhau (nested activation) cho recursive/self-calls. | Có `uml.activation` với vertical resize policy và tự động tính toán dải kích hoạt. | Chuẩn hóa hit-testing depth để activation bar luôn có ưu tiên hit cao hơn stem lifeline bên dưới. |
| **Destruction Occurrence** | Dấu chữ **X** đậm đặt trên đường đời; đường đứt nét của lifeline chấm dứt tại vị trí này. | Kéo dấu **X** (`uml.destroy`) vào lifeline sẽ tự động cắt ngắn trục thời gian của lifeline. | Đã có thuật toán tính toán `sequenceDestroyPermille` trong `geometry.ts`. | Hoàn thiện đồng bộ di chuyển giữa lifeline và dấu Destroy. |
| **Synchronous Call Message** | Nét liền, đầu mũi tên tam giác đặc tô kín màu đường (`▶`). Người gọi đợi kết quả. | Mũi tên Message mặc định trong Draw.io/StarUML (`solid-triangle` / `arrow`). | `uml.sequence-message` có `endMarker: 'arrow'`. | Chuẩn hóa, tự động gán `sequenceEvent.kind = 'synchronous'`. |
| **Asynchronous Message** | Nét liền, đầu mũi tên hở dạng que (`->`). Người gọi tiếp tục ngay. | Mũi tên Async Message trong StarUML (`openArrow`). | `uml.async-message` có `endMarker: 'openArrow'`. | Chuẩn hóa với đầy đủ nhãn và thứ tự timeline. |
| **Reply / Return Message** | Nét đứt, đầu mũi tên hở dạng que (`-->`). Trả về kết quả từ lời gọi hàm. | Mũi tên Return Message trong StarUML/Draw.io (`dashed` + `openArrow`). | `uml.return-message` có `lineStyle: 'dashed'`, `endMarker: 'openArrow'`. | Chuẩn hóa, hiển thị nhãn mặc định `return`. |
| **Create Message** | Nét đứt/liền có mũi tên hướng thẳng vào đầu khung Lifeline mới được tạo (`<<create>>`). | Mũi tên trỏ vào Header của Lifeline mục tiêu, gắn stereotype `<<create>>`. | `uml.create-message` có nhãn `create`. | Hỗ trợ neo chính xác vào header lifeline được khởi tạo. |
| **Self-Call Message (Tự gọi hàm)** | Lời gọi vòng lặp từ lifeline về chính nó: đi ngang ra, rẽ dọc xuống, rẽ ngang quay về. | Công cụ Self Message trong StarUML & Draw.io (đường 3 đoạn gấp khúc). | Codebase có route `selfLoopKind: 'sequence'` nhưng **chưa có tool độc lập** trong picker. | **Bổ sung tool `uml.self-call-message`** trong thư viện shape để người dùng chọn và vẽ ngay. |
| **Lost Message** | Thông điệp gửi đi nhưng đích đến nằm ngoài phạm vi hoặc bị thất lạc. Điểm đích là hình tròn đen đặc (`●`). | Công cụ Lost Message trong StarUML (`endMarker: 'filledCircle'`). | **Chưa có trong picker.** | **Bổ sung tool `uml.lost-message`** với `endMarker: 'filledCircle'` chuẩn UML 2.5. |
| **Found Message** | Thông điệp nhận được từ nguồn ngoài phạm vi hoặc không xác định. Điểm đầu là hình tròn đen đặc (`●`). | Công cụ Found Message trong StarUML (`startMarker: 'filledCircle'`). | **Chưa có trong picker.** | **Bổ sung tool `uml.found-message`** với `startMarker: 'filledCircle'`, `endMarker: 'arrow'`. |
| **Combined Fragments (Khung tổ hợp)** | Khung chữ nhật có tai góc trên ghi tên toán tử (Operator), các nhánh (Operands) phân cách bởi nét đứt và có guard `[condition]`. | Hỗ trợ 12 toán tử chuẩn OMG UML 2.5: `alt`, `opt`, `loop`, `par`, `critical`, `break`, `seq`, `strict`, `neg`, `assert`, `ignore`, `consider`. | Codebase **chỉ hỗ trợ 4 toán tử** (`alt`, `opt`, `loop`, `par`). | **Mở rộng đầy đủ 12 toán tử OMG UML 2.5**, nâng cấp bộ soạn thảo Operands và Guards trong Shape Properties panel. |

---

## 3. Kiến Trúc Kỹ Thuật Đã Triển Khai

### 3.1. Thư Viện Shape: Cửa Sổ Shapes Luôn Mở (`src/App.tsx`)
- Trong `choosePopoverTool`:
  ```tsx
  const choosePopoverTool = (t: ToolType, contextCategory?: ShapeCategory) => {
    const group = openGroup;
    const keepOpen = group === 'shapes';
    setTool(t, keepOpen, contextCategory);
    if (!keepOpen && group) popoverAnchorRefs.current[group]?.querySelector('button')?.focus();
  };
  ```
- **Kết quả**: Khi duyệt và chọn bất kỳ shape nào trong danh mục Shapes (Sequence, Class, Use Case, Flowchart, Basic,...), popup panel không bao giờ bị biến mất đột ngột. Người dùng tự do chọn shape, xem trạng thái highlight và đặt liên tiếp nhiều đối tượng lên bảng vẽ. Khi click ra ngoài vùng canvas hoặc bấm lại nút Shapes, panel sẽ đóng một cách tự nhiên.

### 3.2. Ưu Tiên Hit-Test Và Tự Động Chuyển Về Select Mode (`src/engine/CanvasEngine.ts`)
1. **Thuật toán `hitPriority`**:
   - Các đối tượng chỉ có đường viền như Connector, Đường thẳng, Mũi tên, Bút vẽ (`isConnectorShape`) được tăng `+500` điểm ưu tiên.
   - Các hình khối 2D có diện tích lớn chịu phạt diện tích (`areaPenalty = Math.min(100, Math.log10(area) * 15)`).
   - **Kết quả**: Khi người dùng click chính xác vào một đường thẳng hoặc mũi tên (dung sai 8px), đường thẳng luôn thắng tuyệt đối so với các hình nền, container hay frame bao quanh.
2. **Xử lý `pointerDown`**:
   - Khi công cụ vẽ connector (`isConnectorTool`) hoặc box shape (`isBoxShapeTool`) đang bật, nếu con trỏ chuột click đúng vào một đường thẳng/connector có sẵn (hoặc click vào body hình khối ngoài connection port):
   - Hệ thống gán `hit = rawHit`, tự động chuyển `this.tool = 'select'`, phát sự kiện `this.onTool?.('select')` và chọn đối tượng vào `this.sel`.
   - **Chấm dứt hoàn toàn lỗi vô tình tạo thêm đường thẳng đè lên đối tượng cũ!**

### 3.3. Bổ Sung Các Message Type Chuẩn UML 2.5
1. **`uml.self-call-message`**:
   - Label: *Self-Call Message*
   - Tuyến đường: Tự động gập 3 đoạn sang phải (`selfLoopKind: 'sequence'`) với mũi tên tam giác hướng về cùng một lifeline.
2. **`uml.lost-message`**:
   - Label: *Lost Message*
   - Tuyến đường: Đường nét liền từ lifeline đến điểm đích hình tròn đen đặc (`endMarker: 'filledCircle'`).
3. **`uml.found-message`**:
   - Label: *Found Message*
   - Tuyến đường: Đường nét liền từ hình tròn đen đặc (`startMarker: 'filledCircle'`) đến lifeline với mũi tên nhọn (`endMarker: 'arrow'`).

### 3.4. Mở Rộng Toàn Bộ 12 Toán Tử Combined Fragment
Trong `src/engine/shapes/types.ts`, `sequence.ts`, `diagramContext.ts` và `src/App.tsx`:
- `SequenceFragmentOperator`:
  1. `alt` — Alternatives (phân nhánh điều kiện if-else)
  2. `opt` — Optional (nhánh tùy chọn if không có else)
  3. `loop` — Repetition (vòng lặp với điều kiện `[min, max]` hoặc `[while cond]`)
  4. `par` — Parallel (các nhánh thực thi song song đa luồng)
  5. `critical` — Critical region (vùng tương tác loại trừ tương hỗ, không bị ngắt)
  6. `break` — Break (ngắt khẩn cấp và thoát khỏi interaction bao quanh)
  7. `seq` — Weak sequencing (tuần tự cục bộ trên từng lifeline)
  8. `strict` — Strict sequencing (tuần tự toàn cục nghiêm ngặt)
  9. `neg` — Negative (dãy thông điệp bị cấm / không hợp lệ)
  10. `assert` — Assertion (dãy thông điệp duy nhất được coi là hợp lệ)
  11. `ignore` — Ignore (bỏ qua các thông điệp chỉ định nếu xuất hiện)
  12. `consider` — Consider (chỉ xét các thông điệp chỉ định, bỏ qua còn lại)
- Giao diện **Shape Properties** cho phép chọn bất kỳ toán tử nào trong 12 toán tử trên, thêm bớt operand linh hoạt (đến 16 operand), chỉnh sửa guard `[condition]` trực tiếp.

### 3.5. Trực Quan Hóa Double-Click Text Editing
- Khi double-click vào **Lifeline**: Khung text editor mở đúng kích thước hộp chữ nhật đầu lifeline (`SEQUENCE_LIFELINE_HEADER_HEIGHT = 38px`), không che thân lifeline.
- Khi double-click vào **Actor Lifeline**: Khung text editor mở đúng dải tên bên dưới hình người que (y: 72, h: 26).
- Khi double-click vào **ECB Roles (Boundary/Control/Entity)**: Khung text editor mở đúng hộp tiêu đề phía trên.
- Khi double-click vào **Combined Fragment (`uml.frame`)**: Khung text editor mở đúng vị trí tab tên toán tử góc trên bên trái.

---

## 4. Kế Hoạch Kiểm Thử Tự Động (Test Suite)

Xây dựng bộ kiểm thử `src/engine/shapes/__tests__/sequence.test.mjs` bao gồm:
1. Kiểm tra đăng ký đầy đủ 12 shape và connector của Sequence Diagram trong Registry.
2. Kiểm tra định danh và ngữ nghĩa 7 loại Sequence Message (`synchronous`, `asynchronous`, `return`, `create`, `self-call`, `lost`, `found`).
3. Kiểm tra chuẩn hóa toàn bộ 12 toán tử Combined Fragment và danh sách Operands/Guards.
4. Kiểm tra render marker `filledCircle` trên canvas và tính toán kích thước bao chiếm `connectorMarkerOccupancy`.
5. Kiểm tra logic ưu tiên hit-test (`hitPriority`) cho đường thẳng so với container.
6. Thêm npm script `"test:sequence": "tsx src/engine/shapes/__tests__/sequence.test.mjs"`.
