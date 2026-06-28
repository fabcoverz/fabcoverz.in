=======================================================
  FABCOVERZ — Premium Phone Case Ecommerce Store
  Version 2.0 — Enhanced & Fixed Edition
=======================================================

WHAT'S NEW IN THIS VERSION
---------------------------
✅ Admin panel URL routing fixed (/admin works on refresh)
✅ Footer now shows ONLY live collections dynamically
✅ All image inputs replaced with DIRECT FILE UPLOAD
   - Product images: Upload or use preset
   - Collection images: Upload or use preset key
   - Banner images: Drag & drop / click to upload
   - Logo image: Click to upload
✅ Admin "View Website" button added to sidebar
✅ Collections sync instantly across navbar, footer, pages
✅ Admin changes reflect immediately on website
✅ Build succeeds cleanly — no errors

=======================================================
  INSTALLATION
=======================================================

1. Extract the ZIP to a folder
2. Open terminal inside the folder
3. Run:

   npm install

=======================================================
  RUN LOCALLY
=======================================================

   npm run dev

Website:      http://localhost:3000/
Admin Panel:  http://localhost:3000/admin

(Refreshing /admin works correctly — no blank page!)

=======================================================
  ADMIN CREDENTIALS
=======================================================

URL:      http://localhost:3000/admin
Password: FABCOVERZ@100607

Secret access: Click the copyright text in the footer 5 times

=======================================================
  HOW TO USE ADMIN PANEL
=======================================================

IMAGE UPLOADS:
- Products → Add Product → Primary Image → click "upload" tab
- Collections → Add Collection → Collection Image → click "Upload Image"
- Settings → Banners → click the dashed upload area
- Settings → Branding → click "Upload logo image"

No image URLs required anywhere.

COLLECTION SYNC:
- Add/delete a collection in admin
- Footer, navbar, homepage update immediately
- No page refresh needed

=======================================================
  BUILD FOR PRODUCTION
=======================================================

   npm run build

Output: /dist folder — upload to any static host (Vercel, Netlify, cPanel)

For Apache hosting, the included /public/.htaccess handles SPA routing.
For Nginx, add:
   try_files $uri $uri/ /index.html;

=======================================================
  HOSTING ON NETLIFY / VERCEL (FREE)
=======================================================

Netlify:
1. npm run build
2. Drag /dist folder to netlify.com/drop
   OR connect GitHub repo

Vercel:
1. Push to GitHub
2. Import at vercel.com → Framework: Vite → Deploy

=======================================================
  TECH STACK
=======================================================

- React 19 + TypeScript
- Vite 6 (build tool)
- Tailwind CSS 4
- Lucide React (icons)
- localStorage (database — no backend needed)

=======================================================
  DATA STORAGE
=======================================================

All data is stored in the browser's localStorage.
No backend/database server required.
Data persists until browser storage is cleared.

To reset all data: Admin → Dashboard → "Rebuild catalog"

=======================================================
  SUPPORT
=======================================================

For customization help, check the source files:
- src/utils/dbSeeder.ts  — Default seed data
- src/utils/localStore.ts — Data access layer
- src/components/AdminPanel.tsx — Admin UI
- src/App.tsx — Main app routing

=======================================================
