// Pure-JVM port of the sky engine in ios/AtlasCore (SkyCamera, SkyStabilizer). No Android classes, so it
// builds and tests anywhere; the Android app adds a thin SensorManager adapter (see README.md).
plugins {
    kotlin("jvm") version "2.0.21"
}

repositories { mavenCentral() }

dependencies {
    testImplementation(kotlin("test"))
    testImplementation("org.json:json:20240303")
}

kotlin { jvmToolchain(17) }

tasks.test {
    useJUnitPlatform()
    // Golden vectors shared with the Swift tests.
    systemProperty("golden.path", rootDir.resolve("../../sky-engine/golden.json").canonicalPath)
}
