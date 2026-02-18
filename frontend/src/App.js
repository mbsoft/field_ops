import React, { useState, useEffect, useCallback } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Link, useLocation } from "react-router-dom";
import axios from "axios";
import { Toaster, toast } from "sonner";
import {
  LayoutDashboard,
  Map,
  Users,
  Briefcase,
  Settings,
  ChevronRight,
  Zap,
  Clock,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  Phone,
  Mail,
  RefreshCw,
  Plus,
  Loader2,
  Route as RouteIcon,
  Navigation,
  Truck,
  Calendar,
  X,
  Globe,
  Download,
  FileJson
} from "lucide-react";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "./components/ui/dialog";
import { Switch } from "./components/ui/switch";
import { Badge } from "./components/ui/badge";
import { ScrollArea } from "./components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { Checkbox } from "./components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./components/ui/tooltip";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Skill colors
const SKILL_COLORS = {
  1: { bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-300", hex: "#3b82f6" },
  2: { bg: "bg-amber-100", text: "text-amber-700", border: "border-amber-300", hex: "#f59e0b" },
  3: { bg: "bg-green-100", text: "text-green-700", border: "border-green-300", hex: "#22c55e" },
  4: { bg: "bg-purple-100", text: "text-purple-700", border: "border-purple-300", hex: "#8b5cf6" }
};

const SKILL_NAMES = {
  1: "Plumbing",
  2: "Electrical",
  3: "HVAC",
  4: "General Maintenance"
};

// Polyline decoder - decodes encoded polyline string to coordinates
// Nextbillion uses standard polyline encoding (precision 5, divide by 1e5)
const decodePolyline = (encoded) => {
  if (!encoded) return [];
  
  // Unescape backslashes if the polyline contains escaped quotes or backslashes
  let polyline = encoded;
  if (polyline.includes('\\')) {
    polyline = polyline.replace(/\\\\/g, '\\').replace(/\\"/g, '"');
  }
  
  const coordinates = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  
  while (index < polyline.length) {
    // Decode latitude
    let shift = 0;
    let result = 0;
    let byte;
    
    do {
      byte = polyline.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    
    const deltaLat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += deltaLat;
    
    // Decode longitude
    shift = 0;
    result = 0;
    
    do {
      byte = polyline.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    
    const deltaLng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += deltaLng;
    
    // Standard polyline uses precision 5 (1e5)
    coordinates.push([lng / 1e5, lat / 1e5]); // [lng, lat] for GeoJSON
  }
  
  return coordinates;
};

// Sidebar Component
const Sidebar = ({ selectedCity, cities, onCityChange }) => {
  const location = useLocation();
  
  const navItems = [
    { path: "/", icon: LayoutDashboard, label: "Dashboard" },
    { path: "/routes", icon: RouteIcon, label: "Routes" },
    { path: "/technicians", icon: Users, label: "Technicians" },
    { path: "/jobs", icon: Briefcase, label: "Jobs" },
    { path: "/settings", icon: Settings, label: "Settings" }
  ];
  
  return (
    <aside className="sidebar flex flex-col" data-testid="sidebar">
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
            <Truck className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight" style={{ fontFamily: 'Chivo, sans-serif' }}>
              FieldOps
            </h1>
            <p className="text-xs text-muted-foreground">Route Optimizer</p>
          </div>
        </div>
      </div>
      
      <div className="p-4 border-b border-border">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">
          Region
        </Label>
        <Select value={selectedCity} onValueChange={onCityChange}>
          <SelectTrigger data-testid="city-selector">
            <Globe className="w-4 h-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {cities.map(city => (
              <SelectItem key={city.key} value={city.key}>
                {city.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(item => (
          <Link
            key={item.path}
            to={item.path}
            className={`sidebar-nav-item ${location.pathname === item.path ? 'active' : ''}`}
            data-testid={`nav-${item.label.toLowerCase()}`}
          >
            <item.icon className="w-5 h-5" />
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
      
      <div className="p-4 border-t border-border">
        <p className="text-xs text-muted-foreground text-center">
          Powered by Nextbillion.ai
        </p>
      </div>
    </aside>
  );
};

// Stats Card Component
const StatCard = ({ icon: Icon, value, label, color = "primary", trend }) => (
  <div className="bento-card stat-card animate-fade-in" data-testid={`stat-${label.toLowerCase().replace(/\s/g, '-')}`}>
    <div className="flex items-center justify-between">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
        color === 'success' ? 'bg-green-100' :
        color === 'warning' ? 'bg-amber-100' :
        color === 'info' ? 'bg-blue-100' :
        color === 'destructive' ? 'bg-red-100' :
        'bg-primary/10'
      }`}>
        <Icon className={`w-5 h-5 ${
          color === 'success' ? 'text-green-600' :
          color === 'warning' ? 'text-amber-600' :
          color === 'info' ? 'text-blue-600' :
          color === 'destructive' ? 'text-red-600' :
          'text-primary'
        }`} />
      </div>
      {trend && (
        <span className={`text-xs font-medium ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
          {trend > 0 ? '+' : ''}{trend}%
        </span>
      )}
    </div>
    <div className="stat-value">{value}</div>
    <div className="stat-label">{label}</div>
  </div>
);

// Route colors for technicians - more distinct colors
const ROUTE_COLORS = [
  '#3b82f6', // blue
  '#f59e0b', // amber
  '#22c55e', // green
  '#8b5cf6', // purple
  '#ef4444', // red
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#84cc16', // lime
  '#f97316', // orange
  '#6366f1', // indigo
];

// Map Component with Nextbillion SDK - Enhanced with job filtering and details
const MapView = ({ routes, jobs, depot, apiKey, city, visibleRoutes, selectedJobId, onSelectJob }) => {
  const mapContainerRef = React.useRef(null);
  const nbMapRef = React.useRef(null);
  const markersRef = React.useRef([]);
  const popupRef = React.useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [error, setError] = useState(null);

  // Build a map of job_id to route info for filtering
  const getJobsToDisplay = () => {
    // Get list of visible route IDs
    const visibleRouteIds = Object.entries(visibleRoutes || {})
      .filter(([_, isVisible]) => isVisible)
      .map(([routeId]) => routeId);
    
    // If no routes are visible or all routes visible, show all jobs in routes
    const allRoutesVisible = visibleRouteIds.length === routes.length || visibleRouteIds.length === 0;
    
    // Build job display list with sequence numbers
    const jobsToShow = [];
    
    routes.forEach((route, routeIndex) => {
      const isRouteVisible = !visibleRoutes || visibleRoutes[route.id] !== false;
      if (!isRouteVisible && !allRoutesVisible) return;
      
      const routeColor = ROUTE_COLORS[routeIndex % ROUTE_COLORS.length];
      
      (route.steps || []).forEach((step, stepIndex) => {
        // Find the full job data
        const fullJob = jobs.find(j => j.id === step.job_id) || step;
        
        jobsToShow.push({
          ...fullJob,
          ...step,
          sequenceNumber: stepIndex + 1,
          routeIndex,
          routeColor,
          technicianName: route.technician_name,
          routeId: route.id
        });
      });
    });
    
    return jobsToShow;
  };

  useEffect(() => {
    if (!apiKey || !city) {
      setError("API key or city not configured");
      return;
    }

    // Clean up previous map instance
    if (nbMapRef.current) {
      try {
        markersRef.current.forEach(marker => {
          try { marker.remove(); } catch (e) {}
        });
        markersRef.current = [];
        if (popupRef.current) {
          try { popupRef.current.remove(); } catch (e) {}
        }
        nbMapRef.current.destroy();
      } catch (e) {
        console.warn('Map cleanup warning:', e);
      }
      nbMapRef.current = null;
    }

    const loadMap = async () => {
      try {
        const nextbillion = await import('@nbai/nbmap-gl');
        await import('@nbai/nbmap-gl/dist/nextbillion.css');
        
        nextbillion.default.setApiKey(apiKey);
        
        if (!mapContainerRef.current) return;
        
        const center = depot || [0, 0];
        
        const nbMap = new nextbillion.NBMap({
          container: mapContainerRef.current,
          zoom: 10,
          style: 'https://api.nextbillion.io/maps/streets/style.json',
          center: [center[1], center[0]]
        });
        
        nbMapRef.current = nbMap;
        const map = nbMap.map;
        
        // Create a popup instance for job details
        const popup = new nextbillion.Popup({
          closeButton: true,
          closeOnClick: false,
          maxWidth: '300px',
          className: 'job-popup'
        });
        popupRef.current = popup;
        
        map.on('load', () => {
          setMapLoaded(true);
          
          // Add depot marker
          if (depot) {
            const depotEl = document.createElement('div');
            depotEl.className = 'depot-marker';
            depotEl.innerHTML = `
              <div class="w-10 h-10 bg-zinc-900 rounded-full flex items-center justify-center shadow-lg border-2 border-white">
                <svg class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/>
                </svg>
              </div>
            `;
            
            const depotMarker = new nextbillion.Marker({ element: depotEl })
              .setLngLat([depot[1], depot[0]])
              .addTo(map);
            markersRef.current.push(depotMarker);
          }
          
          // Add job markers with sequence numbers
          const jobsToDisplay = getJobsToDisplay();
          
          jobsToDisplay.forEach((job) => {
            const markerEl = document.createElement('div');
            markerEl.className = 'job-marker cursor-pointer';
            markerEl.innerHTML = `
              <div class="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg border-2 border-white transition-all hover:scale-125 hover:z-50" 
                   style="background-color: ${job.routeColor}">
                ${job.sequenceNumber}
              </div>
            `;
            
            // Add click handler to show popup with job details
            markerEl.addEventListener('click', (e) => {
              e.stopPropagation();
              
              const popupContent = `
                <div class="p-3 min-w-[200px]">
                  <div class="flex items-center gap-2 mb-2">
                    <div class="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold" 
                         style="background-color: ${job.routeColor}">
                      ${job.sequenceNumber}
                    </div>
                    <span class="font-bold text-sm">${job.customer_name || 'Customer'}</span>
                  </div>
                  <div class="space-y-1 text-xs">
                    <div class="flex justify-between">
                      <span class="text-gray-500">Service:</span>
                      <span class="font-medium">${job.service_type || 'N/A'}</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-gray-500">Address:</span>
                      <span class="font-medium truncate max-w-[150px]">${job.address || 'N/A'}</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-gray-500">Duration:</span>
                      <span class="font-medium">${Math.round((job.service_duration || 0) / 60)} min</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-gray-500">Arrival:</span>
                      <span class="font-medium">${job.arrival_time ? new Date(job.arrival_time * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'N/A'}</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-gray-500">Technician:</span>
                      <span class="font-medium">${job.technicianName || 'N/A'}</span>
                    </div>
                    ${job.notes ? `<div class="mt-2 pt-2 border-t text-gray-600">${job.notes}</div>` : ''}
                  </div>
                </div>
              `;
              
              popup
                .setLngLat([job.longitude, job.latitude])
                .setHTML(popupContent)
                .addTo(map);
              
              if (onSelectJob) onSelectJob(job.job_id);
            });
            
            // Add hover effect
            markerEl.addEventListener('mouseenter', () => {
              markerEl.querySelector('div').style.transform = 'scale(1.2)';
              markerEl.querySelector('div').style.zIndex = '100';
            });
            markerEl.addEventListener('mouseleave', () => {
              markerEl.querySelector('div').style.transform = 'scale(1)';
              markerEl.querySelector('div').style.zIndex = '1';
            });
            
            const marker = new nextbillion.Marker({ element: markerEl })
              .setLngLat([job.longitude, job.latitude])
              .addTo(map);
            markersRef.current.push(marker);
          });
          
          // Draw route polylines
          routes.forEach((route, routeIndex) => {
            try {
              const routeColor = ROUTE_COLORS[routeIndex % ROUTE_COLORS.length];
              const sourceId = `route-${route.id}`;
              const isVisible = !visibleRoutes || visibleRoutes[route.id] !== false;
              
              let coordinates = [];
              if (route.geometry) {
                coordinates = decodePolyline(route.geometry);
              } else if (route.steps && route.steps.length > 1) {
                coordinates = route.steps.map(step => [step.longitude, step.latitude]);
              }
              
              if (coordinates.length > 1) {
                if (map.getLayer(sourceId)) map.removeLayer(sourceId);
                if (map.getSource(sourceId)) map.removeSource(sourceId);
                
                map.addSource(sourceId, {
                  type: 'geojson',
                  data: {
                    type: 'Feature',
                    geometry: { type: 'LineString', coordinates }
                  }
                });
                
                map.addLayer({
                  id: sourceId,
                  type: 'line',
                  source: sourceId,
                  layout: {
                    'line-join': 'round',
                    'line-cap': 'round',
                    'visibility': isVisible ? 'visible' : 'none'
                  },
                  paint: {
                    'line-color': routeColor,
                    'line-width': 5,
                    'line-opacity': 0.85
                  }
                });
              }
            } catch (e) {
              console.error('Error drawing route:', e, route);
            }
          });
        });
        
        map.on('error', (e) => {
          console.error('Map error:', e);
          setError('Map failed to load. Check your API key.');
        });
        
      } catch (err) {
        console.error('Failed to load map:', err);
        setError('Failed to load map SDK');
      }
    };
    
    setMapLoaded(false);
    setError(null);
    loadMap();
    
    return () => {
      // Clean up markers
      markersRef.current.forEach(marker => {
        try { marker.remove(); } catch (e) {}
      });
      markersRef.current = [];
      
      if (nbMapRef.current) {
        try {
          nbMapRef.current.destroy();
        } catch (e) {
          console.warn('Map cleanup warning:', e);
        }
        nbMapRef.current = null;
      }
    };
  }, [apiKey, city, depot, jobs, routes, visibleRoutes]);

  // Update route visibility when visibleRoutes changes
  useEffect(() => {
    if (!nbMapRef.current || !mapLoaded) return;
    
    const map = nbMapRef.current.map;
    routes.forEach((route) => {
      const sourceId = `route-${route.id}`;
      const isVisible = !visibleRoutes || visibleRoutes[route.id] !== false;
      
      if (map.getLayer(sourceId)) {
        map.setLayoutProperty(sourceId, 'visibility', isVisible ? 'visible' : 'none');
      }
    });
  }, [visibleRoutes, routes, mapLoaded]);

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted/50 rounded-lg">
        <div className="text-center p-8">
          <MapPin className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">{error}</p>
          <p className="text-sm text-muted-foreground mt-2">Please configure your API key in Settings</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative" data-testid="map-container">
      <div ref={mapContainerRef} className="w-full h-full map-container" />
      {!mapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
};

// Simple fallback map using static markers display
const SimpleMapView = ({ jobs, depot }) => {
  return (
    <div className="w-full h-full bg-zinc-100 rounded-lg p-4 overflow-auto" data-testid="simple-map">
      <div className="text-center mb-4">
        <p className="text-sm text-muted-foreground">Map preview (Configure API key for full map)</p>
      </div>
      <div className="space-y-2 max-h-[500px] overflow-y-auto">
        {depot && (
          <div className="flex items-center gap-3 p-3 bg-primary/10 rounded-lg">
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
              <Navigation className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="font-medium text-sm">Depot</p>
              <p className="text-xs text-muted-foreground">{depot[0].toFixed(4)}, {depot[1].toFixed(4)}</p>
            </div>
          </div>
        )}
        {jobs.slice(0, 20).map((job, index) => (
          <div key={job.id} className="flex items-center gap-3 p-3 bg-white rounded-lg border">
            <div 
              className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold ${SKILL_COLORS[job.skill_required]?.bg} ${SKILL_COLORS[job.skill_required]?.text}`}
              style={{ backgroundColor: SKILL_COLORS[job.skill_required]?.hex }}
            >
              {index + 1}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{job.customer_name}</p>
              <p className="text-xs text-muted-foreground truncate">{job.address}</p>
            </div>
            <Badge variant="outline" className="text-xs">
              {SKILL_NAMES[job.skill_required]}
            </Badge>
          </div>
        ))}
        {jobs.length > 20 && (
          <p className="text-center text-sm text-muted-foreground py-2">
            +{jobs.length - 20} more jobs
          </p>
        )}
      </div>
    </div>
  );
};

// Dashboard Page
const Dashboard = ({ stats, routes, jobs, cities, selectedCity, apiKey, onOptimize, optimizing, lastRequestId, onFetchResult }) => {
  const cityData = cities.find(c => c.key === selectedCity);
  const depot = cityData?.depot;
  const [visibleRoutes, setVisibleRoutes] = useState({});
  const [showAllRoutes, setShowAllRoutes] = useState(true);
  
  // Initialize visible routes when routes change
  useEffect(() => {
    const initial = {};
    routes.forEach(route => {
      initial[route.id] = true;
    });
    setVisibleRoutes(initial);
    setShowAllRoutes(true);
  }, [routes]);
  
  const toggleRoute = (routeId) => {
    setVisibleRoutes(prev => ({
      ...prev,
      [routeId]: !prev[routeId]
    }));
  };
  
  const toggleAllRoutes = () => {
    const newState = !showAllRoutes;
    setShowAllRoutes(newState);
    const updated = {};
    routes.forEach(route => {
      updated[route.id] = newState;
    });
    setVisibleRoutes(updated);
  };
  
  const downloadJson = async (type) => {
    if (!lastRequestId) {
      toast.error('No optimization run available');
      return;
    }
    
    try {
      const endpoint = type === 'request' 
        ? `${API}/optimize/download/request/${lastRequestId}`
        : `${API}/optimize/download/response/${lastRequestId}`;
      
      const response = await axios.get(endpoint);
      const { filename, data } = response.data;
      
      // Create blob and download
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success(`Downloaded ${filename}`);
    } catch (error) {
      console.error('Download failed:', error);
      toast.error(error.response?.data?.detail || 'Download failed');
    }
  };
  
  return (
    <div className="space-y-6" data-testid="dashboard">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight" style={{ fontFamily: 'Chivo, sans-serif' }}>
            Dashboard
          </h2>
          <p className="text-muted-foreground">
            Field service operations overview for {cityData?.name || selectedCity}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastRequestId && (
            <>
              <div className="flex items-center gap-1 border rounded-lg p-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => downloadJson('request')}
                  title="Download Input JSON"
                  data-testid="download-request-btn"
                >
                  <FileJson className="w-4 h-4 mr-1" />
                  Input
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => downloadJson('response')}
                  title="Download Response JSON"
                  data-testid="download-response-btn"
                >
                  <Download className="w-4 h-4 mr-1" />
                  Response
                </Button>
              </div>
              <Button
                variant="outline"
                onClick={onFetchResult}
                data-testid="fetch-result-btn"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Fetch Result
              </Button>
            </>
          )}
          <Button
            onClick={onOptimize}
            disabled={optimizing || !apiKey}
            data-testid="optimize-btn"
          >
            {optimizing ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Zap className="w-4 h-4 mr-2" />
            )}
            {optimizing ? 'Optimizing...' : 'Optimize Routes'}
          </Button>
        </div>
      </div>
      
      {!apiKey && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <div>
            <p className="font-medium text-amber-800">API Key Required</p>
            <p className="text-sm text-amber-700">Please configure your Nextbillion API key in Settings to enable route optimization.</p>
          </div>
          <Link to="/settings" className="ml-auto">
            <Button variant="outline" size="sm">Configure</Button>
          </Link>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          icon={Users} 
          value={stats.available_technicians || 0} 
          label="Available Technicians" 
          color="success"
        />
        <StatCard 
          icon={Briefcase} 
          value={stats.pending_jobs || 0} 
          label="Pending Jobs" 
          color="warning"
        />
        <StatCard 
          icon={CheckCircle2} 
          value={stats.assigned_jobs || 0} 
          label="Assigned Jobs" 
          color="info"
        />
        <StatCard 
          icon={RouteIcon} 
          value={stats.total_routes || 0} 
          label="Active Routes" 
          color="primary"
        />
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8">
          <div className="bento-card p-0 overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold">Route Map</h3>
              <div className="flex items-center gap-3">
                <Badge variant="outline">{jobs.length} jobs</Badge>
                {routes.length > 0 && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={toggleAllRoutes}
                    data-testid="toggle-all-routes-btn"
                  >
                    {showAllRoutes ? 'Hide All' : 'Show All'}
                  </Button>
                )}
              </div>
            </div>
            <div className="h-[500px] relative">
              {apiKey ? (
                <MapView 
                  routes={routes} 
                  jobs={jobs} 
                  depot={depot} 
                  apiKey={apiKey} 
                  city={selectedCity}
                  visibleRoutes={visibleRoutes}
                  onToggleRoute={toggleRoute}
                />
              ) : (
                <SimpleMapView jobs={jobs} depot={depot} />
              )}
              
              {/* Route Legend Panel */}
              {routes.length > 0 && apiKey && (
                <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border p-3 max-w-[220px] max-h-[300px] overflow-y-auto z-10">
                  <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                    <RouteIcon className="w-4 h-4" />
                    Route Layers
                  </h4>
                  <div className="space-y-2">
                    {routes.map((route, index) => (
                      <button
                        key={route.id}
                        onClick={() => toggleRoute(route.id)}
                        className={`w-full flex items-center gap-2 p-2 rounded-md transition-colors text-left ${
                          visibleRoutes[route.id] !== false 
                            ? 'bg-muted/50 hover:bg-muted' 
                            : 'opacity-50 hover:opacity-75'
                        }`}
                        data-testid={`toggle-route-${route.id}`}
                      >
                        <div 
                          className="w-4 h-4 rounded-full flex-shrink-0"
                          style={{ backgroundColor: ROUTE_COLORS[index % ROUTE_COLORS.length] }}
                        />
                        <span className="text-xs font-medium truncate flex-1">
                          {route.technician_name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {route.steps?.length || 0}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="lg:col-span-4 space-y-6">
          <div className="bento-card">
            <h3 className="font-semibold mb-4">Quick Stats</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Total Distance</span>
                <span className="font-mono font-semibold">{stats.total_distance_km || 0} km</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Unassigned Jobs</span>
                <span className="font-mono font-semibold text-destructive">{stats.unassigned_jobs || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Completed Jobs</span>
                <span className="font-mono font-semibold text-green-600">{stats.completed_jobs || 0}</span>
              </div>
            </div>
          </div>
          
          <div className="bento-card">
            <h3 className="font-semibold mb-4">Active Routes</h3>
            <ScrollArea className="h-[280px]">
              {routes.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">
                  No routes generated yet. Click "Optimize Routes" to start.
                </p>
              ) : (
                <div className="space-y-3">
                  {routes.map((route, index) => (
                    <button 
                      key={route.id} 
                      className={`w-full text-left p-3 rounded-lg transition-colors ${
                        visibleRoutes[route.id] !== false 
                          ? 'bg-muted/50 hover:bg-muted' 
                          : 'opacity-50 bg-muted/20'
                      }`}
                      onClick={() => toggleRoute(route.id)}
                    >
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
                          style={{ backgroundColor: ROUTE_COLORS[index % ROUTE_COLORS.length] }}
                        >
                          {route.steps?.length || 0}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{route.technician_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(route.total_distance / 1000).toFixed(1)} km • {route.steps?.length || 0} stops
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </div>
    </div>
  );
};

// Routes Page
const RoutesPage = ({ routes, apiKey, selectedCity, cities }) => {
  const [selectedRoute, setSelectedRoute] = useState(null);
  const cityData = cities.find(c => c.key === selectedCity);
  const depot = cityData?.depot;
  
  return (
    <div className="space-y-6" data-testid="routes-page">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight" style={{ fontFamily: 'Chivo, sans-serif' }}>
            Routes
          </h2>
          <p className="text-muted-foreground">
            View and manage optimized routes
          </p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4">
          <div className="bento-card">
            <h3 className="font-semibold mb-4">Route List</h3>
            <ScrollArea className="h-[600px]">
              {routes.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">
                  No routes available. Run optimization first.
                </p>
              ) : (
                <div className="space-y-3">
                  {routes.map((route, index) => (
                    <button
                      key={route.id}
                      onClick={() => setSelectedRoute(route)}
                      className={`w-full text-left p-4 rounded-lg border transition-colors ${
                        selectedRoute?.id === route.id 
                          ? 'border-primary bg-primary/5' 
                          : 'border-border hover:bg-muted/50'
                      }`}
                      data-testid={`route-card-${index}`}
                    >
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                          style={{ backgroundColor: SKILL_COLORS[(index % 4) + 1]?.hex }}
                        >
                          {route.steps?.length || 0}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{route.technician_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {(route.total_distance / 1000).toFixed(1)} km • {Math.round(route.total_duration / 60)} min
                          </p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
        
        <div className="lg:col-span-8">
          {selectedRoute ? (
            <div className="bento-card">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-semibold text-lg">{selectedRoute.technician_name}</h3>
                  <p className="text-muted-foreground text-sm">
                    {selectedRoute.steps?.length || 0} stops • {(selectedRoute.total_distance / 1000).toFixed(1)} km
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setSelectedRoute(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="space-y-4">
                {selectedRoute.steps?.map((step, index) => (
                  <div key={index} className="route-step">
                    <div 
                      className="route-step-marker text-white"
                      style={{ backgroundColor: SKILL_COLORS[(index % 4) + 1]?.hex }}
                    >
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{step.customer_name}</p>
                      <p className="text-sm text-muted-foreground">{step.address}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(step.arrival_time * 1000).toLocaleTimeString()}
                        </span>
                        <span>{Math.round(step.service_duration / 60)} min service</span>
                        <Badge variant="outline" className="text-xs">{step.service_type}</Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bento-card h-full flex items-center justify-center">
              <div className="text-center">
                <RouteIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Select a route to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Technicians Page
const TechniciansPage = ({ technicians, onRefresh, refreshing, selectedCity, onToggleAvailability }) => {
  return (
    <div className="space-y-6" data-testid="technicians-page">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight" style={{ fontFamily: 'Chivo, sans-serif' }}>
            Technicians
          </h2>
          <p className="text-muted-foreground">
            Manage your field service technicians
          </p>
        </div>
        <Button onClick={onRefresh} disabled={refreshing} variant="outline" data-testid="refresh-technicians-btn">
          {refreshing ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          Regenerate Data
        </Button>
      </div>
      
      <div className="bento-card p-0 overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th>Technician</th>
              <th>Skill</th>
              <th>Contact</th>
              <th>Status</th>
              <th>Available</th>
            </tr>
          </thead>
          <tbody>
            {technicians.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-12 text-muted-foreground">
                  No technicians found. Click "Regenerate Data" to create demo data.
                </td>
              </tr>
            ) : (
              technicians.map(tech => (
                <tr key={tech.id} data-testid={`tech-row-${tech.id}`}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                        {tech.avatar_url ? (
                          <img src={tech.avatar_url} alt={tech.name} className="w-full h-full object-cover" />
                        ) : (
                          <Users className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                      <span className="font-medium">{tech.name}</span>
                    </div>
                  </td>
                  <td>
                    <span className={`skill-badge ${SKILL_COLORS[tech.skill_id]?.bg} ${SKILL_COLORS[tech.skill_id]?.text}`}>
                      {tech.skill}
                    </span>
                  </td>
                  <td>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="w-3 h-3" />
                        {tech.phone}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Mail className="w-3 h-3" />
                        {tech.email}
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`status-badge ${tech.available ? 'status-completed' : 'status-unassigned'}`}>
                      {tech.available ? 'Active' : 'Unavailable'}
                    </span>
                  </td>
                  <td>
                    <Switch
                      checked={tech.available}
                      onCheckedChange={(checked) => onToggleAvailability(tech.id, checked)}
                      data-testid={`tech-availability-${tech.id}`}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Jobs Page
const JobsPage = ({ jobs, onRefresh, refreshing, selectedCity, onAddJob }) => {
  const [activeTab, setActiveTab] = useState("all");
  
  const filteredJobs = activeTab === "all" 
    ? jobs 
    : jobs.filter(j => j.status === activeTab);
  
  return (
    <div className="space-y-6" data-testid="jobs-page">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight" style={{ fontFamily: 'Chivo, sans-serif' }}>
            Jobs
          </h2>
          <p className="text-muted-foreground">
            View and manage service requests
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={onRefresh} disabled={refreshing} variant="outline" data-testid="refresh-jobs-btn">
            {refreshing ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Regenerate Data
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button data-testid="add-job-btn">
                <Plus className="w-4 h-4 mr-2" />
                Add Job
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Job</DialogTitle>
                <DialogDescription>
                  Create a new service request. This will trigger re-optimization.
                </DialogDescription>
              </DialogHeader>
              <AddJobForm onSubmit={onAddJob} selectedCity={selectedCity} />
            </DialogContent>
          </Dialog>
        </div>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all" data-testid="tab-all">All ({jobs.length})</TabsTrigger>
          <TabsTrigger value="pending" data-testid="tab-pending">Pending ({jobs.filter(j => j.status === 'pending').length})</TabsTrigger>
          <TabsTrigger value="assigned" data-testid="tab-assigned">Assigned ({jobs.filter(j => j.status === 'assigned').length})</TabsTrigger>
          <TabsTrigger value="unassigned" data-testid="tab-unassigned">Unassigned ({jobs.filter(j => j.status === 'unassigned').length})</TabsTrigger>
        </TabsList>
      </Tabs>
      
      <div className="bento-card p-0 overflow-hidden">
        <ScrollArea className="h-[600px]">
          <table className="data-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Service</th>
                <th>Address</th>
                <th>Time Window</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredJobs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-muted-foreground">
                    No jobs found. Click "Regenerate Data" to create demo data.
                  </td>
                </tr>
              ) : (
                filteredJobs.map(job => (
                  <tr key={job.id} data-testid={`job-row-${job.id}`}>
                    <td className="font-medium">{job.customer_name}</td>
                    <td>
                      <span className={`skill-badge ${SKILL_COLORS[job.skill_required]?.bg} ${SKILL_COLORS[job.skill_required]?.text}`}>
                        {job.service_type}
                      </span>
                    </td>
                    <td className="text-muted-foreground max-w-[200px] truncate">{job.address}</td>
                    <td>
                      <div className="flex items-center gap-1 text-sm">
                        <Calendar className="w-3 h-3" />
                        {new Date(job.time_window_start * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {' - '}
                        {new Date(job.time_window_end * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td>
                      <span className={`status-badge status-${job.status}`}>
                        {job.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </ScrollArea>
      </div>
    </div>
  );
};

// Add Job Form
const AddJobForm = ({ onSubmit, selectedCity }) => {
  const [formData, setFormData] = useState({
    customer_name: '',
    address: '',
    latitude: '',
    longitude: '',
    service_type: 'Plumbing',
    skill_required: 1,
    service_duration: 3600,
    notes: ''
  });
  
  const handleSubmit = (e) => {
    e.preventDefault();
    const now = Math.floor(Date.now() / 1000);
    onSubmit({
      ...formData,
      latitude: parseFloat(formData.latitude) || 0,
      longitude: parseFloat(formData.longitude) || 0,
      time_window_start: now + 3600,
      time_window_end: now + 7200
    });
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Customer Name</Label>
          <Input
            value={formData.customer_name}
            onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
            required
            data-testid="job-customer-name"
          />
        </div>
        <div className="space-y-2">
          <Label>Service Type</Label>
          <Select
            value={formData.service_type}
            onValueChange={(value) => setFormData({ 
              ...formData, 
              service_type: value,
              skill_required: Object.entries(SKILL_NAMES).find(([k, v]) => v === value)?.[0] || 1
            })}
          >
            <SelectTrigger data-testid="job-service-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(SKILL_NAMES).map(([id, name]) => (
                <SelectItem key={id} value={name}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Address</Label>
        <Input
          value={formData.address}
          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          required
          data-testid="job-address"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Latitude</Label>
          <Input
            type="number"
            step="any"
            value={formData.latitude}
            onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
            required
            data-testid="job-latitude"
          />
        </div>
        <div className="space-y-2">
          <Label>Longitude</Label>
          <Input
            type="number"
            step="any"
            value={formData.longitude}
            onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
            required
            data-testid="job-longitude"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Notes</Label>
        <Input
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          data-testid="job-notes"
        />
      </div>
      <DialogFooter>
        <Button type="submit" data-testid="submit-job-btn">Create Job</Button>
      </DialogFooter>
    </form>
  );
};

// Settings Page
const SettingsPage = ({ settings, onSave, saving }) => {
  const [apiKey, setApiKey] = useState(settings.nextbillion_api_key || '');
  
  useEffect(() => {
    setApiKey(settings.nextbillion_api_key || '');
  }, [settings]);
  
  const handleSave = () => {
    onSave({ nextbillion_api_key: apiKey });
  };
  
  return (
    <div className="space-y-6" data-testid="settings-page">
      <div>
        <h2 className="text-3xl font-bold tracking-tight" style={{ fontFamily: 'Chivo, sans-serif' }}>
          Settings
        </h2>
        <p className="text-muted-foreground">
          Configure your application settings
        </p>
      </div>
      
      <div className="max-w-2xl">
        <div className="bento-card space-y-6">
          <div>
            <h3 className="font-semibold mb-4">API Configuration</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="api-key">Nextbillion API Key</Label>
                <Input
                  id="api-key"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter your Nextbillion API key"
                  data-testid="api-key-input"
                />
                <p className="text-sm text-muted-foreground">
                  Get your API key from{' '}
                  <a 
                    href="https://nextbillion.ai" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    nextbillion.ai
                  </a>
                </p>
              </div>
            </div>
          </div>
          
          <div className="pt-4 border-t border-border">
            <Button onClick={handleSave} disabled={saving} data-testid="save-settings-btn">
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              Save Settings
            </Button>
          </div>
        </div>
        
        <div className="bento-card mt-6">
          <h3 className="font-semibold mb-4">About</h3>
          <p className="text-muted-foreground text-sm">
            FieldOps Route Optimizer is a demo application showcasing route optimization 
            capabilities using Nextbillion.ai's Route Optimization API. It demonstrates 
            how field service companies can optimize technician routes to maximize 
            efficiency and reduce operational costs.
          </p>
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Version 1.0.0</span>
              <span>•</span>
              <span>Powered by Nextbillion.ai</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Main App Component
function App() {
  const [cities, setCities] = useState([]);
  const [selectedCity, setSelectedCity] = useState('chicago');
  const [settings, setSettings] = useState({});
  const [stats, setStats] = useState({});
  const [technicians, setTechnicians] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [optimizing, setOptimizing] = useState(false);
  const [lastRequestId, setLastRequestId] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  // Fetch initial data
  const fetchData = useCallback(async () => {
    try {
      const [citiesRes, settingsRes] = await Promise.all([
        axios.get(`${API}/cities`),
        axios.get(`${API}/settings`)
      ]);
      
      setCities(citiesRes.data);
      setSettings(settingsRes.data);
      
      const city = settingsRes.data.selected_city || 'chicago';
      setSelectedCity(city);
      
      await fetchCityData(city);
      
      // Try to get latest optimization request_id for download buttons
      try {
        const latestOpt = await axios.get(`${API}/optimize/latest`);
        if (latestOpt.data?.request_id) {
          setLastRequestId(latestOpt.data.request_id);
        }
      } catch (e) {
        // No previous optimization runs, ignore
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCityData = async (city) => {
    try {
      const [statsRes, techRes, jobsRes, routesRes] = await Promise.all([
        axios.get(`${API}/stats?city=${city}`),
        axios.get(`${API}/technicians?city=${city}`),
        axios.get(`${API}/jobs?city=${city}`),
        axios.get(`${API}/routes?city=${city}`)
      ]);
      
      setStats(statsRes.data);
      setTechnicians(techRes.data);
      setJobs(jobsRes.data);
      setRoutes(routesRes.data);
    } catch (error) {
      console.error('Failed to fetch city data:', error);
    }
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCityChange = async (city) => {
    setSelectedCity(city);
    await axios.put(`${API}/settings?selected_city=${city}`);
    await fetchCityData(city);
  };

  const handleOptimize = async () => {
    if (!settings.nextbillion_api_key) {
      toast.error('Please configure your API key first');
      return;
    }
    
    setOptimizing(true);
    try {
      const response = await axios.post(`${API}/optimize?city=${selectedCity}`);
      setLastRequestId(response.data.request_id);
      toast.success('Optimization submitted! Click "Fetch Result" when ready.');
    } catch (error) {
      console.error('Optimization failed:', error);
      toast.error(error.response?.data?.detail || 'Optimization failed');
    } finally {
      setOptimizing(false);
    }
  };

  const handleFetchResult = async () => {
    if (!lastRequestId) return;
    
    try {
      const response = await axios.get(`${API}/optimize/result/${lastRequestId}`);
      
      if (response.data.status === 'Ok') {
        toast.success('Routes optimized successfully!');
        await fetchCityData(selectedCity);
      } else {
        toast.info('Optimization still processing. Try again in a few seconds.');
      }
    } catch (error) {
      console.error('Failed to fetch result:', error);
      toast.error(error.response?.data?.detail || 'Failed to fetch result');
    }
  };

  const handleRegenerateData = async (type) => {
    setRefreshing(true);
    try {
      if (type === 'technicians') {
        await axios.post(`${API}/technicians/generate?city=${selectedCity}`);
        toast.success('Technicians regenerated');
      } else if (type === 'jobs') {
        await axios.post(`${API}/jobs/generate?city=${selectedCity}`);
        toast.success('Jobs regenerated');
      }
      await fetchCityData(selectedCity);
    } catch (error) {
      console.error('Failed to regenerate:', error);
      toast.error('Failed to regenerate data');
    } finally {
      setRefreshing(false);
    }
  };

  const handleToggleAvailability = async (techId, available) => {
    try {
      await axios.put(`${API}/technicians/${techId}/availability?available=${available}`);
      setTechnicians(prev => prev.map(t => 
        t.id === techId ? { ...t, available } : t
      ));
      toast.success('Availability updated');
    } catch (error) {
      console.error('Failed to update:', error);
      toast.error('Failed to update availability');
    }
  };

  const handleAddJob = async (jobData) => {
    try {
      await axios.post(`${API}/jobs?city=${selectedCity}`, jobData);
      toast.success('Job created successfully');
      await fetchCityData(selectedCity);
    } catch (error) {
      console.error('Failed to create job:', error);
      toast.error('Failed to create job');
    }
  };

  const handleSaveSettings = async (data) => {
    setSavingSettings(true);
    try {
      const params = new URLSearchParams();
      if (data.nextbillion_api_key !== undefined) {
        params.append('nextbillion_api_key', data.nextbillion_api_key);
      }
      
      const response = await axios.put(`${API}/settings?${params.toString()}`);
      setSettings(response.data);
      toast.success('Settings saved');
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSavingSettings(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="loading-spinner mx-auto mb-4" />
          <p className="text-muted-foreground">Loading FieldOps...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container flex">
      <Toaster position="top-right" richColors />
      <BrowserRouter>
        <Sidebar 
          selectedCity={selectedCity}
          cities={cities}
          onCityChange={handleCityChange}
        />
        <main className="main-content">
          <Routes>
            <Route 
              path="/" 
              element={
                <Dashboard 
                  stats={stats}
                  routes={routes}
                  jobs={jobs}
                  cities={cities}
                  selectedCity={selectedCity}
                  apiKey={settings.nextbillion_api_key}
                  onOptimize={handleOptimize}
                  optimizing={optimizing}
                  lastRequestId={lastRequestId}
                  onFetchResult={handleFetchResult}
                />
              } 
            />
            <Route 
              path="/routes" 
              element={
                <RoutesPage 
                  routes={routes}
                  apiKey={settings.nextbillion_api_key}
                  selectedCity={selectedCity}
                  cities={cities}
                />
              } 
            />
            <Route 
              path="/technicians" 
              element={
                <TechniciansPage 
                  technicians={technicians}
                  onRefresh={() => handleRegenerateData('technicians')}
                  refreshing={refreshing}
                  selectedCity={selectedCity}
                  onToggleAvailability={handleToggleAvailability}
                />
              } 
            />
            <Route 
              path="/jobs" 
              element={
                <JobsPage 
                  jobs={jobs}
                  onRefresh={() => handleRegenerateData('jobs')}
                  refreshing={refreshing}
                  selectedCity={selectedCity}
                  onAddJob={handleAddJob}
                />
              } 
            />
            <Route 
              path="/settings" 
              element={
                <SettingsPage 
                  settings={settings}
                  onSave={handleSaveSettings}
                  saving={savingSettings}
                />
              } 
            />
          </Routes>
        </main>
      </BrowserRouter>
    </div>
  );
}

export default App;
