package cc.youratlas.sky

import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull

class SkyEngineTest {
    private val golden = JSONObject(File(System.getProperty("golden.path")).readText())

    private fun JSONArray.doubles() = DoubleArray(length()) { getDouble(it) }

    @Test
    fun projectionMatchesTheSwiftEngine() {
        val projections = golden.getJSONArray("projections")
        for (i in 0 until projections.length()) {
            val p = projections.getJSONObject(i)
            val cam = SkyCamera(p.getJSONArray("rotation").doubles())
            val look = cam.lookDirection
            assertEquals(p.getDouble("lookAlt"), look.altitudeDeg, 1e-3)
            assertEquals(p.getDouble("lookAz"), look.azimuthDeg, 1e-3)
            val points = p.getJSONArray("points")
            for (j in 0 until points.length()) {
                val pt = points.getJSONObject(j)
                val s = cam.project(HorizontalPosition(pt.getDouble("alt"), pt.getDouble("az")), p.getDouble("fov"), p.getDouble("width"), p.getDouble("height"))
                if (pt.has("x")) {
                    assertNotNull(s, "${p.getString("name")} ${pt}")
                    assertEquals(pt.getDouble("x"), s.x, 1e-3)
                    assertEquals(pt.getDouble("y"), s.y, 1e-3)
                } else {
                    assertNull(s, "${p.getString("name")} ${pt}")
                }
            }
        }
    }

    @Test
    fun stabilizerMatchesTheSwiftEngine() {
        val stabilizer = SkyStabilizer()
        val frames = golden.getJSONArray("stabilizer")
        for (i in 0 until frames.length()) {
            val f = frames.getJSONObject(i)
            val out = stabilizer.filter(f.getJSONArray("in").doubles(), f.getDouble("rate"), f.getDouble("t"))
            val expected = f.getJSONArray("out").doubles()
            for (k in 0 until 9) assertEquals(expected[k], out[k], 1e-3, "frame $i element $k")
        }
    }

    @Test
    fun androidUprightPhoneFacingNorthIsTheSameCameraAsCoreMotion() {
        // Android R (device -> east, north, up) for an upright phone with the back camera toward north.
        val android = doubleArrayOf(1.0, 0.0, 0.0, 0.0, 0.0, -1.0, 0.0, 1.0, 0.0)
        val cam = SkyCamera(AndroidFrames.cameraRotation(android))
        val expected = doubleArrayOf(0.0, -1.0, 0.0, 0.0, 0.0, 1.0, -1.0, 0.0, 0.0)
        for (k in 0 until 9) assertEquals(expected[k], cam.rotation[k], 1e-12)
        assertEquals(0.0, cam.lookDirection.azimuthDeg, 1e-9)
        assertEquals(0.0, cam.lookDirection.altitudeDeg, 1e-9)
    }

    @Test
    fun magneticDeclinationTurnsMagneticNorthIntoTrueAzimuth() {
        val android = doubleArrayOf(1.0, 0.0, 0.0, 0.0, 0.0, -1.0, 0.0, 1.0, 0.0)
        val cam = SkyCamera(AndroidFrames.cameraRotation(android, magneticDeclinationDeg = 10.0))
        assertEquals(10.0, cam.lookDirection.azimuthDeg, 1e-9)
        val west = SkyCamera(AndroidFrames.cameraRotation(android, magneticDeclinationDeg = -10.0))
        assertEquals(350.0, west.lookDirection.azimuthDeg, 1e-9)
    }
}
