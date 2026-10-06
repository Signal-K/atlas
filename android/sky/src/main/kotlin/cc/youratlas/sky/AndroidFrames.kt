package cc.youratlas.sky

import kotlin.math.cos
import kotlin.math.sin

/** Conversions from Android's sensor frames to the engine's (north, west, up) world frame. */
object AndroidFrames {
    /**
     * Android's `SensorManager.getRotationMatrixFromVector` / `getRotationMatrix` yields a row-major 3x3
     * `R` taking device coordinates to world (east, north, up). The engine wants the opposite direction,
     * world (north, west, up) to device, which is the same rotation seen from the other side with the
     * world axes renamed: each device axis, expressed in (north, west, up), becomes a row.
     *
     * Use this for a phone held in portrait; `Display.getRotation()` is not needed because the app is
     * locked to portrait.
     */
    fun cameraRotation(androidR: DoubleArray, magneticDeclinationDeg: Double = 0.0): DoubleArray {
        require(androidR.size == 9) { "a rotation matrix has nine elements" }
        val m = DoubleArray(9)
        for (j in 0 until 3) {
            m[3 * j] = androidR[3 + j]       // north
            m[3 * j + 1] = -androidR[j]      // west = -east
            m[3 * j + 2] = androidR[6 + j]   // up
        }
        if (magneticDeclinationDeg == 0.0) return m
        // The sensor's north is magnetic. True azimuth = magnetic azimuth + declination (east positive),
        // which is a rotation of the world about up: M_true = M_mag * Rz(declination).
        val d = Math.toRadians(magneticDeclinationDeg)
        val c = cos(d); val s = sin(d)
        val out = DoubleArray(9)
        for (r in 0 until 3) {
            out[3 * r] = m[3 * r] * c + m[3 * r + 1] * s
            out[3 * r + 1] = -m[3 * r] * s + m[3 * r + 1] * c
            out[3 * r + 2] = m[3 * r + 2]
        }
        return out
    }
}
