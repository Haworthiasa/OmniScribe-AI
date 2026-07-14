# Kịch bản kiểm thử thủ công OmniScribe AI

Tài liệu này dùng để tự kiểm tra toàn bộ luồng từ chọn ảnh, OCR, kiểm bản Markdown đến lưu Obsidian. Mỗi kịch bản có thể được đánh dấu trực tiếp bằng ô `[ ]`.

## 1. Chuẩn bị

### Môi trường mặc định

1. Sao chép cấu hình mẫu nếu chưa có:

   ```powershell
   Copy-Item .env.example backend\.env
   ```

2. Trong `backend/.env`, dùng cấu hình an toàn:

   ```env
   DEMO_MODE=true
   DEMO_ALLOW_VAULT_WRITE=false
   ```

3. Chạy backend:

   ```powershell
   cd backend
   python -m uvicorn main:app --reload --port 8000
   ```

4. Trong cửa sổ PowerShell khác, chạy frontend:

   ```powershell
   cd frontend
   npm.cmd run dev
   ```

5. Mở `http://localhost:5173`.

### Dữ liệu kiểm thử

- `test-note.jpg`: ảnh hợp lệ có sẵn trong repo.
- Một ảnh PNG hợp lệ bất kỳ.
- Một file TXT hoặc PDF để kiểm tra định dạng không hỗ trợ.
- Một file lớn hơn 10 MB để kiểm tra giới hạn dung lượng.
- Tám bản sao ảnh hợp lệ để kiểm tra giới hạn và sắp xếp nhiều trang.

### Quy ước ghi kết quả

- **Đạt:** kết quả thực tế khớp toàn bộ kết quả mong đợi.
- **Không đạt:** ghi lại bước lỗi, nội dung thông báo và ảnh chụp màn hình nếu cần.
- Không dùng dữ liệu nhạy cảm hoặc vault Obsidian thật khi kiểm tra lỗi ghi file.

---

## 2. Khởi động và trạng thái hệ thống

### TC-01 — Mở ứng dụng ở demo mode

- [ ] Mở `/` khi cả backend và frontend đang chạy.

Kết quả mong đợi:

- Workstation ba cột xuất hiện.
- Header hiển thị `Chế độ demo`, pha `Chưa bắt đầu`, `0/0` trang và `0%`.
- Cột giữa mặc định là `OCR Markdown trực tiếp`.
- Có thông báo demo, không có thông số model, memory, accuracy hoặc người dùng giả.
- Không có lỗi đỏ trong giao diện.

### TC-02 — Backend offline

- [ ] Dừng backend nhưng giữ frontend đang chạy.
- [ ] Tải lại `/`.
- [ ] Chọn một ảnh hợp lệ.

Kết quả mong đợi:

- Header và cột nguồn hiển thị `Backend offline` bằng cả chữ và trạng thái màu.
- Nút bắt đầu số hóa bị vô hiệu hóa.
- Ảnh vẫn xuất hiện trong hàng đợi và có thể xóa hoặc sắp xếp.
- Sau khi chạy lại backend và tải lại trang, trạng thái offline biến mất.

### TC-03 — Trạng thái upload rỗng

- [ ] Mở `/` khi chưa chọn ảnh.

Kết quả mong đợi:

- Hàng đợi hiển thị trạng thái rỗng và hướng dẫn bước tiếp theo.
- Console, metadata và graph hiển thị trạng thái chờ trung thực.
- Các field metadata và nút lưu Obsidian bị vô hiệu hóa.
- Nút bắt đầu số hóa bị vô hiệu hóa.

---

## 3. Chọn và quản lý ảnh

### TC-04 — Chọn một ảnh JPG hợp lệ

- [ ] Chọn `test-note.jpg`.

Kết quả mong đợi:

- Hàng đợi có đúng một trang với folio `01`.
- Hiển thị thumbnail, tên file, dung lượng và trạng thái chờ.
- Header hiển thị `0/1` trang.
- Nút bắt đầu số hóa được bật khi backend online.

### TC-05 — Chọn đồng thời JPG và PNG

- [ ] Chọn một JPG và một PNG hợp lệ.

Kết quả mong đợi:

- Cả hai file được chấp nhận.
- Thứ tự hàng đợi khớp thứ tự chọn file.
- Header và nút bắt đầu hiển thị hai trang.

### TC-06 — Từ chối định dạng không hỗ trợ

- [ ] Chọn file TXT, PDF hoặc file khác không phải JPG/PNG.
- [ ] Thử đổi phần mở rộng của file TXT thành `.jpg` rồi upload.

Kết quả mong đợi:

- Frontend từ chối định dạng không hỗ trợ với thông báo nêu tên file.
- File giả JPG có thể qua bước kiểm tra phía trình duyệt nhưng backend phải từ chối vì magic bytes không hợp lệ.
- Không tạo job mới khi upload không hợp lệ.

### TC-07 — Từ chối ảnh lớn hơn 10 MB

- [ ] Chọn một file JPG hoặc PNG có dung lượng lớn hơn 10 MB.

Kết quả mong đợi:

- Hiển thị thông báo file vượt giới hạn 10 MB.
- File không được thêm vào hàng đợi.
- Các file hợp lệ đã chọn trước đó không bị mất.

### TC-08 — Giới hạn tối đa tám ảnh

- [ ] Chọn tám ảnh hợp lệ.
- [ ] Thử thêm ảnh thứ chín.

Kết quả mong đợi:

- Tám ảnh đầu xuất hiện với folio `01` đến `08`.
- Ảnh thứ chín bị từ chối với thông báo giới hạn tám ảnh.
- Hàng đợi vẫn giữ nguyên tám ảnh ban đầu.

### TC-09 — Sắp xếp bằng nút mũi tên

- [ ] Chọn ít nhất ba ảnh có tên khác nhau.
- [ ] Dùng nút lên và xuống để thay đổi thứ tự.

Kết quả mong đợi:

- Hàng đợi đổi thứ tự ngay lập tức.
- Folio được đánh lại theo vị trí mới.
- Nút lên của trang đầu và nút xuống của trang cuối bị vô hiệu hóa.
- Tên file đầy đủ vẫn có trong accessible name hoặc tooltip.

### TC-10 — Sắp xếp bằng kéo thả

- [ ] Kéo trang cuối lên vị trí đầu.

Kết quả mong đợi:

- Trang được thả đúng vị trí.
- Không tạo bản sao và không mất trang.
- Thứ tự này được dùng làm thứ tự tài liệu khi bắt đầu OCR.

### TC-11 — Xóa trang

- [ ] Chọn ít nhất ba ảnh.
- [ ] Xóa trang giữa.

Kết quả mong đợi:

- Chỉ trang được chọn bị xóa.
- Các trang còn lại được đánh lại folio liên tục.
- Số trang trong header và nhãn nút bắt đầu được cập nhật.

---

## 4. OCR và console trực tiếp

### TC-12 — Xử lý một trang trong demo mode

- [ ] Chọn một ảnh và bấm `Bắt đầu số hóa`.

Kết quả mong đợi:

- URL chuyển sang `/jobs/:jobId`.
- Cột nguồn trở thành thông tin job chỉ đọc; không có nút thêm trang vào job.
- Pipeline lần lượt chuyển qua nhận trang, GLM OCR, tổ chức nội dung và kiểm tra bản nháp.
- Console vẫn ở chế độ `Markdown`, không tự chuyển sang preview khi hoàn tất.
- Markdown có gutter số dòng cobalt.

### TC-13 — Xử lý nhiều trang

- [ ] Chọn từ hai đến tám ảnh rồi bắt đầu số hóa.

Kết quả mong đợi:

- Hàng đợi job hiển thị từng trạng thái: chờ, đang OCR, đã xong hoặc lỗi.
- Header hiển thị số trang đã xử lý, tổng trang và phần trăm thực.
- Mỗi trang có một section `PAGE xx` trong console.
- Nội dung cuối cùng giữ đúng thứ tự upload, không phụ thuộc thứ tự trang hoàn tất OCR.

### TC-14 — Placeholder trong lúc xử lý

Kịch bản này dễ quan sát hơn khi dùng API thật hoặc ảnh có thời gian OCR dài.

- [ ] Bắt đầu job nhiều trang.
- [ ] Quan sát console trước khi tất cả trang hoàn tất.

Kết quả mong đợi:

- Trang chưa bắt đầu có placeholder chờ.
- Trang đang OCR có placeholder xử lý.
- Khi `page.ocr_completed` đến, placeholder của đúng trang được thay bằng Markdown hoàn chỉnh.
- Không xuất hiện hiệu ứng giả lập gõ từng token.

### TC-15 — Chọn trang từ hàng đợi

- [ ] Trong chế độ Markdown, chọn trang thứ hai.
- [ ] Chuyển sang `Ảnh gốc`, sau đó chọn trang khác.

Kết quả mong đợi:

- Trong Markdown, console cuộn tới section tương ứng.
- Trong Ảnh gốc, ảnh và caption chuyển đúng sang trang vừa chọn.
- Hàng đợi thể hiện rõ trang đang chọn.

### TC-16 — Chuyển chế độ xem

- [ ] Lần lượt chọn `Markdown`, `Ảnh gốc`, `Xem trước` và `Chỉnh sửa`.

Kết quả mong đợi:

- Markdown hiển thị raw source có số dòng.
- Ảnh gốc giữ đúng tỷ lệ và không bị crop.
- Xem trước render heading, danh sách, bảng và công thức nếu có.
- Chỉnh sửa bị khóa trước `document.ready` và được bật sau khi tài liệu sẵn sàng.
- Nút đang chọn có trạng thái active rõ ràng.

### TC-17 — Lỗi OCR một phần (nâng cao)

Điều kiện: backend thật hoặc stub phải trả `page.ocr_failed` cho đúng một trang và thành công cho ít nhất một trang khác.

- [ ] Chạy job có một trang thành công và một trang thất bại.

Kết quả mong đợi:

- Job vẫn tiếp tục tới trạng thái sẵn sàng nếu còn ít nhất một trang thành công.
- Trang lỗi có trạng thái `Lỗi`, thông báo cụ thể và error block trong Markdown.
- Các trang thành công không bị mất.
- Metadata và export vẫn dùng được cho bản tài liệu một phần.

### TC-18 — Tất cả trang OCR thất bại (nâng cao)

Điều kiện: backend thật hoặc stub trả lỗi cho tất cả trang.

- [ ] Chạy job mà không trang nào OCR thành công.

Kết quả mong đợi:

- Job chuyển sang trạng thái cần kiểm tra/lỗi.
- Giao diện hiển thị nguyên nhân, không bật edit hoặc save.
- Pipeline thể hiện bị gián đoạn bằng chữ, không chỉ bằng màu.

---

## 5. Metadata và knowledge graph

### TC-19 — Metadata trước và sau khi ready

- [ ] Quan sát metadata ngay sau khi mở job.
- [ ] Chờ `document.ready`.

Kết quả mong đợi:

- Trước ready: field bị khóa và có trạng thái chờ.
- Sau ready: title, summary, document type, category, tags và topics có thể chỉnh sửa.
- Không xuất hiện field ngoài schema hiện tại.

### TC-20 — Chỉnh sửa metadata

- [ ] Sửa tiêu đề và tóm tắt.
- [ ] Nhập tags và topics cách nhau bằng dấu phẩy.

Kết quả mong đợi:

- Giá trị không bị mất khi chuyển qua lại giữa các chế độ xem.
- Graph cập nhật từ dữ liệu vừa sửa.
- Nút trung tâm là title; topics và tags là các node ngoài.
- Mỗi node ngoài chỉ nối trực tiếp với title.

### TC-21 — Graph loại trùng không phân biệt hoa thường

- [ ] Nhập topics: `Vật lý, vật LÝ, Năng lượng`.
- [ ] Nhập tags: `ôn tập, ÔN TẬP, Vật lý`.

Kết quả mong đợi:

- Graph chỉ có một node `Vật lý` và một node `ôn tập`.
- Tag trùng với topic không tạo thêm node thứ hai.
- Tải lại cùng dữ liệu cho ra cùng vị trí node.

### TC-22 — Graph rỗng

- [ ] Mở route upload hoặc quan sát graph trước khi metadata sẵn sàng.

Kết quả mong đợi:

- Graph không tạo node giả.
- Empty state giải thích graph sẽ dùng title, topics và tags.
- Screen reader có fallback dạng text/list khi graph có dữ liệu.

---

## 6. Chỉnh sửa và lưu Obsidian

### TC-23 — Chỉnh sửa Markdown

- [ ] Chờ tài liệu ready rồi mở `Chỉnh sửa`.
- [ ] Thêm một heading hoặc đoạn văn.
- [ ] Chuyển sang `Xem trước`.

Kết quả mong đợi:

- Textarea có ranh giới rõ ràng và dùng font mono.
- Nội dung mới xuất hiện trong preview.
- Quay lại chỉnh sửa vẫn giữ nội dung vừa nhập.

### TC-24 — Không cho lưu khi title rỗng

- [ ] Xóa toàn bộ title.

Kết quả mong đợi:

- Nút `Lưu vào Obsidian` bị vô hiệu hóa.
- Nhập lại title sẽ bật nút lưu.

### TC-25 — Export thành công trong demo mode

- [ ] Giữ `DEMO_MODE=true` và `DEMO_ALLOW_VAULT_WRITE=false`.
- [ ] Bấm `Lưu vào Obsidian`.

Kết quả mong đợi:

- Giao diện hiển thị `Đã lưu vào vault` cùng đường dẫn note thật.
- Output nằm trong `backend/demo-vault/`, không ghi vào vault thật.
- Note chứa Markdown đã chỉnh sửa và metadata cuối.
- Ảnh nguồn của mọi trang được lưu cùng output.
- Topic notes/link được tạo theo exporter hiện tại.

### TC-26 — Export thất bại (nâng cao)

Điều kiện: dùng một vault thử nghiệm không có quyền ghi hoặc mock endpoint export trả lỗi. Không dùng vault thật.

- [ ] Bấm lưu khi đích ghi không khả dụng.

Kết quả mong đợi:

- Hiển thị thông báo lỗi cụ thể và có thể đọc được.
- Markdown và metadata đang chỉnh sửa không bị mất.
- Job trở lại trạng thái ready để có thể thử lưu lại.
- Không hiển thị thành công giả hoặc đường dẫn note giả.

### TC-27 — Export lặp lại

- [ ] Sau khi export thành công, thử mở lại deep link và kiểm tra khu vực Obsidian.

Kết quả mong đợi:

- Trạng thái đã lưu và đường dẫn note được khôi phục từ snapshot.
- Không xuất hiện nút lưu trùng làm người dùng tưởng cần export lại.

---

## 7. Reload, deep link và mất kết nối

### TC-28 — Reload job đang xử lý

Kịch bản này dễ kiểm tra với API thật hoặc job nhiều trang.

- [ ] Tải lại `/jobs/:jobId` khi OCR đang chạy.

Kết quả mong đợi:

- Snapshot dựng lại đúng queue và Markdown đã hoàn tất.
- SSE tiếp tục từ event ID gần nhất, không nhân đôi nội dung trang.
- Progress không lùi về 0 nếu backend đã xử lý trang.

### TC-29 — Reload job ready hoặc exported

- [ ] Tải lại một job đã ready.
- [ ] Tải lại một job đã export.

Kết quả mong đợi:

- Markdown mặc định vẫn là raw mode.
- Metadata và graph được dựng lại đúng.
- Job exported khôi phục đúng đường dẫn note và trạng thái đã lưu.

### TC-30 — Deep link không tồn tại

- [ ] Mở `/jobs/id-khong-ton-tai`.

Kết quả mong đợi:

- Hiển thị màn hình không thể mở tài liệu.
- Có thông báo dễ hiểu và nút quay về upload.
- Không để màn hình loading vô hạn.

### TC-31 — SSE mất kết nối tạm thời (nâng cao)

- [ ] Trong khi job đang chạy, tạm ngắt mạng hoặc dừng backend.
- [ ] Khôi phục kết nối.

Kết quả mong đợi:

- Giao diện thông báo đang đồng bộ lại.
- Khi backend trở lại, snapshot và SSE khôi phục trạng thái hiện tại.
- Không mất Markdown đã nhận và không nhân đôi section.

---

## 8. Responsive và accessibility

Không cần công cụ tự động; thay đổi kích thước cửa sổ trình duyệt bằng tay.

### TC-32 — Desktop từ 1200px

- [ ] Kiểm tra ở cửa sổ rộng từ 1200px trở lên.

Kết quả mong đợi:

- Hiển thị đủ ba cột theo tỷ lệ gần 24/47/29.
- Console là vùng lớn nhất.
- Header không hiển thị dữ liệu giả.
- Không có thanh cuộn ngang toàn trang.

### TC-33 — Tablet từ 800px đến 1199px

- [ ] Thu cửa sổ vào khoảng 1024px.
- [ ] Bấm nút `Metadata`.
- [ ] Đóng drawer bằng nút đóng và scrim.

Kết quả mong đợi:

- Cột trái rộng khoảng 240px, console chiếm phần còn lại.
- Inspector mở thành drawer, không đè mất khả năng đóng.
- Có thể mở và đóng drawer bằng bàn phím.
- Không có thanh cuộn ngang toàn trang.

### TC-34 — Mobile dưới 800px

- [ ] Thu cửa sổ xuống khoảng 390px.

Kết quả mong đợi:

- Thứ tự hiển thị: console, nguồn/queue, metadata/graph/save.
- Queue cuộn ngang bên trong chính nó.
- Trang không có thanh cuộn ngang toàn cục.
- Không có vùng cuộn dọc lồng nhau hoặc chiều cao viewport cố định.
- Controls vẫn đủ lớn để chạm.

### TC-35 — Điều hướng bằng bàn phím

- [ ] Không dùng chuột; dùng `Tab`, `Shift+Tab`, `Enter` và `Space`.
- [ ] Chọn ảnh, sắp xếp bằng nút, chuyển view, chọn page, sửa metadata và mở drawer.

Kết quả mong đợi:

- Mọi control có thể focus và kích hoạt.
- Focus ring amber rõ ràng, không bị cắt.
- Thứ tự focus hợp lý theo thứ tự đọc.
- Control disabled không nhận thao tác.

### TC-36 — Trạng thái không phụ thuộc màu

- [ ] Kiểm tra backend, page queue, pipeline, lỗi và export success.

Kết quả mong đợi:

- Mỗi trạng thái đều có chữ và/hoặc icon ngoài màu sắc.
- Không cần phân biệt đỏ, xanh hoặc amber mới hiểu được trạng thái.

### TC-37 — Reduced motion

- [ ] Bật `Reduce motion` trong hệ điều hành hoặc giả lập `prefers-reduced-motion: reduce` trong DevTools.
- [ ] Chạy một job OCR.

Kết quả mong đợi:

- Scan animation bị tắt.
- Drawer và progress gần như chuyển trạng thái tức thì.
- Trạng thái xử lý vẫn thể hiện bằng chữ, lamp và số progress.

### TC-38 — Nội dung dài

- [ ] Dùng filename dài, title dài, nhiều tags/topics và Markdown có bảng rộng.

Kết quả mong đợi:

- Filename truncate trong UI nhưng vẫn truy cập được tên đầy đủ.
- Text không đè lên controls.
- Bảng chỉ cuộn ngang trong vùng preview nếu cần.
- Toàn trang không phát sinh horizontal overflow.

---

## 9. Kiểm tra tự động bổ sung

Sau khi hoàn thành manual test, chạy:

```powershell
cd frontend
npm.cmd run design:lint
npm.cmd run test
npm.cmd run lint
npm.cmd run build

cd ..\backend
python -m unittest discover -s tests -v
```

Kết quả mong đợi:

- Design lint: `0 error`, `0 warning`.
- Frontend unit tests, lint và build thành công.
- Backend test suite thành công.
- Vite có thể hiển thị chunk-size warning hiện tại; warning này không làm build thất bại.

---

## 10. Mẫu báo cáo lỗi

```text
Test case:
Kết quả: Đạt / Không đạt
Môi trường: Demo / API thật
Trình duyệt và kích thước cửa sổ:
Dữ liệu đầu vào:
Bước xảy ra lỗi:
Kết quả thực tế:
Kết quả mong đợi:
Thông báo lỗi:
Ảnh chụp hoặc file liên quan:
```
