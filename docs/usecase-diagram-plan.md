# Kế Hoạch Chuẩn Hóa Hệ Thống Diagram - Bắt Đầu Với Use Case Diagram (UML 2.5)

Tài liệu này phân tích toàn diện hiện trạng hệ thống diagram trong ứng dụng (mục **Shapes** ở sidebar bên trái), xác định các điểm chưa chuẩn so với đặc tả quốc tế OMG UML 2.5, và thiết lập kế hoạch chi tiết từng bước để chuẩn hóa, bắt đầu từ **Use Case Diagram**.

---

## 1. Tổng Quan Kiến Trúc Diagram Hiện Tại

### 1.1. Các Danh Mục Diagram Trong Sidebar Trái
Hiện tại, menu popup khi bấm vào công cụ **Shapes** trên thanh công cụ bên trái quản lý 8 danh mục (`SHAPE_CATEGORIES` trong `src/engine/shapes/types.ts`):
1. **Basic**: Các hình học cơ bản (Rectangle, Ellipse, Triangle, Star,...).
2. **3D Shapes**: Các khối hình học không gian 3D (Cube, Cuboid, Cylinder, Cone, Pyramid,...).
3. **ERD / Database**: Mô hình thực thể quan hệ cơ sở dữ liệu.
4. **Use Case Diagram** ⭐ (Mục tiêu chuẩn hóa đầu tiên).
5. **Class Diagram**: Lớp, interface, abstract class, enumeration, object, quan hệ hướng đối tượng.
6. **Sequence Diagram**: Lifeline, activation bar, sync/async/create/return message, frame, fragment alt/opt/loop.
7. **Activity Diagram**: Action, object node, decision/merge, fork/join, swimlanes/partitions.
8. **State Diagram**: State, composite state với regions, pseudostates, transition.

### 1.2. Chuỗi Xử Lý Cốt Lõi Của Một Shape Diagram
```
[Sidebar Popover Tool Picker] (App.tsx)
          ↓
[Shape Registry & Tool ID Map] (src/engine/shapes/registry.ts)
          ↓
[Semantic Model & Metadata] (src/engine/shapes/semantics.ts & types.ts)
          ↓
[Geometry Engine & Decorations] (src/engine/shapes/geometry.ts)
          ↓
[Canvas Engine Vector Renderer] (src/engine/CanvasEngine.ts: drawDiagramShape, drawDiagramLabel)
          ↓
[Properties & Semantic Data Editor Modal] (App.tsx: shape-properties-panel)
```

---

## 2. Phân Tích Chuyên Sâu Hiện Trạng Của Use Case Diagram

### 2.1. Chuẩn UML 2.5 Yêu Cầu Gì Cho Use Case Diagram?
Theo đặc tả **OMG Unified Modeling Language (OMG UML) Version 2.5.1** (Chương 18: Use Cases):
1. **Actor (Tác nhân)**:
   - Đại diện cho vai trò của người dùng hoặc hệ thống bên ngoài tương tác với chủ thể (subject).
   - Biểu diễn chuẩn: Hình người que (Stick figure) hoặc hình chữ nhật classifier với stereotype `«actor»`.
   - Phân loại thực tế:
     - **Primary Human Actor**: Tác nhân con người chính (người que tiêu chuẩn).
     - **Secondary / System Actor**: Hệ thống ngoài, dịch vụ thanh toán, phần cứng (stereotype `«system»` hoặc `«secondary»`).
     - **Business Actor**: Tác nhân nghiệp vụ (người que có đường gạch chéo qua thân theo chuẩn RUP/Business Modeling).
2. **Use Case (Trường hợp sử dụng)**:
   - Biểu diễn chuẩn: Hình ellipse với tên của use case đặt ở trung tâm.
   - **Extension Points Compartment (Ngăn điểm mở rộng)**: Chuẩn UML 2.5 quy định rõ ràng rằng một Use Case có thể định nghĩa các điểm mở rộng (Extension Points). Khi có điểm mở rộng, ellipse được chia đôi bởi một đường kẻ ngang, nửa dưới liệt kê `extension points` (tên điểm và điều kiện kích hoạt tùy chọn).
   - **Stereotypes**: Hỗ trợ gắn stereotype như `«business use case»` (hoặc nét gạch chéo bên trái theo chuẩn nghiệp vụ), `«abstract»`, `«CRUD»`,...
3. **Subject / System Boundary (Ranh giới hệ thống / Chủ thể)**:
   - Biểu diễn chuẩn: Khung hình chữ nhật bao quanh các use cases của hệ thống, tác nhân nằm bên ngoài ranh giới.
   - Góc trên bên trái hoặc chính giữa phía trên hiển thị tên của chủ thể kèm theo stereotype: `«system»`, `«subsystem»`, `«service»`, hoặc `«component»`.
   - Cơ chế chứa (containment): Khi di chuyển khung System Boundary, các Use Case bên trong phải di chuyển đồng bộ.
4. **Mối Quan Hệ (Relationships & Connectors)**:
   - **Association (Hiệp hội)**: Đường nét liền kết nối giữa Actor và Use Case (giao tiếp 2 chiều).
   - **Directed Association (Hiệp hội có hướng)**: Đường nét liền có mũi tên nhọn chỉ chiều khởi tạo hoặc phản hồi.
   - **Include Dependency (`«include»`)**: Đường nét đứt có mũi tên hở (`openArrow`) hướng từ Base Use Case đến Included Use Case, mang nhãn `«include»`.
   - **Extend Dependency (`«extend»`)**: Đường nét đứt có mũi tên hở (`openArrow`) hướng từ Extension Use Case đến Base Use Case, mang nhãn `«extend»`. Kèm theo tham chiếu đến **Extension Point** và điều kiện (Condition).
   - **Generalization / Inheritance (Tổng quát hóa)**: Đường nét liền có đầu tam giác rỗng (`hollowTriangle`) kết nối Actor kế thừa Actor, hoặc Use Case kế thừa Use Case.
5. **Các Thành Phần Hỗ Trợ Không Thể Thiếu**:
   - **Package (`uml.package`)**: Gom nhóm các Use Case theo phân hệ/module (hiện chỉ có ở Class Diagram, cần hiển thị ở Use Case Diagram).
   - **Note / Comment (`uml.note`)**: Ghi chú mô tả tiền điều kiện (Preconditions) và hậu điều kiện (Postconditions) kèm đường nối đứt nét.

---

### 2.2. So Sánh Chi Tiết: Hiện Trạng vs. Chuẩn UML 2.5

| Thành phần | Hiện trạng trong codebase | Chuẩn UML 2.5 / Mục tiêu chuẩn hóa | Đánh giá |
| :--- | :--- | :--- | :--- |
| **Actor** | Nét vẽ người que cơ bản (`uml.actor`). Tên vẽ cố định ở chân. Chỉ có 4 điểm neo ở đầu/tay/chân. | Thêm điểm neo ở ngực/thân giữa (torso) để nối association ngang thẩm mỹ. Hỗ trợ stereotype (`«system»`, `«business actor»`). | Cần bổ sung điểm neo & stereotype |
| **Use Case** | Ellipse đơn thuần (`uml.use-case`), tự co giãn theo chữ, không có ngăn phụ. | Hỗ trợ cấu trúc **Extension Points** (đường ngăn ngang + danh sách điểm mở rộng). Hỗ trợ stereotype & Business Use Case. | **Thiếu nghiêm trọng** |
| **System Boundary** | Khung chữ nhật (`uml.system-boundary`) có tiêu đề cố định ở góc trái cao 28px. | Cho phép cấu hình stereotype: `«system»`, `«subsystem»`, `«service»`, `«component»`. Cải tiến cơ chế chọn và di chuyển nhóm. | Cần nâng cấp linh hoạt |
| **Include** | Connector nét đứt có nhãn `«include»` (`uml.include`), endMarker `openArrow`. | Chuẩn UML. Cần căn chỉnh nhãn luôn nằm chính giữa đường nối, xoay theo góc đường. | Đạt 85%, cần tinh chỉnh nhãn |
| **Extend** | Connector nét đứt có nhãn cứng `«extend»` (`uml.extend`), hoàn toàn bỏ qua điều kiện. | Cho phép nhập và hiển thị `condition: [điều kiện]` và `extension point: [tên điểm]` dưới nhãn `«extend»`. | **Cần hoàn thiện** |
| **Generalization** | Có sẵn qua connector chung `uml-generalization` (mũi tên tam giác rỗng). | Kết nối hợp lệ Actor ➔ Actor và Use Case ➔ Use Case. Đã có trong semantics. | Đạt chuẩn |
| **Package & Note** | Chỉ xuất hiện trong danh mục Class Diagram. | Đưa `uml.package` và `uml.note` vào `pickerCategories` của Use Case Diagram. | Cần kích hoạt cho Use Case |

---

## 3. Thiết Kế Chi Tiết Các Component Use Case Chuẩn

### 3.1. Mô Hình Dữ Liệu Ngữ Nghĩa (Data Models)
Tạo tệp chuyên biệt `src/engine/shapes/usecaseData.ts` và bổ sung kiểu vào `src/engine/shapes/types.ts`:

```typescript
export interface UMLExtensionPoint {
  id: string;
  name: string;
  explanation?: string;
}

export interface UMLUseCaseData {
  version: 1;
  stereotype?: string;
  extensionPoints?: UMLExtensionPoint[];
  isBusinessUseCase?: boolean;
}

export interface UMLSubjectBoundaryData {
  version: 1;
  stereotype?: 'system' | 'subsystem' | 'service' | 'component' | string;
}

export interface UMLExtendDependencyData {
  version: 1;
  condition?: string;
  extensionPoint?: string;
}
```

### 3.2. Cấu Trúc Đồ Họa & Vẽ Canvas (CanvasEngine & Geometry)
1. **Use Case With Extension Points**:
   - Khi `shape.data?.usecase?.extensionPoints?.length > 0`:
     - Vẽ đường ngăn cách nằm ngang (divider) bên trong ellipse:
       Độ dài dây cung cắt ellipse tại y = y_divider được tính chính xác bằng phương trình ellipse:
       x_half = a * sqrt(1 - ((y_divider - b) / b)^2)
     - Nửa trên: Vẽ tên Use Case (và stereotype nếu có).
     - Nửa dưới: Tiêu đề in nghiêng `extension points` và danh sách các điểm mở rộng căn lề trái.
     - Hàm `growDiagramTextBox` tự động tính toán kích thước tối thiểu để không làm chữ bị tràn ra khỏi đường viền cong của ellipse.
2. **Actor Connection Points**:
   - Bổ sung điểm kết nối `torso` (giữa ngực/thân) tại (cx, shoulderY + (torsoBottom - shoulderY) * 0.5).
   - Điều này giúp các connector từ Actor nối sang các Use Case nằm ngang không bị chéo gãy khúc vào tay hay chân.
3. **Extend Connector Display Label**:
   - Khi có `condition` hoặc `extensionPoint`:
     ```
     «extend»
     condition: [user is logged in]
     extension point: Checkout
     ```

### 3.3. Bảng Thuộc Tính & Trình Soạn Thảo (App.tsx Modal)
Khi người dùng chọn một Use Case hoặc một thành phần trong Use Case Diagram:
1. **Use Case Editor**:
   - Trường nhập Stereotype (chọn nhanh `«use case»`, `«business use case»` hoặc tự nhập).
   - Danh sách Extension Points: Nút "Add Extension Point", ô nhập tên điểm mở rộng, giải thích điều kiện, nút sắp xếp lên/xuống và nút xóa.
2. **System Boundary Editor**:
   - Lựa chọn Stereotype: `None`, `«system»`, `«subsystem»`, `«service»`, `«component»`.
3. **Extend Relationship Editor**:
   - Ô nhập điều kiện kích hoạt `Condition` (ví dụ: `verified user`).
   - Ô nhập `Extension Point` tham chiếu tới.

---


### Giai Đoạn 1.9: Khắc Phục Lỗi Scaling Co Giãn & Double-Click In-Place Editing (Theo Chuẩn Lucidchart, Draw.io, StarUML)
- [x] **Vấn đề 1: Text và các ngăn không co giãn theo kích thước block (Proportional Scaling Flaw)**
  - *Nguyên nhân kỹ thuật*:
    - Tại `CanvasEngine.ts:2568`, cờ `isCanonicalUmlText` và `box.type !== 'diagram'` loại trừ hoàn toàn việc tính `embeddedTextScale` khi resize diagram shape.
    - Tại `CanvasEngine.ts:5540`, biến `fontScale` bị ép cứng bằng `1` khi `canonicalUml === true`, bỏ qua hoàn toàn kích thước thật của shape.
    - Tại nhãn Actor (`CanvasEngine.ts:5674, 5688`), cỡ chữ bị kẹp cứng nhân tạo `Math.min(12.5, fs)` khiến Actor cao 300px vẫn có chữ 12px.
    - Tại System Boundary (`CanvasEngine.ts:5851`), chiều cao thanh tiêu đề và cỡ chữ bị khóa ở 32px / 13.5px bất kể boundary to 1200px.
    - Tại Use Case có Extension Points, khoảng cách đường chia ngăn `dividerY` được tính bằng pixel tuyệt đối thay vì tỷ lệ không gian động, khiến ngăn dưới bị co rúm khi shape phóng to.
  - *Giải pháp chuẩn hóa theo Lucidchart / Draw.io / StarUML*:
    - Kích hoạt tính toán `embeddedTextScale` khi resize và khi tạo mới diagram shape: tỷ lệ scale chữ tỉ lệ thuận với căn bậc 2 diện tích hình học $\sqrt{(w/w_0) \times (h/h_0)}$.
    - Bỏ ép cứng `fontScale = 1`, cho phép `fontScale` phản ánh đúng tỷ lệ phóng to/thu nhỏ của block.
    - Bỏ các giới hạn font trần nhân tạo (`Math.min(12.5, fs)`).
    - Tự động co giãn tỷ lệ Header Banner và typography của System Boundary theo kích thước khung.
    - Tự động co giãn tỷ lệ ngăn trên và ngăn dưới của Use Case with Extension Points (đường dây cung cắt ngang, bullet padding, line-height).

- [x] **Vấn đề 2: Double-click hiện nhầm Sidebar Properties thay vì Inline Text Editor trên Canvas**
  - *Nguyên nhân kỹ thuật*:
    - Tại `CanvasEngine.ts:1322`, sự kiện `doubleClick` bắt `hit.type === 'diagram'` và gọi ngay `this.onEditSemantic?.(hit)`. Thao tác này mở bảng `#shape-properties-panel` ở thanh bên phải, làm gián đoạn trải nghiệm người dùng.
    - Hàm `isDoubleClickTextEditableShape` tại `CanvasEngine.ts:6654` chỉ cho phép `definition?.category === 'Basic'`, chặn toàn bộ diagram shapes.
  - *Giải pháp chuẩn hóa theo Lucidchart / Draw.io / Miro*:
    - Cho phép tất cả các shape Use Case Diagram (`uml.use-case`, `uml.use-case-ext`, `uml.actor`, `uml.system-boundary`, `uml.note`, `uml.package`) cũng như các connector có nhãn được sửa chữ trực tiếp **In-Place Inline Editor** ngay trên canvas thông qua `this.onEditText`.
    - Tính toán khung `editBox` và căn lề text (`textAlign`) khớp chuẩn xác với vị trí hiển thị text thực tế (giữa ellipse đối với Use Case, ngăn trên đối với Use Case Ext, dưới chân đối với Actor, thanh header đối với System Boundary).
    - Panel Properties bên phải chỉ mở khi người dùng chủ động mở cấu hình thuộc tính nâng cao (thêm/xóa Extension Points, chọn Stereotype), không cản trở việc gõ chữ thông thường.

---

## 5. Kế Hoạch Triển Khai Tiếp Theo (Lộ Trình)
Sau khi Use Case Diagram đã hoàn thiện tuyệt đối cả về giao diện, tỷ lệ co giãn động và trải nghiệm tương tác inline:
1. **Class Diagram**: Nâng cấp quan hệ N-ary, association classes, template/generic classes, compartments.
2. **Sequence Diagram**: Tối ưu hóa lifelines, nested activations, gate events.
3. **Activity Diagram**: Tối ưu hóa pin objects, interruptible regions, exception handlers.
4. **State Diagram**: Tối ưu hóa orthogonal regions, internal transitions, deferrable triggers.

---

*Tài liệu này được cập nhật nhằm đảm bảo tuân thủ nghiêm ngặt tiêu chuẩn thiết kế và tương tác quốc tế.*

