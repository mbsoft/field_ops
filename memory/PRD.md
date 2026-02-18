# FieldOps Route Optimizer - PRD

## Original Problem Statement
Build an end-to-end field service application that optimizes daily operations using Nextbillion's route optimization API. Demo app with auto-generated data for major global cities.

## User Personas
- **Field Service Manager**: Needs to optimize technician routes daily to reduce travel time and costs
- **Dispatcher**: Needs to re-optimize routes when new customer requests come in
- **Admin**: Needs to edit routes and manage technician availability

## Core Requirements (Static)
1. Daily route optimization using Nextbillion API
2. Re-optimization capability for new job requests
3. Admin route editing
4. Dashboard with map + table views
5. Demo data generation for global cities
6. Mixed technician types with different skills

## What's Been Implemented (Jan 18, 2026)
- [x] Dashboard with stats overview, map placeholder, quick stats
- [x] Technicians page with table, skill badges, availability toggles
- [x] Jobs page with tabs (All, Pending, Assigned, Unassigned)
- [x] Routes page for viewing optimized routes
- [x] Settings page with API key configuration
- [x] City/Region selector (6 cities: Chicago, London, Tokyo, Sydney, Mumbai, Berlin)
- [x] Demo data generation endpoints
- [x] Nextbillion Route Optimization API integration
- [x] Re-optimization endpoint
- [x] CRUD operations for all entities

## Tech Stack
- Frontend: React, Tailwind CSS, Shadcn UI, Sonner (toasts)
- Backend: FastAPI, Motor (MongoDB async driver), httpx
- Database: MongoDB
- Map SDK: @nbai/nbmap-gl (Nextbillion)

## P0 Features (Complete)
- Dashboard with statistics
- Technician management
- Job management
- Route optimization trigger
- Settings for API key

## P1 Features (Remaining)
- Real-time tracking indicators
- Route editing UI
- Historical optimization runs view
- Export routes to PDF/CSV

## P2 Features (Future)
- Mobile-responsive design
- Push notifications
- Integration with Google Calendar
- Customer notification system

## Next Tasks
1. User to configure Nextbillion API key
2. Test full optimization flow
3. Add route editing UI
4. Implement real-time tracking simulation
