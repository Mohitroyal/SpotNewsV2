# ==============================================================================
# RTI Express / Spot News - Optimized R8 ProGuard Configuration
# ==============================================================================

# Preserve attributes necessary for reflection, debugging, stack traces, and annotations
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod,SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# Preserve native methods
-keepclasseswithmembernames class * {
    native <methods>;
}

# ------------------------------------------------------------------------------
# 1. Capacitor Core & Plugin Architecture
# ------------------------------------------------------------------------------
-keep class com.getcapacitor.** { *; }
-dontwarn com.getcapacitor.**

# Keep all classes annotated with CapacitorPlugin
-keep @com.getcapacitor.annotation.CapacitorPlugin class * {
    public *;
}

# Keep all Plugin subclasses and their bridge callbacks / plugin methods
-keepclassmembers class * extends com.getcapacitor.Plugin {
    @com.getcapacitor.PluginMethod public *;
    @com.getcapacitor.annotation.PermissionCallback public *;
    @com.getcapacitor.annotation.ActivityCallback public *;
    public <init>(...);
}

-keep public class * extends com.getcapacitor.Plugin {
    public <init>(...);
    public <methods>;
}

# Keep JavaScript Interface methods invoked from WebView JS context
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# ------------------------------------------------------------------------------
# 2. Registered Capacitor Plugins
# ------------------------------------------------------------------------------
-keep public class com.getcapacitor.community.fcm.FCMPlugin { *; }
-keep public class com.getcapacitor.community.media.MediaPlugin { *; }
-keep public class com.capacitorjs.plugins.** { *; }
-keep public class com.codetrixstudio.capacitor.GoogleAuth.GoogleAuth { *; }
-keep public class com.newscraft.mobile.TargetSharePlugin { *; }
-keep public class com.newscraft.mobile.MainActivity { *; }

# Cordova InAppBrowser Plugin
-keep class org.apache.cordova.** { *; }
-dontwarn org.apache.cordova.**

# ------------------------------------------------------------------------------
# 3. Google Sign-In & Google Play Services
# ------------------------------------------------------------------------------
-keep class com.google.android.gms.auth.api.signin.** { *; }
-keep class com.google.android.gms.common.api.** { *; }
-keep class com.google.android.gms.tasks.** { *; }
-dontwarn com.google.android.gms.**

# ------------------------------------------------------------------------------
# 4. Firebase Cloud Messaging & Push Notifications
# ------------------------------------------------------------------------------
-keep class com.google.firebase.messaging.** { *; }
-keep class com.google.firebase.iid.** { *; }
-keep class com.google.firebase.provider.FirebaseInitProvider
-dontwarn com.google.firebase.**

# ------------------------------------------------------------------------------
# 5. AndroidX & WebKit
# ------------------------------------------------------------------------------
-keep class androidx.webkit.** { *; }
-keep class android.webkit.** { *; }
-keep class androidx.core.app.NotificationCompat** { *; }
-keep class androidx.core.content.FileProvider { *; }
-dontwarn androidx.webkit.**

# ------------------------------------------------------------------------------
# 6. Suppress safe warnings from optional third-party references
# ------------------------------------------------------------------------------
-dontwarn org.apache.commons.codec.**
-dontwarn com.google.errorprone.annotations.**
