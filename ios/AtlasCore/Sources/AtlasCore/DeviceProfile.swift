import Foundation

/// What the camera on this phone can do, from the hardware identifier (`iPhone16,1`). Real exposure
/// and ISO limits are read from the capture device at runtime; this supplies the name and the
/// capabilities (lenses, Night mode) the advice depends on.
public struct DeviceProfile: Equatable, Sendable {
    public let identifier: String
    public let name: String
    public let isPro: Bool
    public let hasNightMode: Bool
    public let hasUltraWide: Bool
    public let hasTelephoto: Bool

    /// Short sentence for Settings: "iPhone 15 Pro: ultra wide, telephoto, Night mode."
    public var summary: String {
        var parts: [String] = []
        if hasUltraWide { parts.append("ultra wide") }
        if hasTelephoto { parts.append("telephoto") }
        if hasNightMode { parts.append("Night mode") }
        return parts.isEmpty ? name : "\(name): " + parts.joined(separator: ", ")
    }
}

public enum DeviceCatalog {
    private struct Row { let name: String; let pro: Bool; let tele: Bool; let ultra: Bool; let night: Bool }

    private static func row(_ name: String, pro: Bool = false, tele: Bool = false, ultra: Bool = true, night: Bool = true) -> Row {
        Row(name: name, pro: pro, tele: tele, ultra: ultra, night: night)
    }

    private static let table: [String: Row] = [
        "iPhone11,8": row("iPhone XR", ultra: false, night: false),
        "iPhone11,2": row("iPhone XS", tele: true, ultra: false, night: false),
        "iPhone11,4": row("iPhone XS Max", tele: true, ultra: false, night: false),
        "iPhone11,6": row("iPhone XS Max", tele: true, ultra: false, night: false),
        "iPhone12,1": row("iPhone 11"),
        "iPhone12,3": row("iPhone 11 Pro", pro: true, tele: true),
        "iPhone12,5": row("iPhone 11 Pro Max", pro: true, tele: true),
        "iPhone12,8": row("iPhone SE (2nd generation)", ultra: false, night: false),
        "iPhone13,1": row("iPhone 12 mini"),
        "iPhone13,2": row("iPhone 12"),
        "iPhone13,3": row("iPhone 12 Pro", pro: true, tele: true),
        "iPhone13,4": row("iPhone 12 Pro Max", pro: true, tele: true),
        "iPhone14,4": row("iPhone 13 mini"),
        "iPhone14,5": row("iPhone 13"),
        "iPhone14,2": row("iPhone 13 Pro", pro: true, tele: true),
        "iPhone14,3": row("iPhone 13 Pro Max", pro: true, tele: true),
        "iPhone14,6": row("iPhone SE (3rd generation)", ultra: false, night: false),
        "iPhone14,7": row("iPhone 14"),
        "iPhone14,8": row("iPhone 14 Plus"),
        "iPhone15,2": row("iPhone 14 Pro", pro: true, tele: true),
        "iPhone15,3": row("iPhone 14 Pro Max", pro: true, tele: true),
        "iPhone15,4": row("iPhone 15"),
        "iPhone15,5": row("iPhone 15 Plus"),
        "iPhone16,1": row("iPhone 15 Pro", pro: true, tele: true),
        "iPhone16,2": row("iPhone 15 Pro Max", pro: true, tele: true),
        "iPhone17,3": row("iPhone 16"),
        "iPhone17,4": row("iPhone 16 Plus"),
        "iPhone17,5": row("iPhone 16e", ultra: false),
        "iPhone17,1": row("iPhone 16 Pro", pro: true, tele: true),
        "iPhone17,2": row("iPhone 16 Pro Max", pro: true, tele: true),
        "iPhone18,3": row("iPhone 17"),
        "iPhone18,1": row("iPhone 17 Pro", pro: true, tele: true),
        "iPhone18,2": row("iPhone 17 Pro Max", pro: true, tele: true),
        "iPhone18,4": row("iPhone Air", ultra: false),
    ]

    /// `identifier` is `hw.machine`, or `SIMULATOR_MODEL_IDENTIFIER` in the Simulator. Unknown
    /// identifiers from newer phones get conservative generation-based capabilities.
    public static func profile(identifier: String) -> DeviceProfile {
        if let r = table[identifier] {
            return DeviceProfile(identifier: identifier, name: r.name, isPro: r.pro, hasNightMode: r.night, hasUltraWide: r.ultra, hasTelephoto: r.tele)
        }
        let generation = identifier.hasPrefix("iPhone") ? Int(identifier.dropFirst(6).prefix { $0 != "," }) : nil
        guard let generation else {
            return DeviceProfile(identifier: identifier, name: identifier.hasPrefix("iPad") ? "iPad" : "Your device", isPro: false, hasNightMode: false, hasUltraWide: false, hasTelephoto: false)
        }
        // Anything from the iPhone 11 generation (iPhone12,x) on has Night mode and an ultra wide lens.
        let modern = generation >= 12
        return DeviceProfile(identifier: identifier, name: "iPhone", isPro: false, hasNightMode: modern, hasUltraWide: modern, hasTelephoto: false)
    }

    #if canImport(Darwin)
    /// The identifier of the device this is running on.
    public static func currentIdentifier() -> String {
        if let sim = ProcessInfo.processInfo.environment["SIMULATOR_MODEL_IDENTIFIER"] { return sim }
        var size = 0
        sysctlbyname("hw.machine", nil, &size, nil, 0)
        guard size > 0 else { return "unknown" }
        var buffer = [CChar](repeating: 0, count: size)
        sysctlbyname("hw.machine", &buffer, &size, nil, 0)
        return String(cString: buffer)
    }

    public static func current() -> DeviceProfile { profile(identifier: currentIdentifier()) }
    #endif
}
