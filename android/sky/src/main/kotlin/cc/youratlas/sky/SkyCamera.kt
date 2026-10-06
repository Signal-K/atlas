package cc.youratlas.sky

import kotlin.math.asin
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.tan

data class HorizontalPosition(val altitudeDeg: Double, val azimuthDeg: Double)

data class ScreenPoint(val x: Double, val y: Double)

/**
 * Where the device is pointing, and how to put sky positions on its screen. Port of `SkyCamera.swift`.
 *
 * World axes are x = north, y = west, z = up. [rotation] is a row-major 3x3 matrix mapping world to
 * device (CoreMotion's `CMRotationMatrix`). Device axes: x right, y up the screen, z out of the screen
 * toward the viewer, so the back camera looks along -z.
 */
class SkyCamera(val rotation: DoubleArray) {
    init { require(rotation.size == 9) { "a rotation matrix has nine elements" } }

    /** Where the back camera is pointing right now. */
    val lookDirection: HorizontalPosition
        get() = position(-rotation[6], -rotation[7], -rotation[8])

    /**
     * A point on screen for a sky position, or null if it is behind the viewer or outside the view.
     * [fovDeg] is the horizontal field of view across [width]; the projection is gnomonic.
     */
    fun project(p: HorizontalPosition, fovDeg: Double, width: Double, height: Double): ScreenPoint? {
        val alt = Math.toRadians(p.altitudeDeg)
        val az = Math.toRadians(p.azimuthDeg)
        val vx = cos(alt) * cos(az)
        val vy = -cos(alt) * sin(az)
        val vz = sin(alt)
        val dx = rotation[0] * vx + rotation[1] * vy + rotation[2] * vz
        val dy = rotation[3] * vx + rotation[4] * vy + rotation[5] * vz
        val dz = rotation[6] * vx + rotation[7] * vy + rotation[8] * vz
        if (dz >= -0.05) return null
        val focal = (width / 2) / tan(Math.toRadians(fovDeg) / 2)
        val x = width / 2 + dx / -dz * focal
        val y = height / 2 - dy / -dz * focal
        if (x <= -40 || x >= width + 40 || y <= -40 || y >= height + 40) return null
        return ScreenPoint(x, y)
    }

    companion object {
        internal fun position(x: Double, y: Double, z: Double): HorizontalPosition {
            val alt = Math.toDegrees(asin(z.coerceIn(-1.0, 1.0)))
            // Azimuth runs clockwise from north; east is -y in the (north, west, up) frame.
            var az = Math.toDegrees(atan2(-y, x))
            if (az < 0) az += 360
            return HorizontalPosition(alt, az)
        }

        /** A camera looking at a fixed point with the screen's top toward the zenith (drag-to-look fallback). */
        fun looking(azimuth: Double, altitude: Double): SkyCamera {
            val az = Math.toRadians(azimuth)
            val alt = Math.toRadians(altitude)
            val lx = cos(alt) * cos(az); val ly = -cos(alt) * sin(az); val lz = sin(alt)
            val ux = -sin(alt) * cos(az); val uy = sin(alt) * sin(az); val uz = cos(alt)
            val rx = ly * uz - lz * uy; val ry = lz * ux - lx * uz; val rz = lx * uy - ly * ux
            return SkyCamera(doubleArrayOf(rx, ry, rz, ux, uy, uz, -lx, -ly, -lz))
        }
    }
}
