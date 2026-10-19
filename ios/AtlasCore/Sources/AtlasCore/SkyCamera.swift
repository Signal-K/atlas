import Foundation

/// Where the device is pointing, from CoreMotion's `xTrueNorthZVertical` attitude, and how to put
/// sky positions on its screen. Kept free of CoreMotion so it can be unit-tested.
///
/// World axes are x = north, y = west, z = up. `rotation` is CoreMotion's `CMRotationMatrix`
/// (reference frame -> device frame), row-major: m11 m12 m13 m21 m22 m23 m31 m32 m33.
/// Device axes: x right, y up the screen, z out of the screen toward the viewer, so the back camera
/// looks along -z.
public struct SkyCamera: Equatable, Sendable {
    public var rotation: [Double]

    public init(rotation: [Double]) {
        precondition(rotation.count == 9, "a rotation matrix has nine elements")
        self.rotation = rotation
    }

    /// Where the back camera is pointing right now.
    public var lookDirection: HorizontalPosition {
        let v = (-rotation[6], -rotation[7], -rotation[8])
        return Self.position(world: v)
    }

    /// A point on screen for a sky position, or nil if it is behind the viewer or outside the view.
    /// `fovDeg` is the horizontal field of view across `width`; projection is gnomonic (straight lines
    /// stay straight), which is right for the 40-90 degree views used here.
    public func project(_ p: HorizontalPosition, fovDeg: Double, width: Double, height: Double) -> (x: Double, y: Double)? {
        let alt = p.altitudeDeg * .pi / 180, az = p.azimuthDeg * .pi / 180
        let v = (cos(alt) * cos(az), -cos(alt) * sin(az), sin(alt))
        let d = (
            rotation[0] * v.0 + rotation[1] * v.1 + rotation[2] * v.2,
            rotation[3] * v.0 + rotation[4] * v.1 + rotation[5] * v.2,
            rotation[6] * v.0 + rotation[7] * v.1 + rotation[8] * v.2)
        guard d.2 < -0.05 else { return nil }
        let focal = (width / 2) / tan(fovDeg * .pi / 360)
        let x = width / 2 + d.0 / -d.2 * focal
        let y = height / 2 - d.1 / -d.2 * focal
        guard x > -40, x < width + 40, y > -40, y < height + 40 else { return nil }
        return (x, y)
    }

    static func position(world v: (Double, Double, Double)) -> HorizontalPosition {
        let alt = asin(max(-1, min(1, v.2))) * 180 / .pi
        // Azimuth runs clockwise from north; east is -y in the (north, west, up) frame.
        var az = atan2(-v.1, v.0) * 180 / .pi
        if az < 0 { az += 360 }
        return HorizontalPosition(altitudeDeg: alt, azimuthDeg: az)
    }
}

extension SkyCamera {
    /// A camera looking at a fixed point with the screen's top toward the zenith: used when the sensors
    /// are off and the person drags to look around.
    public static func looking(azimuth: Double, altitude: Double) -> SkyCamera {
        let az = azimuth * .pi / 180, alt = altitude * .pi / 180
        // Look vector in (north, west, up).
        let look = (cos(alt) * cos(az), -cos(alt) * sin(az), sin(alt))
        // Screen-up: the up direction tilted toward the look direction's perpendicular.
        let up = (-sin(alt) * cos(az), sin(alt) * sin(az), cos(alt))
        // Screen-right = look x up, expressed in the same frame.
        let right = (look.1 * up.2 - look.2 * up.1, look.2 * up.0 - look.0 * up.2, look.0 * up.1 - look.1 * up.0)
        // Device axes: x = right, y = up, z = -look. Rows of the matrix are device axes in world coordinates.
        return SkyCamera(rotation: [right.0, right.1, right.2, up.0, up.1, up.2, -look.0, -look.1, -look.2])
    }
}
