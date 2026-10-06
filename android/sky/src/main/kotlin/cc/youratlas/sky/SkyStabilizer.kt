package cc.youratlas.sky

import kotlin.math.abs
import kotlin.math.acos
import kotlin.math.exp
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin
import kotlin.math.sqrt

/**
 * Keeps the sky chart still when the phone is still. Port of `SkyStabilizer.swift`; keep the two in
 * step (`sky-engine/golden.json` fails if they drift).
 *
 * The fused attitude is nudged by the magnetometer even when the phone is at rest. The gyro rate tells
 * real movement from those corrections: still, the filter follows very slowly; turning, it follows fast.
 */
class SkyStabilizer(val tuning: Tuning = Tuning()) {
    data class Tuning(
        val restTimeConstant: Double = 2.5,
        val moveTimeConstant: Double = 0.03,
        val stillRate: Double = 0.05,
        val movingRate: Double = 0.2,
        val rateDecay: Double = 0.25,
        val catchUpDegrees: Double = 8.0,
    )

    private var smoothed: Quat? = null
    private var rate = 0.0
    private var lastTime: Double? = null

    fun reset() { smoothed = null; rate = 0.0; lastTime = null }

    /**
     * [rotation] is a row-major rotation matrix, [rotationRate] the gyro magnitude in rad/s, [time] a
     * monotonic timestamp in seconds. Returns the stabilised rotation matrix.
     */
    fun filter(rotation: DoubleArray, rotationRate: Double, time: Double): DoubleArray {
        val raw = Quat.fromMatrix(rotation)
        val current = smoothed
        val last = lastTime
        if (current == null || last == null) {
            smoothed = raw; lastTime = time; rate = rotationRate
            return rotation
        }
        val dt = min(0.25, max(1e-3, time - last))
        lastTime = time

        rate = max(rotationRate, rate * exp(-dt / tuning.rateDecay))
        val moving = smoothstep(rate, tuning.stillRate, tuning.movingRate)

        val target = if (current.dot(raw) < 0) raw.negated() else raw
        val errorRatio = Math.toDegrees(current.angleTo(target)) / tuning.catchUpDegrees
        val restTau = tuning.restTimeConstant / (1 + errorRatio * errorRatio)
        val tau = restTau + (tuning.moveTimeConstant - restTau) * moving

        val alpha = 1 - exp(-dt / tau)
        val next = current.slerp(target, alpha)
        smoothed = next
        return next.matrix()
    }

    private fun smoothstep(x: Double, lo: Double, hi: Double): Double {
        val t = ((x - lo) / (hi - lo)).coerceIn(0.0, 1.0)
        return t * t * (3 - 2 * t)
    }
}

/** Unit quaternion, w + xi + yj + zk. */
internal class Quat(val w: Double, val x: Double, val y: Double, val z: Double) {
    fun negated() = Quat(-w, -x, -y, -z)
    fun dot(o: Quat) = w * o.w + x * o.x + y * o.y + z * o.z
    fun angleTo(o: Quat) = 2 * acos(min(1.0, abs(dot(o))))

    fun normalized(): Quat {
        val n = sqrt(w * w + x * x + y * y + z * z)
        return if (n > 0) Quat(w / n, x / n, y / n, z / n) else Quat(1.0, 0.0, 0.0, 0.0)
    }

    fun slerp(o: Quat, t: Double): Quat {
        val d = dot(o)
        if (d > 0.9995) {
            return Quat(w + (o.w - w) * t, x + (o.x - x) * t, y + (o.y - y) * t, z + (o.z - z) * t).normalized()
        }
        val theta = acos(min(1.0, d))
        val sinTheta = sin(theta)
        val a = sin((1 - t) * theta) / sinTheta
        val b = sin(t * theta) / sinTheta
        return Quat(w * a + o.w * b, x * a + o.x * b, y * a + o.y * b, z * a + o.z * b).normalized()
    }

    fun matrix(): DoubleArray = doubleArrayOf(
        1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w),
        2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w),
        2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y),
    )

    companion object {
        fun fromMatrix(m: DoubleArray): Quat {
            require(m.size == 9) { "a rotation matrix has nine elements" }
            val trace = m[0] + m[4] + m[8]
            val q = when {
                trace > 0 -> {
                    val s = sqrt(trace + 1) * 2
                    Quat(0.25 * s, (m[7] - m[5]) / s, (m[2] - m[6]) / s, (m[3] - m[1]) / s)
                }
                m[0] > m[4] && m[0] > m[8] -> {
                    val s = sqrt(1 + m[0] - m[4] - m[8]) * 2
                    Quat((m[7] - m[5]) / s, 0.25 * s, (m[1] + m[3]) / s, (m[2] + m[6]) / s)
                }
                m[4] > m[8] -> {
                    val s = sqrt(1 + m[4] - m[0] - m[8]) * 2
                    Quat((m[2] - m[6]) / s, (m[1] + m[3]) / s, 0.25 * s, (m[5] + m[7]) / s)
                }
                else -> {
                    val s = sqrt(1 + m[8] - m[0] - m[4]) * 2
                    Quat((m[3] - m[1]) / s, (m[2] + m[6]) / s, (m[5] + m[7]) / s, 0.25 * s)
                }
            }
            return q.normalized()
        }
    }
}
