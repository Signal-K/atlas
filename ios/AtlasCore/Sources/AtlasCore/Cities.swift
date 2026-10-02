import Foundation

public struct City: Equatable, Sendable {
    public let name: String
    public let latitude: Double
    public let longitude: Double
    public let timeZone: String
}

/// Port of CITIES in src/lib/cities.ts (keep in step), with each city's IANA time zone.
/// Used for the "no location permission" fallback: the city in the device's own time zone.
public enum Cities {
    public static let all: [City] = [
        City(name: "London", latitude: 51.5074, longitude: -0.1278, timeZone: "Europe/London"),
        City(name: "Amsterdam", latitude: 52.3676, longitude: 4.9041, timeZone: "Europe/Amsterdam"),
        City(name: "Paris", latitude: 48.8566, longitude: 2.3522, timeZone: "Europe/Paris"),
        City(name: "Berlin", latitude: 52.52, longitude: 13.405, timeZone: "Europe/Berlin"),
        City(name: "Madrid", latitude: 40.4168, longitude: -3.7038, timeZone: "Europe/Madrid"),
        City(name: "Rome", latitude: 41.9028, longitude: 12.4964, timeZone: "Europe/Rome"),
        City(name: "Vienna", latitude: 48.2082, longitude: 16.3738, timeZone: "Europe/Vienna"),
        City(name: "Dublin", latitude: 53.3498, longitude: -6.2603, timeZone: "Europe/Dublin"),
        City(name: "Lisbon", latitude: 38.7223, longitude: -9.1393, timeZone: "Europe/Lisbon"),
        City(name: "Brussels", latitude: 50.8503, longitude: 4.3517, timeZone: "Europe/Brussels"),
        City(name: "Zurich", latitude: 47.3769, longitude: 8.5417, timeZone: "Europe/Zurich"),
        City(name: "Stockholm", latitude: 59.3293, longitude: 18.0686, timeZone: "Europe/Stockholm"),
        City(name: "Oslo", latitude: 59.9139, longitude: 10.7522, timeZone: "Europe/Oslo"),
        City(name: "Copenhagen", latitude: 55.6761, longitude: 12.5683, timeZone: "Europe/Copenhagen"),
        City(name: "Helsinki", latitude: 60.1699, longitude: 24.9384, timeZone: "Europe/Helsinki"),
        City(name: "Tallinn", latitude: 59.437, longitude: 24.7536, timeZone: "Europe/Tallinn"),
        City(name: "Riga", latitude: 56.9496, longitude: 24.1052, timeZone: "Europe/Riga"),
        City(name: "Vilnius", latitude: 54.6872, longitude: 25.2797, timeZone: "Europe/Vilnius"),
        City(name: "Warsaw", latitude: 52.2297, longitude: 21.0122, timeZone: "Europe/Warsaw"),
        City(name: "Prague", latitude: 50.0755, longitude: 14.4378, timeZone: "Europe/Prague"),
        City(name: "Budapest", latitude: 47.4979, longitude: 19.0402, timeZone: "Europe/Budapest"),
        City(name: "Athens", latitude: 37.9838, longitude: 23.7275, timeZone: "Europe/Athens"),
        City(name: "Reykjavik", latitude: 64.1466, longitude: -21.9426, timeZone: "Atlantic/Reykjavik"),
        City(name: "Moscow", latitude: 55.7558, longitude: 37.6173, timeZone: "Europe/Moscow"),
        City(name: "Istanbul", latitude: 41.0082, longitude: 28.9784, timeZone: "Europe/Istanbul"),
        City(name: "New York", latitude: 40.7128, longitude: -74.006, timeZone: "America/New_York"),
        City(name: "Los Angeles", latitude: 34.0522, longitude: -118.2437, timeZone: "America/Los_Angeles"),
        City(name: "Chicago", latitude: 41.8781, longitude: -87.6298, timeZone: "America/Chicago"),
        City(name: "Toronto", latitude: 43.6532, longitude: -79.3832, timeZone: "America/Toronto"),
        City(name: "Vancouver", latitude: 49.2827, longitude: -123.1207, timeZone: "America/Vancouver"),
        City(name: "Mexico City", latitude: 19.4326, longitude: -99.1332, timeZone: "America/Mexico_City"),
        City(name: "Rio de Janeiro", latitude: -22.9068, longitude: -43.1729, timeZone: "America/Sao_Paulo"),
        City(name: "Buenos Aires", latitude: -34.6037, longitude: -58.3816, timeZone: "America/Argentina/Buenos_Aires"),
        City(name: "Santiago", latitude: -33.4489, longitude: -70.6693, timeZone: "America/Santiago"),
        City(name: "Bogotá", latitude: 4.711, longitude: -74.0721, timeZone: "America/Bogota"),
        City(name: "Lima", latitude: -12.0464, longitude: -77.0428, timeZone: "America/Lima"),
        City(name: "Miami", latitude: 25.7617, longitude: -80.1918, timeZone: "America/New_York"),
        City(name: "San Francisco", latitude: 37.7749, longitude: -122.4194, timeZone: "America/Los_Angeles"),
        City(name: "Seattle", latitude: 47.6062, longitude: -122.3321, timeZone: "America/Los_Angeles"),
        City(name: "Boston", latitude: 42.3601, longitude: -71.0589, timeZone: "America/New_York"),
        City(name: "Denver", latitude: 39.7392, longitude: -104.9903, timeZone: "America/Denver"),
        City(name: "Houston", latitude: 29.7604, longitude: -95.3698, timeZone: "America/Chicago"),
        City(name: "Cairo", latitude: 30.0444, longitude: 31.2357, timeZone: "Africa/Cairo"),
        City(name: "Nairobi", latitude: -1.2921, longitude: 36.8219, timeZone: "Africa/Nairobi"),
        City(name: "Cape Town", latitude: -33.9249, longitude: 18.4241, timeZone: "Africa/Johannesburg"),
        City(name: "Lagos", latitude: 6.5244, longitude: 3.3792, timeZone: "Africa/Lagos"),
        City(name: "Johannesburg", latitude: -26.2041, longitude: 28.0473, timeZone: "Africa/Johannesburg"),
        City(name: "Casablanca", latitude: 33.5731, longitude: -7.5898, timeZone: "Africa/Casablanca"),
        City(name: "Addis Ababa", latitude: 9.03, longitude: 38.74, timeZone: "Africa/Addis_Ababa"),
        City(name: "Dubai", latitude: 25.2048, longitude: 55.2708, timeZone: "Asia/Dubai"),
        City(name: "Tel Aviv", latitude: 32.0853, longitude: 34.7818, timeZone: "Asia/Jerusalem"),
        City(name: "Riyadh", latitude: 24.7136, longitude: 46.6753, timeZone: "Asia/Riyadh"),
        City(name: "Tehran", latitude: 35.6892, longitude: 51.389, timeZone: "Asia/Tehran"),
        City(name: "Mumbai", latitude: 19.076, longitude: 72.8777, timeZone: "Asia/Kolkata"),
        City(name: "Delhi", latitude: 28.7041, longitude: 77.1025, timeZone: "Asia/Kolkata"),
        City(name: "Beijing", latitude: 39.9042, longitude: 116.4074, timeZone: "Asia/Shanghai"),
        City(name: "Shanghai", latitude: 31.2304, longitude: 121.4737, timeZone: "Asia/Shanghai"),
        City(name: "Tokyo", latitude: 35.6762, longitude: 139.6503, timeZone: "Asia/Tokyo"),
        City(name: "Seoul", latitude: 37.5665, longitude: 126.978, timeZone: "Asia/Seoul"),
        City(name: "Singapore", latitude: 1.3521, longitude: 103.8198, timeZone: "Asia/Singapore"),
        City(name: "Bangkok", latitude: 13.7563, longitude: 100.5018, timeZone: "Asia/Bangkok"),
        City(name: "Jakarta", latitude: -6.2088, longitude: 106.8456, timeZone: "Asia/Jakarta"),
        City(name: "Manila", latitude: 14.5995, longitude: 120.9842, timeZone: "Asia/Manila"),
        City(name: "Hong Kong", latitude: 22.3193, longitude: 114.1694, timeZone: "Asia/Hong_Kong"),
        City(name: "Karachi", latitude: 24.8607, longitude: 67.0011, timeZone: "Asia/Karachi"),
        City(name: "Dhaka", latitude: 23.8103, longitude: 90.4125, timeZone: "Asia/Dhaka"),
        City(name: "Kuala Lumpur", latitude: 3.139, longitude: 101.6869, timeZone: "Asia/Kuala_Lumpur"),
        City(name: "Melbourne", latitude: -37.8136, longitude: 144.9631, timeZone: "Australia/Melbourne"),
        City(name: "Sydney", latitude: -33.8688, longitude: 151.2093, timeZone: "Australia/Sydney"),
        City(name: "Auckland", latitude: -36.8485, longitude: 174.7633, timeZone: "Pacific/Auckland"),
        City(name: "Brisbane", latitude: -27.4698, longitude: 153.0251, timeZone: "Australia/Brisbane"),
        City(name: "Perth", latitude: -31.9505, longitude: 115.8605, timeZone: "Australia/Perth"),
        City(name: "Wellington", latitude: -41.2865, longitude: 174.7762, timeZone: "Pacific/Auckland"),
    ]

    /// The listed city that best matches a time zone: same zone id, else the nearest UTC offset.
    public static func fallback(for zone: TimeZone, at date: Date = Date()) -> City {
        if let exact = all.first(where: { $0.timeZone == zone.identifier }) { return exact }
        let offset = zone.secondsFromGMT(for: date)
        return all.min { abs(offsetOf($0, date) - offset) < abs(offsetOf($1, date) - offset) }!
    }

    private static func offsetOf(_ city: City, _ date: Date) -> Int {
        TimeZone(identifier: city.timeZone)?.secondsFromGMT(for: date) ?? 0
    }
}
