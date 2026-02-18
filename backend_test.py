#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime

class FieldServiceAPITester:
    def __init__(self, base_url="https://service-dispatch-hub-2.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def run_test(self, name, method, endpoint, expected_status=200, data=None, params=None):
        """Run a single API test"""
        url = f"{self.api_url}{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {method} {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, params=params, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, params=params, timeout=10)

            success = response.status_code == expected_status
            result = {
                "test": name,
                "method": method,
                "endpoint": endpoint,
                "expected_status": expected_status,
                "actual_status": response.status_code,
                "success": success,
                "response_size": len(response.text) if response.text else 0
            }
            
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                if response.status_code == 200 and response.text:
                    try:
                        json_data = response.json()
                        if isinstance(json_data, list):
                            print(f"   Response: Array with {len(json_data)} items")
                            result["response_items"] = len(json_data)
                        elif isinstance(json_data, dict):
                            print(f"   Response: Object with keys: {list(json_data.keys())[:5]}")
                            result["response_keys"] = list(json_data.keys())
                        else:
                            print(f"   Response: {type(json_data)}")
                    except:
                        print(f"   Response: {response.text[:100]}...")
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Error: {response.text[:200]}")
                result["error"] = response.text[:200]

            self.test_results.append(result)
            return success, response.json() if success and response.text else {}

        except requests.RequestException as e:
            print(f"❌ Failed - Request Error: {str(e)}")
            result = {
                "test": name,
                "method": method,
                "endpoint": endpoint,
                "expected_status": expected_status,
                "actual_status": "ERROR",
                "success": False,
                "error": str(e)
            }
            self.test_results.append(result)
            return False, {}

    def test_basic_endpoints(self):
        """Test basic read-only endpoints"""
        print("=" * 50)
        print("TESTING BASIC ENDPOINTS")
        print("=" * 50)
        
        # Test cities endpoint
        success, cities = self.run_test("Get Cities", "GET", "/cities")
        
        # Test settings endpoint
        success, settings = self.run_test("Get Settings", "GET", "/settings")
        
        # Test skills endpoint  
        success, skills = self.run_test("Get Skills", "GET", "/skills")
        
        return cities, settings

    def test_data_endpoints(self, city="chicago"):
        """Test data endpoints for a specific city"""
        print("=" * 50)
        print(f"TESTING DATA ENDPOINTS FOR {city.upper()}")
        print("=" * 50)
        
        # Test stats
        self.run_test("Get Stats", "GET", "/stats", params={"city": city})
        
        # Test technicians
        success, technicians = self.run_test("Get Technicians", "GET", "/technicians", params={"city": city})
        
        # Test jobs
        success, jobs = self.run_test("Get Jobs", "GET", "/jobs", params={"city": city})
        
        # Test routes
        success, routes = self.run_test("Get Routes", "GET", "/routes", params={"city": city})
        
        return technicians, jobs, routes

    def test_data_generation(self, city="chicago"):
        """Test demo data generation endpoints"""
        print("=" * 50)
        print("TESTING DATA GENERATION")
        print("=" * 50)
        
        # Generate technicians
        success, tech_result = self.run_test(
            "Generate Technicians", 
            "POST", 
            "/technicians/generate",
            expected_status=200,
            params={"city": city}
        )
        
        # Generate jobs
        success, jobs_result = self.run_test(
            "Generate Jobs", 
            "POST", 
            "/jobs/generate",
            expected_status=200,
            params={"city": city, "count": 20}
        )
        
        return tech_result, jobs_result

    def test_crud_operations(self, city="chicago"):
        """Test CRUD operations"""
        print("=" * 50)
        print("TESTING CRUD OPERATIONS")
        print("=" * 50)
        
        # Test settings update
        self.run_test(
            "Update Settings", 
            "PUT", 
            "/settings",
            expected_status=200,
            params={"nextbillion_api_key": "test_key_12345"}
        )
        
        # Test create job
        job_data = {
            "customer_name": "Test Customer",
            "address": "123 Test St, Chicago, IL",
            "latitude": 41.8781,
            "longitude": -87.6298,
            "service_type": "Plumbing",
            "service_duration": 3600,
            "skill_required": 1,
            "time_window_start": int(datetime.now().timestamp()) + 3600,
            "time_window_end": int(datetime.now().timestamp()) + 7200,
            "priority": 1,
            "notes": "Test job creation"
        }
        
        success, job_result = self.run_test(
            "Create Job", 
            "POST", 
            "/jobs",
            expected_status=200,
            data=job_data,
            params={"city": city}
        )
        
        # Test technician availability toggle (if technicians exist)
        # First get technicians to find one to test with
        _, technicians = self.run_test("Get Technicians for Toggle", "GET", "/technicians", params={"city": city})
        
        if technicians and len(technicians) > 0:
            tech_id = technicians[0]["id"]
            current_status = technicians[0]["available"]
            new_status = not current_status
            
            self.run_test(
                "Toggle Technician Availability", 
                "PUT", 
                f"/technicians/{tech_id}/availability",
                expected_status=200,
                params={"available": new_status}
            )

    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 50)
        print("TEST SUMMARY")
        print("=" * 50)
        print(f"Tests Run: {self.tests_run}")
        print(f"Tests Passed: {self.tests_passed}")
        print(f"Tests Failed: {self.tests_run - self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        if self.tests_passed != self.tests_run:
            print("\nFAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"❌ {result['test']} - {result.get('error', 'Unknown error')}")

    def run_all_tests(self):
        """Run complete test suite"""
        print("🚀 Starting Field Service API Tests...")
        print(f"Testing against: {self.base_url}")
        
        # Test basic endpoints
        cities, settings = self.test_basic_endpoints()
        
        # Test data endpoints
        technicians, jobs, routes = self.test_data_endpoints()
        
        # Test data generation
        self.test_data_generation()
        
        # Test CRUD operations
        self.test_crud_operations()
        
        # Print summary
        self.print_summary()
        
        return self.tests_passed == self.tests_run

def main():
    tester = FieldServiceAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())