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
7. **Weekly planning with day-wise schedules**
8. **Flexible per-date technician availability**

## What's Been Implemented

### Phase 1 - Core Application (Completed)
- [x] Dashboard with stats overview and interactive map
- [x] Technicians page with table, skill badges, availability toggles
- [x] Jobs page with tabs (All, Pending, Assigned, Unassigned)
- [x] Routes page for viewing optimized routes
- [x] Settings page with API key configuration
- [x] City/Region selector (6 cities: Chicago, London, Tokyo, Sydney, Mumbai, Berlin)
- [x] Demo data generation endpoints
- [x] Nextbillion Route Optimization API integration
- [x] Re-optimization endpoint
- [x] Interactive map with route checkboxes, job markers, popups
- [x] Download input/response JSON for optimization runs

### Phase 2 - Weekly Planning (Completed Feb 20, 2026)
- [x] Weekly calendar strip showing all 7 days
- [x] Day-wise job count display
- [x] Day-wise technician availability count
- [x] Tabbed interface (Jobs / Technicians tabs)
- [x] Flexible per-date technician availability
- [x] Different shift types (Early/Day/Late/Standard Shift)
- [x] Toggle technician availability per date
- [x] Weekend detection (fewer technicians available)
- [x] Date-specific route optimization
- [x] Generate Weekly Data button

## Tech Stack
- Frontend: React, Tailwind CSS, Shadcn UI, Sonner (toasts)
- Backend: FastAPI, Motor (MongoDB async driver), httpx
- Database: MongoDB
- Map SDK: @nbai/nbmap-gl (Nextbillion)

## Database Schema

### technicians
```json
{
  "id": "tech_chicago_1",
  "name": "Rajesh Mehta",
  "skill": "Plumbing",
  "skill_id": 1,
  "phone": "+1-555-xxx-xxxx",
  "email": "rajesh.mehta@fieldservice.demo",
  "available": true,
  "avatar_url": "https://...",
  "created_at": "2026-02-20T..."
}
```

### technician_availability (NEW)
```json
{
  "id": "avail_chicago_tech_chicago_1_2026-02-20",
  "technician_id": "tech_chicago_1",
  "technician_name": "Rajesh Mehta",
  "date": "2026-02-20",
  "day_name": "Friday",
  "is_available": true,
  "shift_start": 1740034800,
  "shift_end": 1740063600,
  "shift_name": "Early Shift",
  "notes": "Early Shift (07:00 - 15:00)",
  "created_at": "2026-02-20T..."
}
```

### jobs
```json
{
  "id": "job_chicago_2026-02-20_1",
  "customer_name": "John Smith",
  "address": "1234 Main St",
  "latitude": 41.85,
  "longitude": -87.95,
  "service_type": "Plumbing",
  "service_duration": 3600,
  "skill_required": 1,
  "time_window_start": 1740034800,
  "time_window_end": 1740038400,
  "priority": 0,
  "notes": "Plumbing service request",
  "status": "pending",
  "scheduled_date": "2026-02-20",
  "assigned_technician_id": null,
  "created_at": "2026-02-20T..."
}
```

## Key API Endpoints

### Technician Availability
- `GET /api/technicians/weekly-availability?city=chicago` - Get all week's availability
- `GET /api/technicians/availability/by-date/{date}?city=chicago` - Get specific date
- `PUT /api/technicians/availability/{id}?is_available=true` - Toggle availability

### Weekly Planning
- `POST /api/jobs/generate-weekly?city=chicago&jobs_per_day=8` - Generate week's data
- `GET /api/jobs/weekly-summary?city=chicago` - Get week overview with tech counts

### Optimization
- `POST /api/optimize?city=chicago&date=2026-02-20` - Optimize for specific date

## P1 Features (Remaining)
- [ ] Route editing UI (drag-and-drop jobs)
- [ ] Real-time tracking indicators
- [ ] Historical optimization runs view
- [ ] Export routes to PDF/CSV

## P2 Features (Future)
- [ ] Mobile-responsive design
- [ ] Push notifications
- [ ] Integration with Google Calendar
- [ ] Customer notification system
- [ ] Recurring jobs scheduling
- [ ] Analytics and reporting dashboard

## Next Tasks
1. Implement route editing UI for admins
2. Add re-optimization flow for new jobs
3. Consider refactoring server.py (now ~1100 lines)
