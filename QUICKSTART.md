# Whiskey Riders Portal - Quick Start Guide

## 🚀 Getting Started

### 1. Installation & Setup

```bash
npm install
npm run dev
```

Visit `http://localhost:3000`

### 2. Environment Variables
Already configured in `.env.local` with Supabase credentials.

To auto-apply safe SQL migrations on `npm run dev` / `npm run build`, also set:

```bash
SUPABASE_ACCESS_TOKEN=your_supabase_personal_access_token
```

Only migration files that include `-- @auto-migrate` are applied automatically.

### 3. Build for Production
```bash
npm run build
npm start
```

---

## 📚 NEW! Backend & CMS Documentation

### Start Here ⭐
1. **BUILD_SUMMARY.md** - Overview of everything built (5 min read)
2. **API_REFERENCE.md** - How to use each API endpoint (10 min read)
3. **CMS_FEATURE_ROADMAP.md** - What to build next (prioritized list)
4. **BACKEND_BUILD_GUIDE.md** - Deep technical reference

### For Developers
- **14 Production-Ready API Endpoints** - Full CRUD for trips, payments, awards, members, documents, updates
- **CMS Components** - DataTable and FormComponent for building admin pages
- **Admin Dashboard** - Statistics overview and quick actions
- **Comprehensive Documentation** - API reference, examples, best practices

---

## 🌐 Website Structure

### Public Pages
- `/` - Landing page with hero and CTA

### Authentication
- `/login` - Sign in with email and password

### Member Portal (requires login)
- `/dashboard` - Overview with stats and upcoming trips
- `/trips` - Browse all trips
- `/trips/[slug]` - Trip details with tabs
- `/profile` - Your profile
- `/profile/[id]` - Other member's profile
- `/gallery` - Photo galleries by trip

### Admin Portal (admin role required)
- `/admin` - Admin dashboard
- `/admin/trips` - Manage trips (CRUD)
- `/admin/members` - Manage users and roles
- `/admin/payments` - Import payment data from Excel

---

## 🔧 Backend API Quick Reference

### Available Endpoints (14 total)
```
Trips:     ✅ List, Create, Get, Update, Delete
Members:   ✅ List, Get, Update  
Payments:  ✅ List, Create (Update/Delete coming)
Awards:    ✅ List, Create (Update/Delete coming)
Votes:     ✅ Results, Cast
Documents: ✅ List, Upload (Delete coming)
Updates:   ✅ List, Create (Edit/Delete coming)
```

### Test an API
```bash
# Get all trips
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/trips

# Create a trip (admin only)
curl -X POST -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Iceland","destination":"Reykjavik","country":"Iceland","start_date":"2027-08-01","end_date":"2027-08-10"}' \
  http://localhost:3000/api/trips
```

See `API_REFERENCE.md` for complete endpoint documentation with examples.

---

## 🎯 Building New Features

### Quick Pattern: API Endpoint
```typescript
// 1. Create file: src/app/api/new-route/route.ts
import { verifyRole, successResponse, errorResponse, ApiErrors } from '@/lib/api/helpers';

export async function GET(request: NextRequest) {
  const { authenticated } = await verifyRole(request, ['admin']);
  if (!authenticated) return errorResponse(ApiErrors.UNAUTHORIZED);
  
  // Your logic here
  const data = await fetchData();
  return successResponse(data);
}
```

### Quick Pattern: CMS Page
```typescript
// 2. Create file: src/app/(admin)/admin/my-page.tsx
'use client';
import { DataTable } from '@/components/admin/DataTable';

export default function MyPage() {
  const [items, setItems] = useState([]);
  
  useEffect(() => {
    fetch('/api/my-endpoint').then(r => r.json()).then(d => setItems(d.data.items));
  }, []);

  return <DataTable columns={[{key:'name',label:'Name'}]} data={items} rowKey="id" />;
}
```

---

## 📖 Key Files Reference

| File | Purpose |
|------|---------|
| `BUILD_SUMMARY.md` | Overview of what's been built |
| `API_REFERENCE.md` | Complete API documentation |
| `CMS_FEATURE_ROADMAP.md` | Next features to build (prioritized) |
| `BACKEND_BUILD_GUIDE.md` | Technical deep dive |
| `src/lib/api/helpers.ts` | 25+ utility functions for APIs |
| `src/lib/types/database.ts` | TypeScript types for database |
| `src/components/admin/DataTable.tsx` | Reusable table component |
| `src/components/admin/FormComponent.tsx` | Reusable form builder |

---

## 🚦 Next Steps

### This Hour
- [ ] Read `BUILD_SUMMARY.md`
- [ ] Read `API_REFERENCE.md` 
- [ ] Test one API endpoint with curl

### Today
- [ ] Pick a feature from `CMS_FEATURE_ROADMAP.md`
- [ ] Build the CMS page using DataTable/FormComponent
- [ ] Connect it to the API

### This Week
- [ ] Complete one full feature
- [ ] Build admin forms for core resources
- [ ] Connect dashboard to real data

---

## 🆘 Common Questions

**Q: How do I call an API?**
A: See curl examples in `API_REFERENCE.md` or use browser fetch()

**Q: How do I build a CMS page?**
A: Use DataTable for lists or FormComponent for forms

**Q: How do I add a new endpoint?**
A: Copy pattern from existing endpoint in `/src/app/api/`

**Q: How do I check permissions?**
A: Use `verifyRole()` helper - see examples in BACKEND_BUILD_GUIDE.md

**Q: Where are TypeScript types?**
A: `src/lib/types/database.ts`

**Q: How do I log actions?**
A: Use `logActivity()` helper

---

## 📚 Learn More

- **Backend Architecture**: `BACKEND_BUILD_GUIDE.md`
- **API Usage Examples**: `API_REFERENCE.md`
- **Feature Planning**: `CMS_FEATURE_ROADMAP.md`
- **Code Examples**: Look at existing files in `/src/app/api/`

---

**Last Updated:** March 31, 2027
**Status:** Backend Phase 1 & 2 Complete ✅ - Ready for Phase 3 Feature Build

## Key Features

### Authentication
- **Password**: Traditional email/password sign in
- **Role-Based Access**: super_admin, admin, trip_admin, member

### Dashboard
- Trip statistics
- Upcoming trip preview
- Completed trips list
- Member activity

### Trip Management
- View detailed trip information
- Timeline of key dates
- News updates feed
- Member roster
- Documents, payments, and voting (expandable)

### Admin Features
- Create and edit trips
- Assign members and roles
- Import payment data from Excel files
- View statistics and metrics

## Database Schema

The app connects to Supabase PostgreSQL with these main tables:
- `profiles` - User accounts
- `trips` - Motorcycle adventures
- `trip_members` - Trip memberships
- `trip_updates` - News and updates
- `trip_key_dates` - Important dates
- `trip_documents` - Travel docs
- `payments` - Payment tracking
- `photos` - Gallery photos
- `awards` - Trip awards
- `badges` - Achievements

All tables are fully typed in TypeScript.

## UI Components

### Core Components
- **Button** - Multiple variants (primary, secondary, outline, ghost, danger)
- **Card** - Container with header, content, footer
- **Badge** - Status indicators
- **Input/TextArea/Select** - Form inputs
- **Avatar** - User profile pictures
- **Spinner** - Loading indicator
- **Modal** - Dialog boxes

### Layout Components
- **TopBar** - Header with navigation
- **Sidebar** - Portal navigation menu
- **AdminSidebar** - Admin menu
- **Footer** - Footer with links

## Color System

```
Brand Black:      #0D0D0D  (backgrounds)
Dark Grey:        #1A1A1A  (surfaces)
Brown (Primary):  #B5621E  (accents, buttons)
Tan (Secondary):  #C9B98A  (highlights)
Cream (Text):     #F5F0E8  (text, light)
```

## Development Tips

### Adding a New Page
1. Create a new folder in `src/app/` or `src/app/(portal)/` or `src/app/(admin)/`
2. Add `page.tsx` file
3. Export a default component
4. Use the layout's context (auth, navigation)

### Adding a Component
1. Create in `src/components/`
2. Use existing UI components from `src/components/ui/`
3. Import and use in pages

### Connecting to Supabase
```typescript
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();
const { data, error } = await supabase
  .from('table_name')
  .select('*');
```

### Using Database Types
```typescript
import type { Trip, Profile } from '@/lib/types/database';

const trip: Trip = { /* ... */ };
```

## File Organization

```
src/
├── app/                           # Next.js App Router
│   ├── page.tsx                  # Landing page
│   ├── layout.tsx                # Root layout
│   ├── globals.css               # Global styles
│   ├── (auth)/                   # Auth pages
│   ├── (portal)/                 # Member portal
│   └── (admin)/                  # Admin portal
├── components/
│   ├── ui/                       # Reusable UI components
│   ├── layout/                   # Layout components
│   └── auth/                     # Auth components
├── lib/
│   ├── supabase/                 # Supabase clients
│   ├── types/                    # TypeScript types
│   └── utils.ts                  # Helper functions
└── middleware.ts                 # Route protection

```

## Deployment

### Vercel (Recommended)
```bash
# Push to Git
git push

# Vercel automatically deploys from main branch
```

### Docker
```bash
npm run build
npm start
```

## Troubleshooting

### Auth Not Working
- Check `.env.local` has correct Supabase credentials
- Ensure user is created in Supabase Auth
- Check user profile exists in `profiles` table

### Database Errors
- Verify Supabase project is active
- Check user has correct permissions
- Ensure tables exist and are accessible

### Build Errors
- Run `npm install` to ensure dependencies
- Check TypeScript errors: `npm run build`
- Clear `.next` folder and rebuild

## Support

For issues with Supabase: https://supabase.com/docs
For Next.js help: https://nextjs.org/docs
For Tailwind CSS: https://tailwindcss.com/docs
