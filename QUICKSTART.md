# Whiskey Riders Portal - Quick Start Guide

## Installation & Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Variables
The `.env.local` file is already configured with:
```
NEXT_PUBLIC_SUPABASE_URL=https://xhapsqyyjrdwczquanxd.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 3. Development Server
```bash
npm run dev
```
Visit `http://localhost:3000`

### 4. Build for Production
```bash
npm run build
npm start
```

## Website Structure

### Public Pages
- `/` - Landing page with hero and CTA

### Authentication
- `/login` - Sign in with magic link or password

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

## Key Features

### Authentication
- **Magic Link**: Email-based passwordless login
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
