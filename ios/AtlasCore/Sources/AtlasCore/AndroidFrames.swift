import Foundation

/// Conversions from Android's sensor frames to the engine's (north, west, up) world frame, so the same
/// `SkyCamera` and `SkyStabilizer` run unchanged when AtlasCore is built with the Swift Android SDK.
public enum AndroidFrames {
    /// Android's `SensorManager.getRotationMatrixFromVector` / `getRotationMatrix` yields a row-major 3x3
    /// `R` taking device coordinates to world (east, north, up). The engine wants world (north, west, up)
    /// to device: each device axis, expressed in (north, west, up), becomes a row. Portrait only.
    ///
    /// The sensor's north is magnetic. Pass `GeomagneticField.getDeclination()` (degrees, east positive)
    /// to get a true-north camera, as iOS's `xTrueNorthZVertical` frame already is.
    public static func cameraRotation(androidR r: [Double], magneticDeclinationDeg: Double = 0) -> [Double] {
        precondition(r.count == 9, "a rotation matrix has nine elements")
        var m = [Double](repeating: 0, count: 9)
        for j in 0..<3 {
            m[3 * j] = r[3 + j]        // north
            m[3 * j + 1] = -r[j]       // west = -east
            m[3 * j + 2] = r[6 + j]    // up
        }
        guard magneticDeclinationDeg != 0 else { return m }
        // True azimuth = magnetic azimuth + declination: M_true = M_mag * Rz(declination).
        let d = magneticDeclinationDeg * .pi / 180, c = cos(d), s = sin(d)
        var out = m
        for row in 0..<3 {
            out[3 * row] = m[3 * row] * c + m[3 * row + 1] * s
            out[3 * row + 1] = -m[3 * row] * s + m[3 * row + 1] * c
        }
        return out
    }
}
