from fastapi import FastAPI, APIRouter, HTTPException, Query
from fastapi.staticfiles import StaticFiles
from starlette.responses import FileResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone
import httpx
import random

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ==================== MODELS ====================

class TechnicianBase(BaseModel):
    name: str
    skill: str
    skill_id: int
    phone: Optional[str] = None
    email: Optional[str] = None
    available: bool = True
    avatar_url: Optional[str] = None

class Technician(TechnicianBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class JobBase(BaseModel):
    customer_name: str
    address: str
    latitude: float
    longitude: float
    service_type: str
    service_duration: int = 3600  # in seconds, default 1 hour
    skill_required: int
    time_window_start: Optional[int] = None  # unix timestamp
    time_window_end: Optional[int] = None  # unix timestamp
    priority: int = 0
    notes: Optional[str] = None
    scheduled_date: Optional[str] = None  # YYYY-MM-DD format for weekly planning

class Job(JobBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    status: str = "pending"  # pending, assigned, in_progress, completed, unassigned
    assigned_technician_id: Optional[str] = None
    scheduled_date: Optional[str] = None  # YYYY-MM-DD format
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class RouteStep(BaseModel):
    job_id: str
    customer_name: str
    address: str
    latitude: float
    longitude: float
    arrival_time: int
    service_duration: int
    service_type: str
    status: str = "pending"

class Route(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    technician_id: str
    technician_name: str
    steps: List[RouteStep]
    total_distance: float  # in meters
    total_duration: int  # in seconds
    total_service_time: int  # in seconds
    geometry: Optional[str] = None
    scheduled_date: Optional[str] = None  # YYYY-MM-DD format
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class OptimizationRun(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    request_id: Optional[str] = None
    status: str = "pending"  # pending, processing, completed, failed
    total_cost: Optional[float] = None
    routes_count: int = 0
    assigned_jobs: int = 0
    unassigned_jobs: int = 0
    total_distance: Optional[float] = None
    city: str
    request_payload: Optional[Dict[str, Any]] = None  # Store input JSON
    response_payload: Optional[Dict[str, Any]] = None  # Store response JSON
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Settings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = "app_settings"
    nextbillion_api_key: Optional[str] = None
    selected_city: str = "chicago"
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class TechnicianAvailability(BaseModel):
    """Represents a technician's availability for a specific date"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    technician_id: str
    technician_name: str
    date: str  # YYYY-MM-DD format
    is_available: bool = True
    shift_start: int  # Unix timestamp for shift start
    shift_end: int  # Unix timestamp for shift end
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ==================== DEMO DATA ====================

# Bounding boxes adjusted to exclude water bodies
GLOBAL_CITIES = {
    "chicago": {
        "name": "Chicago, USA",
        "center": [41.8781, -87.9],
        "depot": [42.0405426862, -88.3143685336],
        "bbox": [41.65, 42.25, -88.35, -87.85]  # Strictly west of Lake Michigan
    },
    "london": {
        "name": "London, UK",
        "center": [51.5074, -0.1278],
        "depot": [51.5074, -0.1278],
        "bbox": [51.4, 51.6, -0.3, 0.05]
    },
    "tokyo": {
        "name": "Tokyo, Japan",
        "center": [35.7, 139.55],
        "depot": [35.7, 139.55],
        "bbox": [35.6, 35.8, 139.4, 139.7]  # Western Tokyo, excludes bay
    },
    "sydney": {
        "name": "Sydney, Australia",
        "center": [-33.85, 151.0],
        "depot": [-33.85, 151.0],
        "bbox": [-33.95, -33.75, 150.85, 151.1]  # Western Sydney
    },
    "mumbai": {
        "name": "Mumbai, India",
        "center": [19.0760, 72.9],
        "depot": [19.0760, 72.9],
        "bbox": [18.95, 19.2, 72.85, 73.05]  # Eastern Mumbai mainland
    },
    "berlin": {
        "name": "Berlin, Germany",
        "center": [52.5200, 13.4050],
        "depot": [52.5200, 13.4050],
        "bbox": [52.4, 52.6, 13.2, 13.55]
    }
}

SKILLS = {
    1: {"name": "Plumbing", "color": "#3b82f6"},
    2: {"name": "Electrical", "color": "#f59e0b"},
    3: {"name": "HVAC", "color": "#22c55e"},
    4: {"name": "General Maintenance", "color": "#8b5cf6"}
}

TECHNICIAN_NAMES = [
    ("Rajesh", "Mehta"), ("Arjun", "Patel"), ("Daniel", "Scott"), 
    ("Michael", "Clark"), ("Ethan", "Wilson"), ("Liam", "Anderson"),
    ("Noah", "Thompson"), ("James", "Martinez"), ("Henry", "Taylor"),
    ("Oliver", "White"), ("Sarah", "Johnson"), ("Emma", "Williams")
]

TECHNICIAN_AVATARS = [
    "https://images.unsplash.com/photo-1581595220975-119360b1c63f?w=200&h=200&fit=crop",
    "https://images.unsplash.com/photo-1593636583886-0bf6a98a8a36?w=200&h=200&fit=crop",
    "https://images.pexels.com/photos/8696371/pexels-photo-8696371.jpeg?w=200&h=200&fit=crop",
    None
]

def generate_random_location(city_key: str) -> tuple:
    """Generate random lat/lng within city bounds"""
    city = GLOBAL_CITIES[city_key]
    bbox = city["bbox"]
    lat = random.uniform(bbox[0], bbox[1])
    lng = random.uniform(bbox[2], bbox[3])
    return round(lat, 6), round(lng, 6)

def generate_demo_technicians(city_key: str) -> List[Dict]:
    """Generate demo technicians for a city"""
    technicians = []
    skill_ids = list(SKILLS.keys())
    
    for i, (first, last) in enumerate(TECHNICIAN_NAMES):
        skill_id = skill_ids[i % len(skill_ids)]
        tech = {
            "id": f"tech_{city_key}_{i+1}",
            "name": f"{first} {last}",
            "skill": SKILLS[skill_id]["name"],
            "skill_id": skill_id,
            "phone": f"+1-555-{random.randint(100, 999)}-{random.randint(1000, 9999)}",
            "email": f"{first.lower()}.{last.lower()}@fieldservice.demo",
            "available": random.random() > 0.1,
            "avatar_url": TECHNICIAN_AVATARS[i % len(TECHNICIAN_AVATARS)],
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        technicians.append(tech)
    
    return technicians

def generate_demo_jobs(city_key: str, count: int = 50, scheduled_date: Optional[str] = None) -> List[Dict]:
    """Generate demo jobs for a city for a specific date"""
    jobs = []
    service_types = ["Plumbing", "Electrical", "HVAC", "General Maintenance"]
    customer_first_names = ["John", "Sarah", "Mike", "Emma", "David", "Lisa", "James", "Anna", "Robert", "Maria"]
    customer_last_names = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Wilson", "Taylor"]
    
    # Use provided date or today
    if scheduled_date:
        date_obj = datetime.strptime(scheduled_date, "%Y-%m-%d")
    else:
        date_obj = datetime.now(timezone.utc)
    
    # Create time windows for the scheduled date (8 AM to 6 PM)
    day_start = int(date_obj.replace(hour=8, minute=0, second=0).timestamp())
    
    for i in range(count):
        lat, lng = generate_random_location(city_key)
        skill_id = (i % 4) + 1
        service_type = service_types[skill_id - 1]
        
        # Distribute jobs across time slots (8 AM to 5 PM, 9 slots)
        slot = i % 9
        time_window_start = day_start + (slot * 3600)
        time_window_end = time_window_start + 3600
        
        # Generate realistic customer names
        customer_name = f"{random.choice(customer_first_names)} {random.choice(customer_last_names)}"
        
        job = {
            "id": f"job_{city_key}_{scheduled_date or 'today'}_{i+1}",
            "customer_name": customer_name,
            "address": f"{random.randint(100, 9999)} {random.choice(['Main', 'Oak', 'Elm', 'Park', 'Lake', 'River', 'Cedar', 'Maple', 'Pine', 'Hill'])} {random.choice(['St', 'Ave', 'Blvd', 'Dr', 'Ln', 'Way', 'Ct'])}",
            "latitude": lat,
            "longitude": lng,
            "service_type": service_type,
            "service_duration": random.choice([1800, 2400, 3000, 3600]),
            "skill_required": skill_id,
            "time_window_start": time_window_start,
            "time_window_end": time_window_end,
            "priority": random.choice([0, 0, 0, 1, 1, 2]),
            "notes": f"{service_type} service request",
            "status": "pending",
            "scheduled_date": scheduled_date,
            "assigned_technician_id": None,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        jobs.append(job)
    
    return jobs

def generate_weekly_jobs(city_key: str, jobs_per_day: int = 8) -> Dict[str, List[Dict]]:
    """Generate demo jobs for a full week (Monday to Sunday)"""
    from datetime import timedelta
    
    # Get the start of the current week (Monday)
    today = datetime.now(timezone.utc)
    days_since_monday = today.weekday()
    monday = today - timedelta(days=days_since_monday)
    
    weekly_jobs = {}
    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    
    for day_offset in range(7):
        current_day = monday + timedelta(days=day_offset)
        date_str = current_day.strftime("%Y-%m-%d")
        day_name = day_names[day_offset]
        
        # Generate fewer jobs on weekends
        day_job_count = jobs_per_day if day_offset < 5 else max(3, jobs_per_day // 2)
        
        jobs = generate_demo_jobs(city_key, day_job_count, date_str)
        weekly_jobs[date_str] = {
            "date": date_str,
            "day_name": day_name,
            "jobs": jobs,
            "job_count": len(jobs)
        }
    
    return weekly_jobs

def generate_technician_availability(city_key: str, technicians: List[Dict]) -> Dict[str, List[Dict]]:
    """Generate technician availability for a full week (Monday to Sunday)"""
    from datetime import timedelta
    
    today = datetime.now(timezone.utc)
    days_since_monday = today.weekday()
    monday = today - timedelta(days=days_since_monday)
    
    weekly_availability = {}
    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    
    # Define some shift patterns for variety
    shift_patterns = [
        {"start_hour": 7, "end_hour": 15, "name": "Early Shift"},
        {"start_hour": 9, "end_hour": 17, "name": "Day Shift"},
        {"start_hour": 10, "end_hour": 18, "name": "Late Shift"},
        {"start_hour": 8, "end_hour": 16, "name": "Standard Shift"},
    ]
    
    for day_offset in range(7):
        current_day = monday + timedelta(days=day_offset)
        date_str = current_day.strftime("%Y-%m-%d")
        day_name = day_names[day_offset]
        is_weekend = day_offset >= 5
        
        day_availability = []
        
        for tech_idx, tech in enumerate(technicians):
            # On weekends, only ~30% of technicians work
            # On weekdays, ~90% of technicians work
            if is_weekend:
                is_available = random.random() < 0.3
            else:
                is_available = random.random() < 0.9
            
            # Assign a shift pattern based on technician index and day
            pattern_idx = (tech_idx + day_offset) % len(shift_patterns)
            shift = shift_patterns[pattern_idx]
            
            # Calculate shift timestamps for this specific date
            shift_start = int(current_day.replace(
                hour=shift["start_hour"], minute=0, second=0
            ).timestamp())
            shift_end = int(current_day.replace(
                hour=shift["end_hour"], minute=0, second=0
            ).timestamp())
            
            availability = {
                "id": f"avail_{city_key}_{tech['id']}_{date_str}",
                "technician_id": tech["id"],
                "technician_name": tech["name"],
                "date": date_str,
                "day_name": day_name,
                "is_available": is_available,
                "shift_start": shift_start,
                "shift_end": shift_end,
                "shift_name": shift["name"],
                "notes": f"{shift['name']} ({shift['start_hour']:02d}:00 - {shift['end_hour']:02d}:00)" if is_available else "Day off",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            day_availability.append(availability)
        
        weekly_availability[date_str] = {
            "date": date_str,
            "day_name": day_name,
            "is_weekend": is_weekend,
            "availability": day_availability,
            "available_count": sum(1 for a in day_availability if a["is_available"])
        }
    
    return weekly_availability

# ==================== API ENDPOINTS ====================

@api_router.get("/")
async def root():
    return {"message": "Field Service Optimization API"}

# Settings endpoints
@api_router.get("/settings")
async def get_settings():
    settings = await db.settings.find_one({"id": "app_settings"}, {"_id": 0})
    if not settings:
        settings = Settings().model_dump()
        settings['updated_at'] = settings['updated_at'].isoformat()
        await db.settings.insert_one(settings)
    return settings

@api_router.put("/settings")
async def update_settings(
    nextbillion_api_key: Optional[str] = None,
    selected_city: Optional[str] = None
):
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if nextbillion_api_key is not None:
        update_data["nextbillion_api_key"] = nextbillion_api_key
    if selected_city is not None and selected_city in GLOBAL_CITIES:
        update_data["selected_city"] = selected_city
    
    await db.settings.update_one(
        {"id": "app_settings"},
        {"$set": update_data},
        upsert=True
    )
    return await get_settings()

# Cities endpoint
@api_router.get("/cities")
async def get_cities():
    return [{"key": k, **v} for k, v in GLOBAL_CITIES.items()]

# Technicians endpoints
@api_router.get("/technicians")
async def get_technicians(city: Optional[str] = None):
    query = {}
    if city:
        query["id"] = {"$regex": f"^tech_{city}_"}
    technicians = await db.technicians.find(query, {"_id": 0}).to_list(100)
    return technicians

@api_router.post("/technicians/generate")
async def generate_technicians(city: str = "chicago"):
    if city not in GLOBAL_CITIES:
        raise HTTPException(status_code=400, detail="Invalid city")
    
    # Clear existing technicians for this city
    await db.technicians.delete_many({"id": {"$regex": f"^tech_{city}_"}})
    
    # Generate new technicians
    technicians = generate_demo_technicians(city)
    if technicians:
        await db.technicians.insert_many(technicians)
    
    return {"message": f"Generated {len(technicians)} technicians for {city}", "count": len(technicians)}

@api_router.put("/technicians/{technician_id}/availability")
async def update_technician_availability(technician_id: str, available: bool):
    result = await db.technicians.update_one(
        {"id": technician_id},
        {"$set": {"available": available}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Technician not found")
    return {"message": "Updated", "id": technician_id, "available": available}

# Technician Availability (Date-specific) endpoints
@api_router.get("/technicians/availability")
async def get_technician_availability(city: str = "chicago", date: Optional[str] = None):
    """Get technician availability - optionally filtered by date"""
    query = {"id": {"$regex": f"^avail_{city}_"}}
    if date:
        query["date"] = date
    availability = await db.technician_availability.find(query, {"_id": 0}).to_list(500)
    return availability

@api_router.get("/technicians/availability/by-date/{date}")
async def get_availability_by_date(date: str, city: str = "chicago"):
    """Get all technicians' availability for a specific date"""
    availability = await db.technician_availability.find(
        {"date": date, "id": {"$regex": f"^avail_{city}_"}},
        {"_id": 0}
    ).to_list(100)
    
    # Include summary stats
    available_count = sum(1 for a in availability if a.get("is_available"))
    
    return {
        "date": date,
        "city": city,
        "total_technicians": len(availability),
        "available_count": available_count,
        "unavailable_count": len(availability) - available_count,
        "availability": availability
    }

@api_router.put("/technicians/availability/{availability_id}")
async def update_date_availability(
    availability_id: str,
    is_available: Optional[bool] = None,
    shift_start: Optional[int] = None,
    shift_end: Optional[int] = None,
    notes: Optional[str] = None
):
    """Update a technician's availability for a specific date"""
    update_data = {}
    if is_available is not None:
        update_data["is_available"] = is_available
    if shift_start is not None:
        update_data["shift_start"] = shift_start
    if shift_end is not None:
        update_data["shift_end"] = shift_end
    if notes is not None:
        update_data["notes"] = notes
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    result = await db.technician_availability.update_one(
        {"id": availability_id},
        {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Availability record not found")
    
    # Return updated record
    updated = await db.technician_availability.find_one({"id": availability_id}, {"_id": 0})
    return updated

@api_router.get("/technicians/weekly-availability")
async def get_weekly_availability(city: str = "chicago"):
    """Get a summary of technician availability for the entire week"""
    from datetime import timedelta
    
    today = datetime.now(timezone.utc)
    days_since_monday = today.weekday()
    monday = today - timedelta(days=days_since_monday)
    
    weekly_summary = []
    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    
    for day_offset in range(7):
        current_day = monday + timedelta(days=day_offset)
        date_str = current_day.strftime("%Y-%m-%d")
        
        # Get availability for this date
        availability = await db.technician_availability.find(
            {"date": date_str, "id": {"$regex": f"^avail_{city}_"}},
            {"_id": 0}
        ).to_list(100)
        
        available_techs = [a for a in availability if a.get("is_available")]
        
        weekly_summary.append({
            "date": date_str,
            "day_name": day_names[day_offset],
            "day_offset": day_offset,
            "is_today": day_offset == days_since_monday,
            "is_weekend": day_offset >= 5,
            "total_technicians": len(availability),
            "available_count": len(available_techs),
            "technicians": availability
        })
    
    return weekly_summary

# Jobs endpoints
@api_router.get("/jobs")
async def get_jobs(city: Optional[str] = None, status: Optional[str] = None):
    query = {}
    if city:
        query["id"] = {"$regex": f"^job_{city}_"}
    if status:
        query["status"] = status
    jobs = await db.jobs.find(query, {"_id": 0}).to_list(500)
    return jobs

@api_router.get("/jobs/by-date")
async def get_jobs_by_date(city: str = "chicago", date: Optional[str] = None):
    """Get jobs for a specific date"""
    query = {"id": {"$regex": f"^job_{city}_"}}
    if date:
        query["scheduled_date"] = date
    jobs = await db.jobs.find(query, {"_id": 0}).to_list(500)
    return jobs

@api_router.get("/jobs/weekly-summary")
async def get_weekly_summary(city: str = "chicago"):
    """Get summary of jobs for the current week"""
    from datetime import timedelta
    
    today = datetime.now(timezone.utc)
    days_since_monday = today.weekday()
    monday = today - timedelta(days=days_since_monday)
    
    summary = []
    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    
    for day_offset in range(7):
        current_day = monday + timedelta(days=day_offset)
        date_str = current_day.strftime("%Y-%m-%d")
        
        # Count jobs for this date
        job_count = await db.jobs.count_documents({
            "id": {"$regex": f"^job_{city}_"},
            "scheduled_date": date_str
        })
        
        # Count routes for this date
        route_count = await db.routes.count_documents({
            "technician_id": {"$regex": f"^tech_{city}_"},
            "scheduled_date": date_str
        })
        
        # Get job status breakdown
        pending = await db.jobs.count_documents({
            "id": {"$regex": f"^job_{city}_"},
            "scheduled_date": date_str,
            "status": "pending"
        })
        assigned = await db.jobs.count_documents({
            "id": {"$regex": f"^job_{city}_"},
            "scheduled_date": date_str,
            "status": "assigned"
        })
        
        # Count available technicians for this date
        available_technicians = await db.technician_availability.count_documents({
            "id": {"$regex": f"^avail_{city}_"},
            "date": date_str,
            "is_available": True
        })
        
        total_technicians = await db.technician_availability.count_documents({
            "id": {"$regex": f"^avail_{city}_"},
            "date": date_str
        })
        
        summary.append({
            "date": date_str,
            "day_name": day_names[day_offset],
            "day_offset": day_offset,
            "is_today": day_offset == days_since_monday,
            "is_weekend": day_offset >= 5,
            "job_count": job_count,
            "route_count": route_count,
            "pending_jobs": pending,
            "assigned_jobs": assigned,
            "available_technicians": available_technicians,
            "total_technicians": total_technicians
        })
    
    return summary

@api_router.post("/jobs/generate")
async def generate_jobs(city: str = "chicago", count: int = 50, date: Optional[str] = None):
    if city not in GLOBAL_CITIES:
        raise HTTPException(status_code=400, detail="Invalid city")
    
    if date:
        # Clear existing jobs for this city and date
        await db.jobs.delete_many({
            "id": {"$regex": f"^job_{city}_"},
            "scheduled_date": date
        })
        # Generate jobs for specific date
        jobs = generate_demo_jobs(city, count, date)
    else:
        # Clear all existing jobs for this city
        await db.jobs.delete_many({"id": {"$regex": f"^job_{city}_"}})
        # Generate jobs without specific date
        jobs = generate_demo_jobs(city, count)
    
    if jobs:
        await db.jobs.insert_many(jobs)
    
    return {"message": f"Generated {len(jobs)} jobs for {city}", "count": len(jobs), "date": date}

@api_router.post("/jobs/generate-weekly")
async def generate_weekly_jobs_endpoint(city: str = "chicago", jobs_per_day: int = 8):
    """Generate jobs and technician availability for an entire week"""
    if city not in GLOBAL_CITIES:
        raise HTTPException(status_code=400, detail="Invalid city")
    
    # Clear existing jobs for this city
    await db.jobs.delete_many({"id": {"$regex": f"^job_{city}_"}})
    
    # Clear existing routes
    await db.routes.delete_many({"technician_id": {"$regex": f"^tech_{city}_"}})
    
    # Clear existing availability
    await db.technician_availability.delete_many({"id": {"$regex": f"^avail_{city}_"}})
    
    # Ensure technicians exist
    technicians = await db.technicians.find(
        {"id": {"$regex": f"^tech_{city}_"}}, 
        {"_id": 0}
    ).to_list(100)
    
    if not technicians:
        # Generate technicians if they don't exist
        technicians = generate_demo_technicians(city)
        if technicians:
            await db.technicians.insert_many(technicians)
    
    # Generate weekly jobs
    weekly_data = generate_weekly_jobs(city, jobs_per_day)
    
    total_jobs = 0
    for date_str, day_data in weekly_data.items():
        if day_data["jobs"]:
            await db.jobs.insert_many(day_data["jobs"])
            total_jobs += len(day_data["jobs"])
    
    # Generate technician availability for the week
    weekly_availability = generate_technician_availability(city, technicians)
    
    total_availability_records = 0
    for date_str, day_availability in weekly_availability.items():
        if day_availability["availability"]:
            await db.technician_availability.insert_many(day_availability["availability"])
            total_availability_records += len(day_availability["availability"])
    
    return {
        "message": f"Generated weekly data for {city}",
        "total_jobs": total_jobs,
        "total_technicians": len(technicians),
        "total_availability_records": total_availability_records,
        "jobs_per_day": jobs_per_day,
        "weekly_summary": [
            {"date": d, "day": data["day_name"], "jobs": data["job_count"]}
            for d, data in weekly_data.items()
        ],
        "availability_summary": [
            {"date": d, "day": data["day_name"], "available_technicians": data["available_count"]}
            for d, data in weekly_availability.items()
        ]
    }

@api_router.post("/jobs")
async def create_job(job: JobBase, city: str = "chicago"):
    job_dict = job.model_dump()
    
    # Set default time windows if not provided
    now = int(datetime.now(timezone.utc).timestamp())
    if job_dict.get("time_window_start") is None:
        job_dict["time_window_start"] = now + 3600  # 1 hour from now
    if job_dict.get("time_window_end") is None:
        job_dict["time_window_end"] = now + 7200  # 2 hours from now
    
    job_doc = Job(**job_dict)
    job_final = job_doc.model_dump()
    job_final["id"] = f"job_{city}_{str(uuid.uuid4())[:8]}"
    job_final["created_at"] = job_final["created_at"].isoformat()
    await db.jobs.insert_one(job_final)
    
    # Remove _id from response
    job_final.pop("_id", None)
    return job_final

@api_router.put("/jobs/{job_id}/status")
async def update_job_status(job_id: str, status: str):
    valid_statuses = ["pending", "assigned", "in_progress", "completed", "unassigned"]
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    result = await db.jobs.update_one(
        {"id": job_id},
        {"$set": {"status": status}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Job not found")
    return {"message": "Updated", "id": job_id, "status": status}

# Routes endpoints
@api_router.get("/routes")
async def get_routes(city: Optional[str] = None, date: Optional[str] = None):
    query = {}
    if city:
        query["technician_id"] = {"$regex": f"^tech_{city}_"}
    if date:
        query["scheduled_date"] = date
    routes = await db.routes.find(query, {"_id": 0}).to_list(100)
    return routes

@api_router.delete("/routes")
async def clear_routes(city: Optional[str] = None, date: Optional[str] = None):
    query = {}
    if city:
        query["technician_id"] = {"$regex": f"^tech_{city}_"}
    if date:
        query["scheduled_date"] = date
    result = await db.routes.delete_many(query)
    return {"message": f"Deleted {result.deleted_count} routes"}

# Optimization endpoints
@api_router.post("/optimize")
async def run_optimization(city: str = "chicago", date: Optional[str] = None):
    """Run route optimization using Nextbillion API for a specific date"""
    settings = await db.settings.find_one({"id": "app_settings"}, {"_id": 0})
    api_key = settings.get("nextbillion_api_key") if settings else None
    
    if not api_key:
        raise HTTPException(status_code=400, detail="Nextbillion API key not configured. Please set it in Settings.")
    
    if city not in GLOBAL_CITIES:
        raise HTTPException(status_code=400, detail="Invalid city")
    
    city_data = GLOBAL_CITIES[city]
    
    # Get available technicians - use date-specific availability if date provided
    if date:
        # Get technicians available on this specific date with their time windows
        availability_records = await db.technician_availability.find(
            {
                "date": date, 
                "id": {"$regex": f"^avail_{city}_"},
                "is_available": True
            },
            {"_id": 0}
        ).to_list(100)
        
        if not availability_records:
            raise HTTPException(status_code=400, detail=f"No technicians available for {date}")
        
        # Get full technician data and merge with availability
        tech_ids = [a["technician_id"] for a in availability_records]
        technicians_data = await db.technicians.find(
            {"id": {"$in": tech_ids}},
            {"_id": 0}
        ).to_list(100)
        
        # Create a map for quick lookup
        tech_map = {t["id"]: t for t in technicians_data}
        
        # Build technicians list with date-specific time windows
        technicians = []
        for avail in availability_records:
            tech_data = tech_map.get(avail["technician_id"])
            if tech_data:
                technicians.append({
                    **tech_data,
                    "shift_start": avail["shift_start"],
                    "shift_end": avail["shift_end"],
                    "shift_name": avail.get("shift_name", "Standard Shift")
                })
    else:
        # Fall back to general availability (no date specified)
        technicians = await db.technicians.find(
            {"id": {"$regex": f"^tech_{city}_"}, "available": True}, 
            {"_id": 0}
        ).to_list(50)
    
    if not technicians:
        raise HTTPException(status_code=400, detail="No available technicians")
    
    # Get pending jobs - filter by date if provided
    job_query = {"id": {"$regex": f"^job_{city}_"}, "status": "pending"}
    if date:
        job_query["scheduled_date"] = date
    
    jobs = await db.jobs.find(job_query, {"_id": 0}).to_list(500)
    
    if not jobs:
        raise HTTPException(status_code=400, detail=f"No pending jobs to optimize{' for ' + date if date else ''}")
    
    # Build optimization request
    depot = city_data["depot"]
    locations = [f"{depot[0]},{depot[1]}"]  # Depot is always index 0
    
    for job in jobs:
        locations.append(f"{job['latitude']},{job['longitude']}")
    
    # Build jobs array for API
    api_jobs = []
    for i, job in enumerate(jobs):
        api_jobs.append({
            "id": job["id"],
            "description": job["notes"],
            "location_index": i + 1,  # +1 because depot is at 0
            "service": job["service_duration"],
            "delivery": [random.randint(5, 15)],
            "skills": [job["skill_required"]],
            "time_windows": [[job["time_window_start"], job["time_window_end"]]]
        })
    
    # Build vehicles array - use technician-specific time windows
    api_vehicles = []
    for tech in technicians:
        # Use date-specific shift times if available, otherwise default
        if "shift_start" in tech and "shift_end" in tech:
            shift_start = tech["shift_start"]
            shift_end = tech["shift_end"]
        elif date:
            date_obj = datetime.strptime(date, "%Y-%m-%d")
            shift_start = int(date_obj.replace(hour=7, minute=0, second=0).timestamp())
            shift_end = int(date_obj.replace(hour=17, minute=0, second=0).timestamp())
        else:
            now = int(datetime.now(timezone.utc).timestamp())
            shift_start = now - (now % 86400) + 25200  # 7 AM UTC
            shift_end = shift_start + 36000  # 10 hours shift
        
        api_vehicles.append({
            "id": tech["id"],
            "description": tech["skill"],
            "start_index": 0,
            "end_index": 0,
            "time_window": [shift_start, shift_end],
            "capacity": [500],
            "skills": [tech["skill_id"]],
            "costs": {"fixed": 3600},
            "max_tasks": 20
        })
    
    # Build request payload
    payload = {
        "locations": {
            "id": 1,
            "location": locations
        },
        "jobs": api_jobs,
        "vehicles": api_vehicles,
        "options": {
            "objective": {
                "custom": {
                    "type": "min",
                    "value": "vehicles"
                }
            }
        }
    }
    
    # Create optimization run record with request payload
    opt_run = {
        "id": str(uuid.uuid4()),
        "request_id": None,
        "status": "processing",
        "city": city,
        "scheduled_date": date,  # Store the date for this optimization
        "request_payload": payload,  # Store the input JSON
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.optimization_runs.insert_one(opt_run)
    
    try:
        # Submit optimization request
        async with httpx.AsyncClient(timeout=60.0) as client_http:
            response = await client_http.post(
                f"https://api.nextbillion.io/optimization/v2?key={api_key}",
                json=payload
            )
            
            if response.status_code != 200:
                await db.optimization_runs.update_one(
                    {"id": opt_run["id"]},
                    {"$set": {"status": "failed"}}
                )
                raise HTTPException(status_code=response.status_code, detail=f"Nextbillion API error: {response.text}")
            
            result = response.json()
            request_id = result.get("id")
            
            await db.optimization_runs.update_one(
                {"id": opt_run["id"]},
                {"$set": {"request_id": request_id}}
            )
            
            return {
                "message": "Optimization submitted",
                "optimization_id": opt_run["id"],
                "request_id": request_id,
                "scheduled_date": date,
                "jobs_count": len(api_jobs),
                "vehicles_count": len(api_vehicles)
            }
            
    except httpx.RequestError as e:
        await db.optimization_runs.update_one(
            {"id": opt_run["id"]},
            {"$set": {"status": "failed"}}
        )
        raise HTTPException(status_code=500, detail=f"Request failed: {str(e)}")

@api_router.get("/optimize/result/{request_id}")
async def get_optimization_result(request_id: str):
    """Get optimization result from Nextbillion API"""
    settings = await db.settings.find_one({"id": "app_settings"}, {"_id": 0})
    api_key = settings.get("nextbillion_api_key") if settings else None
    
    if not api_key:
        raise HTTPException(status_code=400, detail="Nextbillion API key not configured")
    
    try:
        async with httpx.AsyncClient(timeout=60.0) as client_http:
            response = await client_http.get(
                f"https://api.nextbillion.io/optimization/v2/result?id={request_id}&key={api_key}"
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=response.status_code, detail=f"Nextbillion API error: {response.text}")
            
            result = response.json()
            
            # Get the optimization run to find the scheduled_date
            opt_run = await db.optimization_runs.find_one({"request_id": request_id}, {"_id": 0})
            scheduled_date = opt_run.get("scheduled_date") if opt_run else None
            
            # Process result and update database
            if result.get("status") == "Ok" and result.get("result"):
                opt_result = result["result"]
                summary = opt_result.get("summary", {})
                routes_data = opt_result.get("routes", [])
                unassigned = opt_result.get("unassigned", [])
                
                # Clear existing routes for this date only
                if scheduled_date:
                    await db.routes.delete_many({"scheduled_date": scheduled_date})
                else:
                    await db.routes.delete_many({"scheduled_date": None})
                
                # Get jobs mapping
                jobs = await db.jobs.find({}, {"_id": 0}).to_list(500)
                jobs_map = {job["id"]: job for job in jobs}
                
                # Process routes
                for route_data in routes_data:
                    tech_id = route_data["vehicle"]
                    steps = []
                    
                    for step in route_data.get("steps", []):
                        if step.get("type") == "job":
                            job_id = step.get("id")
                            job = jobs_map.get(job_id, {})
                            steps.append({
                                "job_id": job_id,
                                "customer_name": job.get("customer_name", "Unknown"),
                                "address": job.get("address", "Unknown"),
                                "latitude": step.get("location", [0, 0])[0],
                                "longitude": step.get("location", [0, 0])[1],
                                "arrival_time": step.get("arrival", 0),
                                "service_duration": step.get("service", 0),
                                "service_type": job.get("service_type", "Unknown"),
                                "status": "assigned"
                            })
                            
                            # Update job status
                            await db.jobs.update_one(
                                {"id": job_id},
                                {"$set": {"status": "assigned", "assigned_technician_id": tech_id}}
                            )
                    
                    if steps:
                        # Get technician name
                        tech = await db.technicians.find_one({"id": tech_id}, {"_id": 0})
                        tech_name = tech.get("name", "Unknown") if tech else "Unknown"
                        
                        route = {
                            "id": str(uuid.uuid4()),
                            "technician_id": tech_id,
                            "technician_name": tech_name,
                            "steps": steps,
                            "total_distance": route_data.get("distance", 0),
                            "total_duration": route_data.get("duration", 0),
                            "scheduled_date": scheduled_date,  # Add the date to the route
                            "total_service_time": route_data.get("service", 0),
                            "geometry": route_data.get("geometry"),
                            "created_at": datetime.now(timezone.utc).isoformat()
                        }
                        await db.routes.insert_one(route)
                
                # Update unassigned jobs
                for unassigned_job in unassigned:
                    await db.jobs.update_one(
                        {"id": unassigned_job["id"]},
                        {"$set": {"status": "unassigned"}}
                    )
                
                # Update optimization run with response payload
                await db.optimization_runs.update_one(
                    {"request_id": request_id},
                    {"$set": {
                        "status": "completed",
                        "total_cost": summary.get("cost"),
                        "routes_count": summary.get("routes", 0),
                        "assigned_jobs": len(jobs) - summary.get("unassigned", 0),
                        "unassigned_jobs": summary.get("unassigned", 0),
                        "total_distance": summary.get("distance"),
                        "response_payload": result  # Store the response JSON
                    }}
                )
            
            return result
            
    except httpx.RequestError as e:
        raise HTTPException(status_code=500, detail=f"Request failed: {str(e)}")

# Download endpoints for request/response JSON
@api_router.get("/optimize/download/request/{request_id}")
async def download_request_json(request_id: str):
    """Download the input JSON that was sent to the optimization API"""
    opt_run = await db.optimization_runs.find_one({"request_id": request_id}, {"_id": 0})
    if not opt_run:
        raise HTTPException(status_code=404, detail="Optimization run not found")
    
    request_payload = opt_run.get("request_payload")
    if not request_payload:
        raise HTTPException(status_code=404, detail="Request payload not available")
    
    return {
        "filename": f"optimization_request_{request_id}.json",
        "data": request_payload
    }

@api_router.get("/optimize/download/response/{request_id}")
async def download_response_json(request_id: str):
    """Download the response JSON from the optimization API"""
    opt_run = await db.optimization_runs.find_one({"request_id": request_id}, {"_id": 0})
    if not opt_run:
        raise HTTPException(status_code=404, detail="Optimization run not found")
    
    response_payload = opt_run.get("response_payload")
    if not response_payload:
        raise HTTPException(status_code=404, detail="Response payload not available. Run 'Fetch Result' first.")
    
    return {
        "filename": f"optimization_response_{request_id}.json",
        "data": response_payload
    }

@api_router.get("/optimize/latest")
async def get_latest_optimization():
    """Get the latest optimization run with request_id"""
    opt_run = await db.optimization_runs.find_one(
        {"request_id": {"$ne": None}},
        {"_id": 0},
        sort=[("created_at", -1)]
    )
    if not opt_run:
        raise HTTPException(status_code=404, detail="No optimization runs found")
    return opt_run

@api_router.post("/reoptimize")
async def reoptimize(request_id: str, new_job: Optional[JobBase] = None, city: str = "chicago"):
    """Re-optimize routes with modifications"""
    settings = await db.settings.find_one({"id": "app_settings"}, {"_id": 0})
    api_key = settings.get("nextbillion_api_key") if settings else None
    
    if not api_key:
        raise HTTPException(status_code=400, detail="Nextbillion API key not configured")
    
    payload = {
        "id": request_id,
        "jobs": {
            "new": [],
            "update": [],
            "delete": []
        },
        "vehicles": {
            "new": [],
            "update": [],
            "delete": []
        }
    }
    
    # Add new job if provided
    if new_job:
        city_data = GLOBAL_CITIES[city]
        depot = city_data["depot"]
        
        # Get existing locations count
        jobs = await db.jobs.find({"id": {"$regex": f"^job_{city}_"}}, {"_id": 0}).to_list(500)
        new_location_index = len(jobs) + 1
        
        now = int(datetime.now(timezone.utc).timestamp())
        payload["jobs"]["new"].append({
            "id": f"job_{city}_new_{str(uuid.uuid4())[:8]}",
            "description": new_job.notes or "New service request",
            "location_index": new_location_index,
            "location": f"{new_job.latitude},{new_job.longitude}",
            "service": new_job.service_duration,
            "delivery": [10],
            "skills": [new_job.skill_required],
            "time_windows": [[new_job.time_window_start, new_job.time_window_end]]
        })
        
        # Save new job to database
        job_doc = Job(**new_job.model_dump())
        job_dict = job_doc.model_dump()
        job_dict["id"] = payload["jobs"]["new"][0]["id"]
        job_dict["created_at"] = job_dict["created_at"].isoformat()
        await db.jobs.insert_one(job_dict)
    
    try:
        async with httpx.AsyncClient(timeout=60.0) as client_http:
            response = await client_http.post(
                f"https://api.nextbillion.io/optimization/re_optimization?key={api_key}",
                json=payload
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=response.status_code, detail=f"Nextbillion API error: {response.text}")
            
            result = response.json()
            new_request_id = result.get("id")
            
            return {
                "message": "Re-optimization submitted",
                "new_request_id": new_request_id,
                "original_request_id": request_id
            }
            
    except httpx.RequestError as e:
        raise HTTPException(status_code=500, detail=f"Request failed: {str(e)}")

# Statistics endpoint
@api_router.get("/stats")
async def get_stats(city: Optional[str] = None):
    query_tech = {}
    query_jobs = {}
    query_routes = {}
    
    if city:
        query_tech["id"] = {"$regex": f"^tech_{city}_"}
        query_jobs["id"] = {"$regex": f"^job_{city}_"}
        query_routes["technician_id"] = {"$regex": f"^tech_{city}_"}
    
    total_technicians = await db.technicians.count_documents(query_tech)
    available_technicians = await db.technicians.count_documents({**query_tech, "available": True})
    total_jobs = await db.jobs.count_documents(query_jobs)
    pending_jobs = await db.jobs.count_documents({**query_jobs, "status": "pending"})
    assigned_jobs = await db.jobs.count_documents({**query_jobs, "status": "assigned"})
    completed_jobs = await db.jobs.count_documents({**query_jobs, "status": "completed"})
    unassigned_jobs = await db.jobs.count_documents({**query_jobs, "status": "unassigned"})
    total_routes = await db.routes.count_documents(query_routes)
    
    # Calculate total distance
    routes = await db.routes.find(query_routes, {"total_distance": 1, "_id": 0}).to_list(100)
    total_distance = sum(r.get("total_distance", 0) for r in routes)
    
    return {
        "total_technicians": total_technicians,
        "available_technicians": available_technicians,
        "total_jobs": total_jobs,
        "pending_jobs": pending_jobs,
        "assigned_jobs": assigned_jobs,
        "completed_jobs": completed_jobs,
        "unassigned_jobs": unassigned_jobs,
        "total_routes": total_routes,
        "total_distance_km": round(total_distance / 1000, 2)
    }

# Optimization history
@api_router.get("/optimization-history")
async def get_optimization_history(city: Optional[str] = None):
    query = {}
    if city:
        query["city"] = city
    runs = await db.optimization_runs.find(query, {"_id": 0}).sort("created_at", -1).to_list(20)
    return runs

# Skills endpoint
@api_router.get("/skills")
async def get_skills():
    return SKILLS

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health check endpoint for Cloud Run
@app.get("/health")
async def health_check():
    return {"status": "healthy"}

# Serve React frontend static files (only if build exists)
FRONTEND_BUILD_DIR = ROOT_DIR.parent / "frontend" / "build"
if FRONTEND_BUILD_DIR.exists():
    # Mount static assets (JS, CSS, media)
    static_dir = FRONTEND_BUILD_DIR / "static"
    if static_dir.exists():
        app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

    # SPA catch-all: serve index.html for any non-API, non-static path
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # Check if the requested file exists in the build directory
        file_path = FRONTEND_BUILD_DIR / full_path
        if full_path and file_path.exists() and file_path.is_file():
            return FileResponse(str(file_path))
        # Otherwise return index.html for client-side routing
        return FileResponse(str(FRONTEND_BUILD_DIR / "index.html"))

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
