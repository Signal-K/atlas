import Foundation
#if canImport(ImageIO)
import ImageIO
#endif

public enum PhotoEXIFOffsetSource: String, Codable, Sendable {
    case exifOffset = "exif-offset"
    case gpsUtc = "gps-utc"
    case longitudeEstimate = "longitude-estimate"
    case unknown
}

public struct PhotoEXIFMetadata: Equatable, Sendable {
    public var dateTaken: Date?
    public var timeZoneKnown: Bool
    public var latitude: Double?
    public var longitude: Double?
    public var headingDeg: Double?
    public var gpsUTC: Date?
    public var offsetMinutes: Int?
    public var offsetSource: PhotoEXIFOffsetSource
    public var cameraMake: String?
    public var cameraModel: String?

    public init(
        dateTaken: Date? = nil,
        timeZoneKnown: Bool = false,
        latitude: Double? = nil,
        longitude: Double? = nil,
        headingDeg: Double? = nil,
        gpsUTC: Date? = nil,
        offsetMinutes: Int? = nil,
        offsetSource: PhotoEXIFOffsetSource = .unknown,
        cameraMake: String? = nil,
        cameraModel: String? = nil
    ) {
        self.dateTaken = dateTaken
        self.timeZoneKnown = timeZoneKnown
        self.latitude = latitude
        self.longitude = longitude
        self.headingDeg = headingDeg
        self.gpsUTC = gpsUTC
        self.offsetMinutes = offsetMinutes
        self.offsetSource = offsetSource
        self.cameraMake = cameraMake
        self.cameraModel = cameraModel
    }

    public var cameraLabel: String? {
        let parts = [cameraMake, cameraModel]
            .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
        guard !parts.isEmpty else { return nil }
        return parts.joined(separator: " ")
    }
}

public struct PhotoEXIFRaw: Equatable, Sendable {
    public var dateTimeOriginal: String?
    public var offsetTimeOriginal: String?
    public var gpsDateStamp: String?
    public var gpsTimeStamp: String?
    public var latitude: Double?
    public var longitude: Double?
    public var headingDeg: Double?
    public var cameraMake: String?
    public var cameraModel: String?

    public init(
        dateTimeOriginal: String? = nil,
        offsetTimeOriginal: String? = nil,
        gpsDateStamp: String? = nil,
        gpsTimeStamp: String? = nil,
        latitude: Double? = nil,
        longitude: Double? = nil,
        headingDeg: Double? = nil,
        cameraMake: String? = nil,
        cameraModel: String? = nil
    ) {
        self.dateTimeOriginal = dateTimeOriginal
        self.offsetTimeOriginal = offsetTimeOriginal
        self.gpsDateStamp = gpsDateStamp
        self.gpsTimeStamp = gpsTimeStamp
        self.latitude = latitude
        self.longitude = longitude
        self.headingDeg = headingDeg
        self.cameraMake = cameraMake
        self.cameraModel = cameraModel
    }
}

public enum PhotoEXIFParser {
    public static func parse(raw: PhotoEXIFRaw) -> PhotoEXIFMetadata {
        let parsed = parseExifDateTime(raw.dateTimeOriginal)
        let naiveUTC = parsed.flatMap(naiveUTCDate)
        let gpsUTC = parseGPSUTC(dateStamp: raw.gpsDateStamp, timeStamp: raw.gpsTimeStamp)
        let explicitOffset = parseOffsetMinutes(raw.offsetTimeOriginal)
        let offset = deriveOffsetMinutes(explicitOffsetMinutes: explicitOffset, naiveUTC: naiveUTC, gpsUTC: gpsUTC, longitude: raw.longitude)
        let taken = naiveUTC.map { date in
            guard let offset else { return date }
            return date.addingTimeInterval(TimeInterval(-offset * 60))
        }

        return PhotoEXIFMetadata(
            dateTaken: taken,
            timeZoneKnown: offset.source == .exifOffset,
            latitude: raw.latitude,
            longitude: raw.longitude,
            headingDeg: raw.headingDeg,
            gpsUTC: gpsUTC,
            offsetMinutes: offset.value,
            offsetSource: offset.source,
            cameraMake: raw.cameraMake,
            cameraModel: raw.cameraModel
        )
    }

    public static func parse(rawDictionary: [String: String]) -> PhotoEXIFMetadata {
        parse(raw: PhotoEXIFRaw(
            dateTimeOriginal: rawDictionary["DateTimeOriginal"],
            offsetTimeOriginal: rawDictionary["OffsetTimeOriginal"],
            gpsDateStamp: rawDictionary["GPSDateStamp"],
            gpsTimeStamp: rawDictionary["GPSTimeStamp"],
            latitude: rawDictionary["Latitude"].flatMap(Double.init),
            longitude: rawDictionary["Longitude"].flatMap(Double.init),
            headingDeg: rawDictionary["GPSImgDirection"].flatMap(Double.init),
            cameraMake: rawDictionary["Make"],
            cameraModel: rawDictionary["Model"]
        ))
    }

    #if canImport(ImageIO)
    public static func extract(from imageData: Data) -> PhotoEXIFMetadata {
        guard let source = CGImageSourceCreateWithData(imageData as CFData, nil),
              let props = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any]
        else {
            return PhotoEXIFMetadata()
        }

        let exif = props[kCGImagePropertyExifDictionary] as? [CFString: Any]
        let gps = props[kCGImagePropertyGPSDictionary] as? [CFString: Any]
        let tiff = props[kCGImagePropertyTIFFDictionary] as? [CFString: Any]

        let raw = PhotoEXIFRaw(
            dateTimeOriginal: exif?[kCGImagePropertyExifDateTimeOriginal] as? String,
            offsetTimeOriginal: exif?[kCGImagePropertyExifOffsetTimeOriginal] as? String,
            gpsDateStamp: gps?[kCGImagePropertyGPSDateStamp] as? String,
            gpsTimeStamp: normalizedGPSTime(gps?[kCGImagePropertyGPSTimeStamp]),
            latitude: signedLatitude(from: gps),
            longitude: signedLongitude(from: gps),
            headingDeg: gps?[kCGImagePropertyGPSImgDirection] as? Double,
            cameraMake: tiff?[kCGImagePropertyTIFFMake] as? String,
            cameraModel: tiff?[kCGImagePropertyTIFFModel] as? String
        )
        return parse(raw: raw)
    }
    #endif
}

private struct DateParts {
    let year: Int
    let month: Int
    let day: Int
    let hour: Int
    let minute: Int
    let second: Int
}

private struct DerivedOffset {
    let value: Int?
    let source: PhotoEXIFOffsetSource
}

private func parseExifDateTime(_ value: String?) -> DateParts? {
    guard let value else { return nil }
    let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else { return nil }

    let separators = CharacterSet(charactersIn: ":T- ")
    let parts = trimmed.components(separatedBy: separators).filter { !$0.isEmpty }
    guard parts.count >= 6,
          let year = Int(parts[0]),
          let month = Int(parts[1]),
          let day = Int(parts[2]),
          let hour = Int(parts[3]),
          let minute = Int(parts[4]),
          let second = Int(parts[5])
    else { return nil }

    return DateParts(year: year, month: month, day: day, hour: hour, minute: minute, second: second)
}

private func naiveUTCDate(_ parts: DateParts) -> Date? {
    var calendar = Calendar(identifier: .gregorian)
    let utc = TimeZone(secondsFromGMT: 0) ?? TimeZone.current
    calendar.timeZone = utc
    return calendar.date(from: DateComponents(
        calendar: calendar,
        timeZone: calendar.timeZone,
        year: parts.year,
        month: parts.month,
        day: parts.day,
        hour: parts.hour,
        minute: parts.minute,
        second: parts.second
    ))
}

private func parseOffsetMinutes(_ value: String?) -> Int? {
    guard let value else { return nil }
    let cleaned = value.trimmingCharacters(in: .whitespacesAndNewlines)
    guard cleaned.count >= 6 else { return nil }
    let signChar = cleaned.first
    let sign: Int
    switch signChar {
    case "+":
        sign = 1
    case "-":
        sign = -1
    default:
        return nil
    }
    let body = String(cleaned.dropFirst())
    let pieces = body.split(separator: ":")
    guard pieces.count == 2,
          let hours = Int(pieces[0]),
          let minutes = Int(pieces[1]),
          hours <= 14,
          minutes <= 59
    else { return nil }
    return sign * (hours * 60 + minutes)
}

private func parseGPSUTC(dateStamp: String?, timeStamp: String?) -> Date? {
    guard let dateStamp, let timeStamp else { return nil }
    let dateParts = dateStamp.components(separatedBy: CharacterSet(charactersIn: ":-")).filter { !$0.isEmpty }
    let timeParts = timeStamp.components(separatedBy: CharacterSet(charactersIn: ":")).filter { !$0.isEmpty }
    guard dateParts.count >= 3,
          timeParts.count >= 3,
          let year = Int(dateParts[0]),
          let month = Int(dateParts[1]),
          let day = Int(dateParts[2]),
          let hour = Double(timeParts[0]),
          let minute = Double(timeParts[1]),
          let second = Double(timeParts[2])
    else { return nil }

    var calendar = Calendar(identifier: .gregorian)
    let utc = TimeZone(secondsFromGMT: 0) ?? TimeZone.current
    calendar.timeZone = utc
    return calendar.date(from: DateComponents(
        calendar: calendar,
        timeZone: calendar.timeZone,
        year: year,
        month: month,
        day: day,
        hour: Int(hour),
        minute: Int(minute),
        second: Int(second.rounded())
    ))
}

private func deriveOffsetMinutes(
    explicitOffsetMinutes: Int?,
    naiveUTC: Date?,
    gpsUTC: Date?,
    longitude: Double?
) -> DerivedOffset {
    if let explicitOffsetMinutes {
        return DerivedOffset(value: explicitOffsetMinutes, source: .exifOffset)
    }
    if let naiveUTC, let gpsUTC {
        let minutes = Int(((naiveUTC.timeIntervalSince1970 - gpsUTC.timeIntervalSince1970) / 60.0).rounded())
        return DerivedOffset(value: minutes, source: .gpsUtc)
    }
    if let longitude {
        // Quarter-hour steps handle half/quarter-hour zones better than plain 1-hour rounding.
        let minutes = Int((longitude / 15.0 * 60.0 / 15.0).rounded() * 15.0)
        return DerivedOffset(value: minutes, source: .longitudeEstimate)
    }
    return DerivedOffset(value: nil, source: .unknown)
}

#if canImport(ImageIO)
private func signedLatitude(from gps: [CFString: Any]?) -> Double? {
    guard let value = gps?[kCGImagePropertyGPSLatitude] as? Double else { return nil }
    let ref = (gps?[kCGImagePropertyGPSLatitudeRef] as? String)?.uppercased()
    return ref == "S" ? -value : value
}

private func signedLongitude(from gps: [CFString: Any]?) -> Double? {
    guard let value = gps?[kCGImagePropertyGPSLongitude] as? Double else { return nil }
    let ref = (gps?[kCGImagePropertyGPSLongitudeRef] as? String)?.uppercased()
    return ref == "W" ? -value : value
}

private func normalizedGPSTime(_ value: Any?) -> String? {
    guard let value else { return nil }
    if let text = value as? String { return text }
    if let array = value as? [NSNumber], array.count >= 3 {
        return "\(array[0]):\(array[1]):\(array[2])"
    }
    if let array = value as? [Double], array.count >= 3 {
        return "\(array[0]):\(array[1]):\(array[2])"
    }
    return nil
}
#endif
