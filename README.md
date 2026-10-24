# Receipt Pocket v2

Live app: https://oakstick.github.io/receipt-pocket/

Install with Safari > Share > Add to Home Screen. Open the Home Screen app online once before using it offline. Your PC can stay off.

## Automatic receipt reading
Choose a photo or use the rear camera. Tesseract.js reads it on your device and suggests the place, total, currency, and receipt date. English and Danish models are included in the reader setup. All fields are editable. Review them before saving; blurry text, stylized store logos, multi-column layouts and unusual receipts may need correction. Numeric dates default to day/month/year; change this under Reading options for US-style receipts. Ambiguous currency symbols (such as kr or $ without an explicit code) require choosing the currency.

The first scan downloads free, pinned OCR engine and language files from jsDelivr and GitHub (roughly 10–15 MB). Photos are never sent to an OCR service. The app caches reader files for later offline scans where browser storage permits it. The message 'Receipt reader downloaded for offline use' is separate from 'Offline app files ready'. Clearing website data removes both history and cached reader files. Manual entry remains available if reading fails or you cancel it.

## Two file destinations
Save Receipt first commits the JPEG and details to IndexedDB. Then choose one of these buttons:

- Save to iPhone Files: Open Share sheet > Save to Files > On My iPhone > Receipts > Save. Create Receipts once in the Files app or folder picker. iCloud Drive is also available.
- Save to Google Drive: Open Share sheet > Drive (possibly under More) > select account/folder > Upload. Install and sign in to the Google Drive app first. If Drive is not offered, download the JPEG, then use + > Upload in Drive. Upload completion needs internet.

Apple controls the Share sheet. These buttons cannot preselect a destination, silently create a Files folder, or confirm that the external file was actually saved. Closing/cancelling the sheet keeps the local copy. No Google Cloud OAuth setup or paid service is required.

Currency appears in filenames, history, and CSV. Old receipts are retained and have blank currency. CSV contains metadata, not images. Keep separate JPEG copies as backups.

## Update and develop
The public GitHub repository is Oakstick/receipt-pocket. GitHub Pages publishes main at the repository root. The dist folder here contains those public files. After changing files, increment the app cache version in sw.js. Finish an in-progress receipt before reloading to update. Never uninstall or clear site data merely to update.

## Third-party software
Tesseract.js 6.0.1 and its bundled dependencies: see vendor/LICENSE-tesseract.txt and vendor/*.LICENSE.txt. Engine: tesseract.js-core 6.0.0 (Apache-2.0), served by jsDelivr. Language models: tesseract-ocr/tessdata_fast commit 87416418657359cb625c412a48b6e1d6d41c29bd (Apache-2.0), fetched from GitHub. OCR assets are downloaded only for receipt reading.

Browser checks do not replace real iPhone camera, native Share sheet, and Home Screen offline testing. Test a receipt in Airplane Mode after the reader download completes. Check both external destinations on your phone.

