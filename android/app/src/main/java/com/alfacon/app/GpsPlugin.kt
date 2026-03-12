package com.alfacon.app

import android.app.*
import android.content.Intent
import android.location.*
import android.os.*
import androidx.core.app.NotificationCompat
import com.getcapacitor.*
import com.getcapacitor.annotation.CapacitorPlugin
import org.json.JSONArray
import org.json.JSONObject

// ─── FOREGROUND SERVICE ───────────────────────────────────────────────────────

class GpsTrackingService : Service(), LocationListener {

    private lateinit var locationManager: LocationManager
    private val coords = mutableListOf<JSONObject>()
    private var isTracking = false

    companion object {
        const val CHANNEL_ID = "gps_tracking_channel"
        const val NOTIFICATION_ID = 42
        const val ACTION_START = "START_TRACKING"
        const val ACTION_STOP = "STOP_TRACKING"

        var lastCoords: JSONArray = JSONArray()
        var isRunning = false
        // Coords preservadas após stop para o plugin conseguir ler
        var finalCoords: JSONArray = JSONArray()
    }

    override fun onCreate() {
        super.onCreate()
        locationManager = getSystemService(LOCATION_SERVICE) as LocationManager
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> startTracking()
            ACTION_STOP -> stopTracking()
        }
        return START_STICKY
    }

    private fun startTracking() {
        if (isTracking) return
        isTracking = true
        isRunning = true
        coords.clear()
        lastCoords = JSONArray()
        finalCoords = JSONArray()

        startForeground(NOTIFICATION_ID, buildNotification())

        try {
            // APENAS GPS puro — sem NETWORK_PROVIDER que causa pontos imprecisos
            locationManager.requestLocationUpdates(
                LocationManager.GPS_PROVIDER,
                1000L,  // 1 segundo
                2f,     // 2 metros minimo de movimento
                this,
                Looper.getMainLooper()
            )
        } catch (e: SecurityException) {
            stopSelf()
        }
    }

    private fun stopTracking() {
        isTracking = false
        isRunning = false
        // Salva coords antes de limpar, para o plugin conseguir ler depois
        finalCoords = lastCoords
        try { locationManager.removeUpdates(this) } catch (_: Exception) {}
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    override fun onLocationChanged(location: Location) {
        // So aceita pontos GPS com precisao boa (30m)
        if (location.accuracy > 30f) return

        // Ignora pontos do provedor de rede
        if (location.provider == LocationManager.NETWORK_PROVIDER) return

        val point = JSONObject().apply {
            put("lat", location.latitude)
            put("lng", location.longitude)
            put("accuracy", location.accuracy)
            put("speed", if (location.hasSpeed()) location.speed else 0.0)
            put("time", location.time)
        }

        if (coords.isNotEmpty()) {
            val last = coords.last()
            val dist = haversine(
                last.getDouble("lat"), last.getDouble("lng"),
                location.latitude, location.longitude
            )
            // Minimo 1m, maximo 50m entre pontos consecutivos
            if (dist < 1.0 || dist > 50) return
        }

        coords.add(point)
        val arr = JSONArray()
        coords.forEach { arr.put(it) }
        lastCoords = arr
    }

    private fun haversine(lat1: Double, lng1: Double, lat2: Double, lng2: Double): Double {
        val R = 6371000.0
        val dLat = Math.toRadians(lat2 - lat1)
        val dLng = Math.toRadians(lng2 - lng1)
        val a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) *
                Math.sin(dLng / 2) * Math.sin(dLng / 2)
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    }

    private fun buildNotification(): Notification {
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("GPS ativo")
            .setContentText("Registrando seu percurso...")
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "GPS Tracking",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Mantem o GPS ativo durante o treino"
                setShowBadge(false)
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        super.onDestroy()
        isRunning = false
        finalCoords = lastCoords
        try { locationManager.removeUpdates(this) } catch (_: Exception) {}
    }
}

// ─── CAPACITOR PLUGIN ─────────────────────────────────────────────────────────

@CapacitorPlugin(name = "GpsTracker")
class GpsTrackerPlugin : Plugin() {

    @PluginMethod
    fun startTracking(call: PluginCall) {
        val intent = Intent(context, GpsTrackingService::class.java)
        intent.action = GpsTrackingService.ACTION_START
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent)
        } else {
            context.startService(intent)
        }
        call.resolve(JSObject().put("status", "started"))
    }

    @PluginMethod
    fun stopTracking(call: PluginCall) {
        val intent = Intent(context, GpsTrackingService::class.java)
        intent.action = GpsTrackingService.ACTION_STOP
        context.startService(intent)
        call.resolve(JSObject().put("status", "stopped"))
    }

    @PluginMethod
    fun getCoords(call: PluginCall) {
        // Usa lastCoords durante o tracking, ou finalCoords apos o stop
        val coords = if (GpsTrackingService.lastCoords.length() > 0)
            GpsTrackingService.lastCoords
        else
            GpsTrackingService.finalCoords

        val result = JSObject()
        result.put("coords", coords.toString())
        result.put("count", coords.length())
        call.resolve(result)
    }

    @PluginMethod
    fun isTracking(call: PluginCall) {
        call.resolve(JSObject().put("running", GpsTrackingService.isRunning))
    }
}