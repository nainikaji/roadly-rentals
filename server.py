"""Roadly rental demo backend — run with: python server.py"""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen
import json
import math
import sqlite3
import hashlib
import secrets
import os

ROOT = Path(__file__).resolve().parent
DB_PATH = ROOT / "roadly.db"
CARS = [
    {"id": 1, "name": "Maruti Suzuki Swift", "type": "Hatchback", "seats": 5, "gear": "Manual", "per_km": 12},
    {"id": 2, "name": "Hyundai Creta", "type": "SUV", "seats": 5, "gear": "Automatic", "per_km": 20},
    {"id": 3, "name": "Honda City", "type": "Sedan", "seats": 5, "gear": "Automatic", "per_km": 17},
    {"id": 4, "name": "Tata Nexon", "type": "SUV", "seats": 5, "gear": "Manual", "per_km": 18},
    {"id": 5, "name": "Maruti Baleno", "type": "Hatchback", "seats": 5, "gear": "Automatic", "per_km": 14},
    {"id": 6, "name": "Hyundai Verna", "type": "Sedan", "seats": 5, "gear": "Manual", "per_km": 16},
]
SESSIONS = {}
def password_hash(password): return hashlib.sha256(password.encode()).hexdigest()

def database():
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("""CREATE TABLE IF NOT EXISTS bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT, customer TEXT NOT NULL, phone TEXT NOT NULL,
        email TEXT NOT NULL, car TEXT NOT NULL, rental_dates TEXT NOT NULL,
        amount INTEGER NOT NULL, payment_method TEXT DEFAULT 'Not selected',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP)""")
    booking_columns = {row[1] for row in connection.execute("PRAGMA table_info(bookings)")}
    if "payment_method" not in booking_columns:
        connection.execute("ALTER TABLE bookings ADD COLUMN payment_method TEXT DEFAULT 'Not selected'")
    connection.execute("""CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL)""")
    connection.execute("INSERT OR IGNORE INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)", ("Roadly Owner", "owner@roadly.com", password_hash("owner123"), "owner"))
    connection.commit()
    return connection

def geocode(place):
    search_place = place if "india" in place.lower() else f"{place}, India"
    query = urlencode({"q": search_place, "format": "jsonv2", "limit": 1})
    request = Request(f"https://nominatim.openstreetmap.org/search?{query}", headers={"User-Agent": "Roadly-Rental-Demo/1.0"})
    with urlopen(request, timeout=8) as response:
        result = json.load(response)
    if not result:
        raise ValueError(f"We could not locate '{place}'. Include the city and state, for example 'Nagpur, Maharashtra'.")
    return float(result[0]["lon"]), float(result[0]["lat"])

def estimated_distance(start, destination):
    start_lon, start_lat = geocode(start)
    end_lon, end_lat = geocode(destination)
    route_url = f"https://router.project-osrm.org/route/v1/driving/{start_lon},{start_lat};{end_lon},{end_lat}?overview=false"
    try:
        with urlopen(route_url, timeout=8) as response:
            route = json.load(response)
        return round(route["routes"][0]["distance"] / 1000, 1), "road route"
    except Exception:
        lat1, lat2 = math.radians(start_lat), math.radians(end_lat)
        d_lat, d_lon = lat2 - lat1, math.radians(end_lon - start_lon)
        straight_line = 2 * 6371 * math.asin(math.sqrt(math.sin(d_lat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(d_lon / 2) ** 2))
        return round(straight_line * 1.25, 1), "approximate route"

class RoadlyHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs): super().__init__(*args, directory=str(ROOT), **kwargs)
    def send_json(self, body, status=200):
        payload = json.dumps(body).encode(); self.send_response(status); self.send_header("Content-Type", "application/json"); self.send_header("Content-Length", str(len(payload))); self.end_headers(); self.wfile.write(payload)
    def read_json(self): return json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))) or b"{}")
    def current_user(self): return SESSIONS.get(self.headers.get("Authorization", "").replace("Bearer ", ""))
    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/api/cars": return self.send_json(CARS)
        if path == "/api/auth/me": return self.send_json({"user": self.current_user()})
        if path == "/api/bookings":
            if not (self.current_user() and self.current_user()["role"] == "owner"): return self.send_json({"error": "Owner login required."}, 403)
            with database() as conn: return self.send_json([dict(row) for row in conn.execute("SELECT * FROM bookings ORDER BY id DESC")])
        return super().do_GET()
    def do_POST(self):
        path = urlparse(self.path).path
        try:
            data = self.read_json()
            if path == "/api/auth/register":
                if not data.get("name") or not data.get("email") or len(data.get("password", "")) < 6: return self.send_json({"error": "Enter name, email, and a password of at least 6 characters."}, 400)
                with database() as conn:
                    try: conn.execute("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'customer')", (data["name"], data["email"].lower(), password_hash(data["password"]))); conn.commit()
                    except sqlite3.IntegrityError: return self.send_json({"error": "An account already exists with this email."}, 400)
                return self.send_json({"message": "Account created. Please log in."}, 201)
            if path == "/api/auth/login":
                with database() as conn: user = conn.execute("SELECT id, name, email, role FROM users WHERE email = ? AND password_hash = ?", (data.get("email", "").lower(), password_hash(data.get("password", "")))).fetchone()
                if not user or user["role"] != data.get("role"): return self.send_json({"error": "Incorrect account type, email, or password."}, 401)
                token = secrets.token_urlsafe(24); SESSIONS[token] = dict(user); return self.send_json({"token": token, "user": dict(user)})
            if path == "/api/estimate":
                if not data.get("pickup") or not data.get("destination"): return self.send_json({"error": "Enter both pick-up location and destination."}, 400)
                distance, source = estimated_distance(data["pickup"], data["destination"]); return self.send_json({"distance_km": distance, "source": source})
            if path == "/api/bookings":
                if not (self.current_user() and self.current_user()["role"] == "customer"): return self.send_json({"error": "Customer login required before booking."}, 403)
                required = ("customer", "phone", "email", "car", "rental_dates", "amount", "payment_method")
                if any(not data.get(field) for field in required): return self.send_json({"error": "Please complete every booking field."}, 400)
                with database() as conn:
                    cursor = conn.execute("INSERT INTO bookings (customer, phone, email, car, rental_dates, amount, payment_method) VALUES (?, ?, ?, ?, ?, ?, ?)", tuple(data[field] for field in required)); conn.commit()
                return self.send_json({"id": cursor.lastrowid, "message": "Booking confirmed"}, 201)
            return self.send_json({"error": "Not found"}, 404)
        except (json.JSONDecodeError, ValueError, KeyError, TypeError) as error: return self.send_json({"error": str(error) or "Could not estimate this route."}, 400)
        except Exception: return self.send_json({"error": "Route service is unavailable. Please try again shortly."}, 503)
    def do_DELETE(self):
        if urlparse(self.path).path != "/api/bookings": return self.send_json({"error": "Not found"}, 404)
        if not (self.current_user() and self.current_user()["role"] == "owner"): return self.send_json({"error": "Owner login required."}, 403)
        with database() as conn: conn.execute("DELETE FROM bookings"); conn.commit()
        return self.send_json({"message": "Bookings cleared"})
if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8000"))
    database().close(); print(f"Roadly is running on port {port}"); ThreadingHTTPServer(("0.0.0.0", port), RoadlyHandler).serve_forever()
