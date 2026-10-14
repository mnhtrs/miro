# Kế Hoạch Chuẩn Hóa Hệ Thống Diagram - Giai Đoạn 2: Class Diagram (UML 2.5)

Tài liệu này phân tích toàn diện hiện trạng mô hình **Class Diagram** trong hệ thống (danh mục **Class Diagram** ở sidebar bên trái), đối chiếu chi tiết với đặc tả quốc tế **OMG Unified Modeling Language (OMG UML) Version 2.5.1 (Chương 9: Classification, Chương 10: Simple Classifiers, Chương 11: Structured Classifiers)**, và thiết lập lộ trình chuẩn hóa kiến trúc, dữ liệu ngữ nghĩa, vector rendering, cũng như trải nghiệm tương tác (in-place inline editing, proportional scaling, auto-layout) theo chuẩn công nghiệp **StarUML, Lucidchart, Draw.io**.

---

## 1. Tổng Quan Kiến Trúc Class Diagram Hiện Tại

### 1.1. Vị Trí Trong Ứng Dụng
Trong thanh công cụ hình học (Shape Popover Tool Picker tại `App.tsx`):
- Danh mục `Class Diagram` (mã `C` / `'Class Diagram'`) hiện chứa các phần tử:
  1. **Class (`uml.class`)**: Classifier hình chữ nhật 3 ngăn (Name, Attributes, Operations).
  2. **Abstract Class (`uml.abstract-class`)**: Lớp trừu tượng với stereotype `«abstract»`.
  3. **Interface (`uml.interface`)**: Giao diện với stereotype `«interface»` và ngăn Operations.
  4. **Enumeration (`uml.enumeration`)**: Kiểu liệt kê với stereotype `«enumeration»` và ngăn Literals.
  5. **Object (`uml.object`)**: Thể hiện đối tượng (Instance Specification) với quy tắc gạch chân tên và danh sách slot value.
  6. **Package (`uml.package`)** & **Module (`uml.module`)**: Container gom nhóm thư mục/gói.
  7. **Component (`uml.component`)**, **Provided Interface (`uml.provided-interface`)**, **Required Interface (`uml.required-interface`)**: Các phần tử mô hình hóa cấu trúc thành phần.
  8. **Note (`uml.note`)**: Ghi chú chú thích.
  9. **Quan hệ (Connectors)**:
     - Association (`uml-association`)
     - Directed Association (`uml-directed-association`)
     - Aggregation (`uml-aggregation` - hình thoi rỗng ở đầu source)
     - Composition (`uml-composition` - hình thoi đặc ở đầu source)
     - Generalization (`uml-generalization` - tam giác rỗng ở đầu target)
     - Dependency (`uml-dependency` - nét đứt mũi tên hở)
     - Realization (`uml-realization` - nét đứt tam giác rỗng)
     - Usage (`uml-usage` - nét đứt với stereotype `«use»`)
     - Assembly Connector (`uml-assembly-connector` - nối lollipop & socket)

### 1.2. Chuỗi Xử Lý Cốt Lõi Của Classifier
```
[Tool Picker Popover] (App.tsx)
          ↓
[Shape Registry: defaultData.classifier] (src/engine/shapes/registry.ts)
          ↓
[Semantic Model & Validation] (src/engine/shapes/classifier.ts & semantics.ts)
          ↓
[Geometry Layout: Compartment Slicing] (src/engine/shapes/geometry.ts)
          ↓
[Canvas Engine Rendering: drawDiagramShape & drawDiagramLabel] (src/engine/CanvasEngine.ts)
          ↓
[In-place Direct Canvas Editor & Properties Panel] (App.tsx)
```

---

## 2. Phân Tích Chuyên Sâu: Hiện Trạng vs. Chuẩn UML 2.5

### 2.1. Yêu Cầu Cốt Lõi Của Chuẩn OMG UML 2.5.1
Theo đặc tả **OMG UML 2.5.1**:

1. **Cấu Trúc Các Ngăn (Compartments)**:
   - **Name Compartment**:
     - Stereotype: Đặt giữa cặp dấu ngoặc kép `«...»` phía trên tên class (vd: `«interface»`, `«utility»`, `«enumeration»`, `«entity»`, `«control»`, `«boundary»`).
     - Class Name: In đậm. Nếu là Abstract Class, tên phải được **In Nghiêng** (*Italic*) hoặc gắn `{abstract}`.
     - Namespace / Package: Hiển thị nhỏ phía trên tên (vd: `com::domain::model`).
     - Tagged values / Constraints: `{author=...}`, `{version=...}`.
   - **Attributes (Properties) Compartment**:
     - Cú pháp chuẩn UML 2.5: `visibility [/] name [: type] [ [multiplicity] ] [= default] [{property-modifiers}]`
     - Visibility tokens:
       - `+` : Public
       - `-` : Private
       - `#` : Protected
       - `~` : Package / Default
       - `/` : Derived (thuộc tính tính toán từ thuộc tính khác)
     - **Static Attribute (Classifier Scope)**: Bắt buộc phải **GẠCH CHÂN (Underline)** tên thuộc tính.
     - Modifiers: `{readOnly}`, `{id}`, `{unique}`, `{ordered}`.
   - **Operations Compartment**:
     - Cú pháp chuẩn UML 2.5: `visibility name [(parameter-list)] [: return-type] [{operation-modifiers}]`
     - Parameter list: `[direction] name : type [= default]` với direction gồm `in`, `out`, `inout`.
     - **Static Method**: Bắt buộc phải **GẠCH CHÂN (Underline)** tên phương thức.
     - **Abstract Method**: Bắt buộc phải **IN NGHIÊNG (Italic)**.
     - Modifiers: `{query}`, `{abstract}`, `{leaf}`, `{concurrent}`.
   - **Optional Compartments (Ngăn mở rộng)**:
     - Responsibilities compartment: Liệt kê trách nhiệm nghiệp vụ của lớp.
     - Exceptions compartment: Danh sách lỗi mà lớp có thể ném ra.
     - Template Parameters: Ô chữ nhật nét đứt ở góc trên bên phải cho Generics/Template (vd: `T`, `K, V`).

2. **Các Classifier Đặc Biệt**:
   - **Interface**:
     - Dạng 2D Table: Ngăn tiêu đề `«interface»`, không có thuộc tính thông thường (chỉ hằng số tĩnh nếu có), ngăn Operations chỉ chứa các method trừu tượng.
     - Dạng Lollipop/Socket: Ký hiệu hình tròn có cuống (`uml.provided-interface`) và hình vòm cung đón (`uml.required-interface`) khi thể hiện kiến trúc component/service.
   - **Enumeration**:
     - Ngăn tiêu đề `«enumeration»`.
     - Ngăn Literals: Danh sách các hằng số enum (vd: `PENDING`, `APPROVED`, `REJECTED`).
   - **Object / Instance Specification**:
     - Tên bắt buộc phải **GẠCH CHÂN TOÀN BỘ**: `<u>objectName : ClassName</u>` hoặc `<u>: ClassName</u>`.
     - Ngăn Slots: `attribute = value`.
   - **Data Type / Struct**:
     - Stereotype `«dataType»` hoặc `«struct»`.

3. **Mối Quan Hệ Hướng Đối Tượng (UML Connectors)**:
   - **Association (Hiệp hội)**: Đường nét liền. Hỗ trợ role name và multiplicity ở cả hai đầu (`0..1`, `1`, `*`, `1..*`). Hỗ trợ reading direction indicator (`►`).
   - **Aggregation (Tụ hợp - Quan hệ Has-A lỏng)**: Đường nét liền có hình thoi rỗng (`diamond`) ở phía Whole/Aggregate.
   - **Composition (Hợp thành - Quan hệ Has-A chặt)**: Đường nét liền có hình thoi đặc (`filledDiamond`) ở phía Composite/Owner. Khi xóa owner thì part bị xóa theo.
   - **Generalization (Kế thừa / Đơn hình)**: Đường nét liền có đầu tam giác rỗng lớn (`hollowTriangle`) trỏ từ Subclass lên Superclass. Hỗ trợ gộp nhánh (shared target arrowhead) khi nhiều lớp kế thừa cùng một lớp cha.
   - **Realization / Implementation (Thực thi giao diện)**: Đường nét đứt có đầu tam giác rỗng lớn (`hollowTriangle`) trỏ từ Implementing Class lên Interface.
   - **Dependency / Usage (Phụ thuộc)**: Đường nét đứt có mũi tên nhọn hở (`openArrow`), hỗ trợ stereotype `«use»`, `«create»`, `«call»`, `«instantiate»`.
   - **Association Class**: Đường nét đứt nối giữa một hình hộp Class với đường nối Association của 2 class khác.

---

### 2.2. Phân Tích Thực Tế & Root Causes Lỗi Class Diagram Hiện Tại (Đối Chiếu Draw.io, Lucidchart, StarUML)

1. **Lỗi 1: Đường Kẻ Giả Tạo (Phantom Divider) Và Khoảng Trống Khổng Lồ Dưới Đáy Ngăn Operations**
   - **Hiện tượng**: Khi kéo dãn chiều cao hộp Class (ví dụ từ chiều cao ban đầu 126px lên 220px), xuất hiện một đường kẻ ngang thứ 3 cắt ngang qua giữa hộp Class ngay dưới phương thức cuối cùng, chia hộp ra làm 4 ngăn và để lại một khoảng trống trắng trơn chiếm hơn nửa hộp bên dưới.
   - **Root Cause**: Trong hàm `classifierLayout` (`src/engine/shapes/classifier.ts`):
     ```ts
     for (const compartment of model.compartments) {
       ...
       dividers.push(y);
     }
     ```
     Sau mỗi compartment, `dividers.push(y)` được gọi. Với Class 2 ngăn nội dung (Attributes và Operations), nó đã push `y` sau Attributes VÀ `y` sau Operations. Trong `CanvasEngine.ts`, vòng lặp vẽ đường kẻ qua mọi `y < shape.h - 0.25`. Vì `shape.h` lớn hơn chiều cao nội dung, đường kẻ sau Operations bị vẽ ra, tạo thành một ngăn thứ 4 giả tạo không theo bất kỳ chuẩn nào!
   - **Giải pháp theo StarUML / Draw.io / Lucidchart**:
     - Với $K$ compartments, **chỉ có $K$ dividers** (Divider 0 ở `headerHeight`, và Divider $i$ ở giữa compartment $i-1$ và compartment $i$).
     - **Tuyệt đối KHÔNG có divider sau compartment cuối cùng**. Compartment cuối cùng (Operations) luôn kéo dài tự nhiên tới đường viền đáy của hình hộp (`shape.h`).

2. **Lỗi 2: Co Giãn Kích Thước (Proportional Scaling & Row Spacing)**
   - **Hiện tượng**: Khi resize to hộp Class, text bên trong vẫn giữ nguyên kích thước nhỏ, dồn cục ở góc trên cùng.
   - **Root Cause**: `fontScale` dựa trên `embeddedTextScale` hoặc `sqrt((w / defaultW) * (h / defaultH))` cần được áp dụng đồng bộ cho `titleFontSize`, `bodyFontSize`, `headerHeight`, và `rowHeight`. Khoảng cách giữa các dòng và font chữ phải tự động tỷ lệ thuận với kích thước hộp, đảm bảo khi hộp to thì chữ và khoảng cách nở to tương xứng.

3. **Lỗi 3: Không Có In-Place Canvas Editing Cho Attributes & Operations (Bắt Buộc Nhập Qua Side Panel)**
   - **Hiện tượng**: Double click vào Class hiện chỉ mở một textarea ở góc trên sửa Tên Class (`shape.text`), hoặc mở thanh công cụ bên phải (`shape-properties-panel`). Không thể click vào dòng thuộc tính hay dòng phương thức để sửa ngay trên canvas.
   - **Giải pháp theo Draw.io / Lucidchart / StarUML**:
     - **In-Place Canvas Editing**:
       - Double-click vào Header -> Sửa Tên Class tại chỗ.
       - Double-click vào dòng Thuộc tính -> Sửa cú pháp dòng thuộc tính đó ngay trên Canvas.
       - Double-click vào dòng Phương thức -> Sửa cú pháp phương thức đó ngay trên Canvas.
     - **Enter-to-Add**:
       - Khi đang sửa một dòng member và nhấn <kbd>Enter</kbd>: Lưu dòng đó (parse visibility `+`, `-`, `#`, `~`, name, type, default, modifiers) và TỰ ĐỘNG tạo dòng mới ở bên dưới, đưa con trỏ vào dòng mới để người dùng tiếp tục nhập không ngừng nghỉ!
       - Nhấn <kbd>Escape</kbd>: Hoàn tất chỉnh sửa.
       - Xóa trắng một dòng và nhấn <kbd>Enter</kbd>: Xóa member đó.
     - **Double-click KHÔNG BAO GIỜ mở panel bên phải**: Canvas phải tương tác tự nhiên, mượt mà và trực tiếp 100%.

### 2.3. Bảng Đối Chiếu Hiện Trạng vs. Mục Tiêu Chuẩn Hóa

| Phần tử Class Diagram | Hiện trạng trong Codebase | Chuẩn OMG UML 2.5 / Mục tiêu chuẩn hóa | Mức độ cần sửa |
| :--- | :--- | :--- | :--- |
| **Class Shape (`uml.class`)** | Bảng 3 ngăn cơ bản. Đã có parse `visibility`, `name`, `type`. Thiếu underline static, thiếu italic abstract, thiếu derived `/`. | Chuẩn hóa font chữ, gạch chân static members, in nghiêng abstract methods, hỗ trợ modifier `{readOnly}`, `{id}`. | **Cao** |
| **Abstract Class (`uml.abstract-class`)** | Chỉ gán stereotype text thô `«abstract»`. Tên class chưa tự động in nghiêng theo chuẩn. | Tên in nghiêng (*Italic*) + stereotype `«abstract»`. Các method abstract tự động in nghiêng. | **Cao** |
| **Interface (`uml.interface`)** | Bảng 2 ngăn. Thiếu tuỳ chọn chuyển đổi giữa 2D table và lollipop notation. | Chuẩn hóa header `«interface»`. Hỗ trợ kết nối realization với target interface. | **Trung bình** |
| **Enumeration (`uml.enumeration`)** | Có ngăn literals nhưng hiển thị còn cứng nhắc. | Chuẩn hóa danh sách literals, hỗ trợ thêm/xóa/sửa inline nhanh chóng. | **Trung bình** |
| **Object (`uml.object`)** | Đã có `underlineName: true` cơ bản. | Chuẩn hóa format `<u>name : Classifier</u>` và ngăn slot values `attr = val`. | **Trung bình** |
| **Template / Generics** | Chưa hỗ trợ hộp tham số mẫu (Template Box). | Thêm cờ tham số mẫu: hộp nét đứt góc trên bên phải (vd: `<T>`). | **Mở rộng** |
| **Double-Click In-Place Editing** | Double click vào Class hiện bị phụ thuộc vào panel bên phải hoặc editor text thô. | **In-place trực tiếp trên Canvas**: Double click vào tên để sửa tên; double click vào ngăn thuộc tính để sửa từng dòng hoặc thêm mới bằng phím <kbd>Enter</kbd>; tự động nhận diện ký tự đầu `+`, `-`, `#`, `~` để đổi visibility. | **Rất Cao (Cốt lõi)** |
| **Dynamic Scaling & Typography** | Co giãn hộp kích thước lớn làm lệch tỉ lệ dòng kẻ ngăn và khoảng cách item. | Co giãn chữ và độ cao từng compartment theo tỷ lệ hình học đồng nhất, tự động tính toán min-height. | **Cao** |
| **Connector Labels & Multiplicities** | Nhãn connector đã được fix nền transparent và offset chống đè ở bước trước. Cần rà soát multiplicity placement ở 2 đầu line. | Đảm bảo role name và multiplicity hiển thị ở vị trí `source` và `target` cách đầu mũi tên đúng 12px, không đè lên hình thoi hay tam giác. | **Đã cải thiện, cần hoàn thiện** |

---


## 3. Kiến Trúc Dữ Liệu & Thiết Kế Kỹ Thuật

### 3.1. Dữ Liệu Ngữ Nghĩa Mở Rộng (`classData.ts`)
Tạo tệp `src/engine/shapes/classData.ts` để chuẩn hóa toàn bộ cấu trúc:
```typescript
export interface UMLClassMemberModifier {
  isStatic?: boolean;      // Underlined
  isAbstract?: boolean;    // Italic
  isDerived?: boolean;     // Prefixed with '/'
  isReadOnly?: boolean;    // {readOnly}
  isId?: boolean;          // {id}
  query?: boolean;         // {query}
}

export interface UMLClassAttributeItem {
  id: string;
  visibility: UMLVisibility; // 'public' | 'private' | 'protected' | 'package'
  name: string;
  type?: string;
  multiplicity?: string;     // '[0..1]', '[*]', etc.
  defaultValue?: string;
  modifiers?: UMLClassMemberModifier;
}

export interface UMLClassOperationParam {
  name: string;
  type?: string;
  direction?: 'in' | 'out' | 'inout';
  defaultValue?: string;
}

export interface UMLClassOperationItem {
  id: string;
  visibility: UMLVisibility;
  name: string;
  parameters: UMLClassOperationParam[];
  returnType?: string;
  modifiers?: UMLClassMemberModifier;
}

export interface UMLClassClassifierData {
  version: 2;
  kind: 'class' | 'abstract-class' | 'interface' | 'enumeration' | 'object';
  stereotype?: string;
  templateParameters?: string[]; // e.g. ['T', 'K, V']
  isStatic?: boolean;
  isAbstract?: boolean;
  attributes: UMLClassAttributeItem[];
  operations: UMLClassOperationItem[];
  literals?: string[];           // For enumeration
  slots?: { name: string; value: string }[]; // For object
}
```

### 3.2. Rendering Vector Chuẩn Hóa Trên Canvas (`CanvasEngine.ts`)
1. **Name Compartment**:
   - Nếu có `stereotype`: vẽ `«stereotype»` với font size 11px, font-weight 500, màu muted.
   - Tên Class: font size 14px * scale, font-weight 700. Nếu là `abstract-class` hoặc có cờ `isAbstract`: vẽ với `italic bold`.
   - Nếu có `templateParameters`: vẽ hộp chữ nhật nét đứt bo góc ở góc trên bên phải (dashed rectangle) chứa text `<T>`.
   - Đường kẻ chia ngăn 1: nét liền 1px mượt mà nối từ mép trái sang mép phải.
2. **Attributes Compartment**:
   - Căn lề trái có padding 8px.
   - Ký tự visibility `+`, `-`, `#`, `~` được định dạng màu sắc tinh tế hoặc glyph rõ ràng.
   - Tên thuộc tính: nếu `isStatic === true`, Canvas vẽ đường gạch chân ngay dưới chân text.
   - Thuộc tính derived: hiển thị `/name : Type`.
   - Modifiers hiển thị cuối dòng dạng `{readOnly}`, font size 10px.
3. **Operations Compartment**:
   - Tương tự attributes: method static được gạch chân; method abstract được in nghiêng; parameters được định dạng rõ ràng `(arg: Type)`.
4. **Co Giãn Theo Kích Thước (Proportional Scaling)**:
   - Áp dụng `fontScale` tương tự Use Case diagram để khi kéo to hộp Class thì toàn bộ text và khoảng cách dòng co giãn tỷ lệ, không bị chữ nhỏ lọt thỏm trong hộp to.

### 3.3. Trải Nghiệm Tương Tác: In-Place Inline Canvas Editing (Draw.io / Lucidchart Paradigm)
- Khi double-click vào Class:
  - Xác định người dùng double-click vào ngăn nào (Name, Attributes, hay Operations).
  - Mở trực tiếp khung soạn thảo text đè lên đúng vị trí dòng được click trên Canvas:
    - Nếu click vào dòng thuộc tính: cho phép sửa cú pháp nhanh (vd gõ `+ id: Long` -> tự parse thành `visibility: 'public'`, `name: 'id'`, `type: 'Long'`).
    - Nhấn <kbd>Enter</kbd>: lưu dòng hiện tại và tự động tạo thêm dòng mới bên dưới để nhập liên tục.
    - Nhấn <kbd>Esc</kbd> hoặc click ra ngoài: hoàn tất chỉnh sửa.
  - Loại bỏ hoàn toàn sự phụ thuộc vào panel thuộc tính bên phải khi nhập text cơ bản.

---

## 4. Lộ Trình Triển Khai Chi Tiết (5 Bước Khắc Phục Triệt Để)

### Bước 1: Rà Soát Toàn Diện Hiện Trạng & Cập Nhật Plan (HOÀN TẤT)
- Phân tích nguyên nhân gốc rễ đường kẻ divider giả tạo (phantom divider) dưới đáy ngăn Operations.
- Phân tích cơ chế co giãn tỷ lệ `fontScale` khi resize.
- Thiết kế hệ thống In-Place Canvas Editing bám sát Draw.io / Lucidchart / StarUML.

### Bước 2: Tối Ưu Hóa Thuật Toán Geometry & Dividers (`classifier.ts` & `CanvasEngine.ts`)
- Sửa thuật toán `classifierLayout`: với $K$ compartments, chỉ sinh $K$ đường kẻ (Header và giữa các ngăn lân cận), TUYỆT ĐỐI không sinh đường kẻ sau ngăn cuối cùng.
- Khi box được kéo dài hơn chiều cao tối thiểu, ngăn cuối cùng (Operations) tự nhiên kéo dài xuống tận mép đáy của shape, loại bỏ 100% khoảng trống thừa và đường kẻ giả tạo.
- Bổ sung `compartmentBounds` và thuật toán `hitTestClassifier` trả về chính xác vị trí Header, từng dòng thuộc tính, từng dòng phương thức.

### Bước 3: Triển Khai In-Place Inline Editing Chuẩn Draw.io / Lucidchart / StarUML (`App.tsx`)
- Tích hợp `hitTestClassifier` vào `eng.onEditText`:
  - Double click vào Tên Class -> mở editor tại Tên Class.
  - Double click vào dòng Thuộc tính -> mở editor tại đúng dòng đó với nội dung thuộc tính.
  - Double click vào dòng Phương thức -> mở editor tại đúng dòng đó với nội dung phương thức.
  - Double click vào vùng trống của ngăn -> thêm dòng mới và mở editor ngay tại đó.
- Phím <kbd>Enter</kbd> (Enter-to-Add):
  - Tự động parse cú pháp UML (`+`, `-`, `#`, `~`, name, type, default, static/abstract).
  - Cập nhật dòng hiện tại và TỰ ĐỘNG tạo dòng mới ở bên dưới, chuyển focus sang dòng mới để người dùng gõ liên tục không dừng lại.
- Phím <kbd>Escape</kbd> hoặc click ngoài: Lưu hoàn tất và đóng editor.
- Ngăn chặn hoàn toàn việc bật panel thuộc tính bên phải khi double-click.

### Bước 4: Kiểm Thử Độc Lập Bằng Unit Tests (`class.test.mjs`)
- Kiểm tra số lượng divider lines cho 3 ngăn (chính xác 2 divider lines, 0 phantom dividers).
- Kiểm tra `hitTestClassifier` cho Header, Attribute lines, và Operation lines.
- Kiểm tra tính năng parse cú pháp và Enter-to-Add.
- Chạy `npm run test:class` đạt 100% PASS.

### Bước 5: Kiểm Thử Trình Duyệt Bằng Browser Subagent & Quay Video
- Thử nghiệm trên `http://localhost:5175/`:
  - Resize Class 2x -> không có đường kẻ thừa ở đáy, chữ và dòng tỷ lệ hài hòa.
  - Double-click sửa tên Class, sửa thuộc tính, gõ Enter thêm liên tiếp các thuộc tính mới.
  - Ghi video WebP minh chứng toàn bộ quy trình mượt mà.

